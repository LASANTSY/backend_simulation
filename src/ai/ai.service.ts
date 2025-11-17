import AppDataSource from '../data-source';
import { AnalysisResult } from '../entities/AnalysisResult';
import { Simulation } from '../entities/Simulation';
import { OpenAI } from 'openai';
import axios from 'axios';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';
import { llmValidationFailures } from '../monitoring/metrics.service';
import { extractJSON } from './llm-parser';
import contextService from '../context/context.service';
import * as dotenv from 'dotenv';

dotenv.config();

const AI_PROVIDER = process.env.AI_PROVIDER || 'openai';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4';
const OPENAI_FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL || 'gpt-3.5-turbo';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
// Default Gemini model: use a model that is available for most projects
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
// Strict system prompt to force Gemini to return ONLY valid JSON matching the required schema.
const GEMINI_SYSTEM_PROMPT = `Vous êtes un assistant automatique. Vous devez RÉPONDRE UNIQUEMENT par un objet JSON valide correspondant EXACTEMENT au schéma demandé et RIEN D'AUTRE (pas d'explications, pas de Markdown, pas de backticks, pas de commentaires).

La structure exacte attendue est :
{
  "prediction": {
    "summary": "string (une phrase)",
    "values": [ number, number, ... ]
  },
  "risks": [
    {
      "factor": "string",
      "description": "string",
      "probability": 0.75,    // NOMBRE entre 0.0 et 1.0 (exemples: 0.3, 0.7, 0.9)
      "impact": "high" | "medium" | "low"
    }
  ],
  "recommendations": [
    {
      "priority": 1,          // ENTIER (1,2,3,...)
      "action": "string"
    }
  ]
}

Règles obligatoires STRICTES :
1) Retournez STRICTEMENT le JSON ci-dessus et AUCUNE propriété supplémentaire (additionalProperties interdites) à tous les niveaux.
2) prediction.summary : string, une seule phrase.
3) prediction.values : tableau d'objets et NON des nombres bruts. Chaque objet = { "key": string, "value": number, "horizon": string|null }. 'value' doit être numérique.
4) risks : tableau d'objets. Chaque objet = { "factor": string, "description": string, "probability": number (0..1), "impact": "high"|"medium"|"low" }. NE PAS ajouter d'autres propriétés.
5) recommendations : tableau d'objets. Chaque objet = { "priority": integer >=1, "action": string }. Pas d'autres propriétés.
6) Ajoutez OBLIGATOIREMENT les propriétés : prediction, interpretation, risks, opportunities, recommendations, confidence, metadata.
7) opportunities : tableau (peut être vide) d'objets { "description": string, "impact": number }. Si aucune opportunité, renvoyer [].
8) confidence : nombre entre 0 et 1.
9) metadata : objet pouvant contenir { "time": string|null, "weather": string|null, "economy": {}, "demography": {} }. Si pas d'info, valeurs null ou objets vides.
10) AUCUNE valeur textuelle pour probability ou priority (uniquement number/integer).
11) Si une valeur est inconnue, utilisez null, ne créez pas de nouvelles clefs.
12) Ne mettez pas de texte explicatif autour : pas de Markdown, pas de code fences, pas de prose, uniquement JSON.
13) Exemples valides probability : 0.3, 0.7, 0.9. Exemples priority : 1,2,3.

Si vous avez compris, répondez uniquement par le JSON demandé lorsqu'on vous fournira la consigne utilisateur.
`;

export class AIService {
  private analysisRepo = AppDataSource.getRepository(AnalysisResult);
  private simulationRepo = AppDataSource.getRepository(Simulation);
  private client: any;

  constructor() {
    if (AI_PROVIDER === 'openai') {
      if (!OPENAI_API_KEY) {
        console.warn('OPENAI_API_KEY not set; AI calls will fail until configured.');
      }
      this.client = new OpenAI({ apiKey: OPENAI_API_KEY });
    } else if (AI_PROVIDER === 'gemini') {
      if (!GEMINI_API_KEY) {
        console.warn('GEMINI_API_KEY not set; Gemini calls will fail until configured.');
      }
      // We won't create a special client instance; we'll call Gemini REST endpoints via axios when needed.
      this.client = null;
    } else {
      // Placeholder for other providers
      this.client = null;
    }
    // lazy AJV setup will be performed in validate helper if needed
  }

  // Validate and optionally retry LLM output to match strict JSON schema
  private static _ajv: any = null;
  private static _validateFn: any = null;
  private static _schema: any = null;

  // Safely extract plain text from Gemini responses across SDK/REST variants
  private static extractGeminiTextFromData(data: any): string | null {
    try {
      if (!data) return null;
      // Primary documented shape
      const cand = data?.candidates?.[0];
      const content = cand?.content;
      const parts = content?.parts;
      if (Array.isArray(parts) && parts.length > 0) {
        const texts = parts.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).filter(Boolean);
        if (texts.length) return texts.join('');
      }
      if (typeof content?.text === 'string') return content.text;
      if (typeof content === 'string') return content;
      // Older/alternative shapes
      const output = data?.output;
      if (typeof output === 'string') return output;
      if (Array.isArray(output) && output.length) {
        const o0 = output[0];
        if (typeof o0 === 'string') return o0;
        if (o0?.content?.parts && Array.isArray(o0.content.parts)) {
          const texts = o0.content.parts.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).filter(Boolean);
          if (texts.length) return texts.join('');
        }
        if (typeof o0?.content?.text === 'string') return o0.content.text;
      }
      if (typeof data?.text === 'string') return data.text;
      if (typeof data === 'string') return data;
      // Log structure when extraction fails
      console.warn('[extractGeminiTextFromData] No text found in response structure:', JSON.stringify(data).slice(0, 500));
      return null;
    } catch (err) {
      console.error('[extractGeminiTextFromData] Extraction error:', err);
      return null;
    }
  }

  // Remove common Markdown code fences around JSON and trim whitespace
  private static cleanLLMText(raw: string | null | undefined): string {
    if (!raw || typeof raw !== 'string') return '';
    // Remove ```json ... ``` or ``` ... ``` blocks while keeping inner content
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced && fenced[1]) return fenced[1].trim();
    // Fallback: strip any triple backtick fences
    return raw.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, '')).trim();
  }

  private static loadSchemaOnce() {
    if (AIService._validateFn) return;
    try {
      const ajv = new Ajv({ allErrors: true, strict: true, coerceTypes: false });
      addFormats(ajv);
      const schemaPath = path.join(__dirname, 'schemas', 'analysis-result.schema.json');
      const schemaText = fs.readFileSync(schemaPath, 'utf8');
      const schema = JSON.parse(schemaText);
      AIService._schema = schema;
      AIService._ajv = ajv;
      AIService._validateFn = ajv.compile(schema);
    } catch (e) {
      // if schema load fails, keep validateFn null and validation will be skipped
      AIService._validateFn = null;
      AIService._schema = null;
    }
  }

  // Try to validate a raw LLM text. Returns { valid, errors, parsed }.
  static validateLLMOutputRaw(rawText: string) {
    AIService.loadSchemaOnce();
    if (!AIService._validateFn) return { valid: true, errors: null, parsed: null };
    try {
      const jsonText = extractJSON(rawText) ?? rawText;
      const parsed = JSON.parse(jsonText);
      const valid = AIService._validateFn(parsed);
      return { valid: Boolean(valid), errors: AIService._validateFn.errors, parsed };
    } catch (e) {
      return { valid: false, errors: [{ message: String(e) }], parsed: null };
    }
  }

  // Attempt to normalize common shape deviations from the LLM before validation.
  // - Convert prediction.values: [number, ...] -> [{ key, value, horizon }]
  // - Ensure required top-level properties exist with minimal placeholders.
  private _attemptShapeNormalization(raw: string, analysis: AnalysisResult) {
    try {
      const jsonText = extractJSON(raw) ?? raw;
      const data = JSON.parse(jsonText);
      let mutated = false;

      // Ensure top-level required fields (if missing, add minimal placeholders)
      const ensure = (k: string, v: any) => { if (!(k in data)) { data[k] = v; mutated = true; } };
      ensure('interpretation', 'placeholder interpretation');
      ensure('opportunities', []);
      ensure('confidence', 0.5);
      ensure('metadata', { time: null, weather: null, economy: {}, demography: {} });

      // Normalize metadata to ensure proper types
      if (data.metadata && typeof data.metadata === 'object') {
        if (data.metadata.time && typeof data.metadata.time === 'string') {
          // If time is not ISO date-time format, set to null
          if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(data.metadata.time)) {
            data.metadata.time = null;
            mutated = true;
          }
        }
        if (data.metadata.weather !== null && typeof data.metadata.weather !== 'string') {
          data.metadata.weather = null;
          mutated = true;
        }
      }

      if (data.prediction && Array.isArray(data.prediction.values)) {
        const arr = data.prediction.values;
        if (arr.length > 0 && typeof arr[0] !== 'object') {
          const months: string[] = (analysis?.resultData?.months && Array.isArray(analysis.resultData.months)) ? analysis.resultData.months : [];
          data.prediction.values = arr.map((v: any, idx: number) => ({
            key: months[idx] ?? `value_${idx}`,
            value: typeof v === 'number' ? v : Number(v),
            horizon: months[idx] ?? null
          }));
          mutated = true;
        }
      }

      // Normalize risks: ensure required fields, keep allowed properties only
      if (Array.isArray(data.risks)) {
        data.risks = data.risks.map((r: any) => {
          if (r && typeof r === 'object') {
            const normalized: any = {
              description: r.description ?? r.factor ?? 'Unknown risk',
              probability: typeof r.probability === 'number' ? r.probability : 0.5
            };
            if (r.factor) normalized.factor = r.factor;
            if (r.impact) normalized.impact = r.impact;
            return normalized;
          }
          return r;
        });
        mutated = true;
      }

      if (!mutated) return null;
      return { _wasNormalized: true, data };
    } catch { return null; }
  }

  // backward-compatible public API requested: validateLLMOutput
  public validateLLMOutput(response: string) {
    return AIService.validateLLMOutputRaw(response);
  }

  // Retry helper: given an initial raw text and a model caller that accepts a prompt and returns raw text,
  // attempt up to `retries` times to get a valid JSON matching the schema. Increments metric on failures.
  private async retryValidateAndRepair(initialText: string, prompt: string, modelCaller: (p: string) => Promise<string>, retries = 3) {
    let check = AIService.validateLLMOutputRaw(initialText);
    if (check.valid && check.parsed) return check.parsed;
    // first failure
    console.error('LLM validation failed for initial response:', { errors: check.errors, raw: initialText });
    llmValidationFailures.inc();
    // attempt retries
    for (let i = 0; i < retries; i++) {
      const improved = `${prompt}\n\nIMPORTANT: respond with valid JSON matching this schema: ${JSON.stringify(AIService._schema || {})}`;
      try {
        const text = await modelCaller(improved);
        if (!text || text.trim() === '') {
          console.error(`LLM call returned empty text on retry #${i + 1}`);
          llmValidationFailures.inc();
          continue;
        }
        const res = AIService.validateLLMOutputRaw(text);
        if (res.valid && res.parsed) return res.parsed;
        console.error(`LLM validation failed on retry #${i + 1}:`, { errors: res.errors, raw: text });
        llmValidationFailures.inc();
      } catch (e) {
        // Log richer details for HTTP/axios errors so callers can diagnose 4xx/5xx responses
        try {
          const status = (e as any)?.response?.status ?? (e as any)?.status ?? null;
          const data = (e as any)?.response?.data ?? (e as any)?.data ?? null;
          console.error(`LLM call error during retry #${i + 1}: status=${status}`, data ?? e);
        } catch (logErr) {
          console.error(`LLM call error during retry #${i + 1}:`, e);
        }
        llmValidationFailures.inc();
      }
    }
    // after retries, return a safe minimal fallback structured response
    return {
      prediction: null,
      interpretation: 'Fallback minimal structured response due to repeated LLM validation failures',
      risks: [],
      opportunities: [],
      recommendations: [],
      confidence: 0,
      metadata: {}
    };
  }

  // build a prompt that includes simulation + context and asks for structured JSON output
  buildPrompt(sim: Simulation, analysis: AnalysisResult, extraContext: any = {}) {
    const contextParts: string[] = [];
    // time context
    if (extraContext.time) contextParts.push(`Time context: ${JSON.stringify(extraContext.time)}`);
    // weather/climate
    if (extraContext.weather) contextParts.push(`Weather/Climate: ${JSON.stringify(extraContext.weather)}`);
    // economic
    if (extraContext.economy) contextParts.push(`Economic context: ${JSON.stringify(extraContext.economy)}`);
    if (extraContext.indicators) contextParts.push(`Economic indicators: ${JSON.stringify(extraContext.indicators)}`);
    // demographic
    if (extraContext.demography) contextParts.push(`Demographic context: ${JSON.stringify(extraContext.demography)}`);

    const simJson = JSON.stringify(sim.parameters || {});
    const analysisJson = JSON.stringify(analysis.resultData || {});

    const instruction = `Vous êtes un expert financier/analyste capable d'intégrer le contexte temporel, météo, économique et démographique. ` +
      `A partir des paramètres de simulation et des séries fournies, produisez UN OBJET JSON structuré (réponse unique, sans Markdown) contenant au minimum les clefs suivantes :` +
      `\n- prediction: résumé chiffré de la projection (valeurs clés et horizon),` +
      `\n- interpretation: explication en 3-6 phrases de la logique derrière la projection,` +
      `\n- risks: liste des facteurs de risque principaux (chaque élément avec description et probabilité approximative),` +
      `\n- opportunities: liste d'opportunités ou leviers d'action (description + impact potentiel),` +
      `\n- recommendations: actions concrètes priorisées,` +
      `\n- confidence: estimation numérique (0-1) de la fiabilité de cette analyse et motifs.` +
      `\nInclure également un bref champ metadata contenant les éléments de contexte utilisés (time, weather, economy, demography).` +
      `\nRetournez uniquement du JSON valide.`;

  const prompt = `${instruction}

Simulation parameters: ${simJson}

Simulation summary/resultData: ${analysisJson}

Additional context: ${contextParts.join('; ') || 'none'}
`;

    return prompt;
  }

  // Enrich an existing AnalysisResult by calling AI and storing parsed output inside resultData.aiAnalysis
  async enrichAnalysis(analysisId: string, extraContext: any = {}) {
    const analysis = await this.analysisRepo.findOne({ where: { id: analysisId }, relations: ['simulation'] });
    if (!analysis) throw new Error('AnalysisResult not found');

    const sim = (analysis as any).simulation as Simulation | undefined;

    // If caller didn't provide extraContext, attempt to fetch contextual data automatically
    if (!extraContext || Object.keys(extraContext).length === 0) {
      try {
        extraContext = await contextService.fetchContextForSimulation(sim || (analysis as any).simulation);
      } catch (e) {
        // don't fail if context fetch fails; keep extraContext empty
        extraContext = { _contextError: String(e) };
      }
    }

    const prompt = this.buildPrompt(sim || (analysis as any).simulation, analysis, extraContext);

    // OpenAI provider path (unchanged behavior with fallback model)
    if (AI_PROVIDER === 'openai') {
      if (!this.client) throw new Error('OpenAI client not configured');

      const callModel = async (modelName: string) => {
        return this.client.chat.completions.create({
          model: modelName,
          messages: [
            { role: 'system', content: 'You produce only JSON responses when asked.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 800,
          temperature: 0.2,
        });
      };

      let resp: any;
      let usedModel = OPENAI_MODEL;
      try {
        resp = await callModel(OPENAI_MODEL);
      } catch (err: any) {
        const msg = err?.message || String(err);
        const status = err?.status || err?.statusCode || err?.code;
        if (status === 404 || /does not exist|not found|model error|You do not have access/i.test(msg)) {
          try {
            console.warn(`OpenAI model ${OPENAI_MODEL} not available (status=${status}). Retrying with fallback model ${OPENAI_FALLBACK_MODEL}.`);
            resp = await callModel(OPENAI_FALLBACK_MODEL);
            usedModel = OPENAI_FALLBACK_MODEL;
          } catch (err2: any) {
            const finalErr = err2 || err;
            const textErr = finalErr?.message || String(finalErr);
            const updatedErrAnalysis = analysis;
            updatedErrAnalysis.resultData = {
              ...updatedErrAnalysis.resultData,
              aiError: textErr,
            } as any;
            await this.analysisRepo.save(updatedErrAnalysis as any);
            throw new Error(`AI provider error: ${textErr}`);
          }
        } else {
          const textErr = msg;
          const updatedErrAnalysis = analysis;
          updatedErrAnalysis.resultData = {
            ...updatedErrAnalysis.resultData,
            aiError: textErr,
          } as any;
          await this.analysisRepo.save(updatedErrAnalysis as any);
          throw err;
        }
      }

      let text = resp.choices?.[0]?.message?.content ?? resp.choices?.[0]?.text ?? '';

      // model caller closure accepts a prompt and returns raw text
      const modelCaller = async (p: string) => {
        const resp2 = await this.client.chat.completions.create({
          model: usedModel || OPENAI_MODEL,
          messages: [
            { role: 'system', content: 'You produce only JSON responses when asked.' },
            { role: 'user', content: p },
          ],
          max_tokens: 800,
          temperature: 0.2,
        });
        return resp2.choices?.[0]?.message?.content ?? resp2.choices?.[0]?.text ?? '';
      };

      const parsed: any = await this.retryValidateAndRepair(text, prompt, modelCaller, 3);

      const updated = analysis;
      updated.resultData = {
        ...updated.resultData,
        aiAnalysis: parsed,
        aiRaw: text,
        aiProvider: AI_PROVIDER,
        aiModel: usedModel || OPENAI_MODEL,
        aiAt: new Date().toISOString(),
      } as any;

      try {
        const short = (parsed && parsed.repercussions) ? (typeof parsed.repercussions === 'string' ? parsed.repercussions.slice(0, 200) : JSON.stringify(parsed.repercussions).slice(0, 200)) : '';
        updated.summary = `${updated.summary || ''} | AI: ${short}`;
      } catch {}

      await this.analysisRepo.save(updated as any);
      return parsed;
    }

    // Gemini provider path: prefer the official Google Generative AI client (@google/genai) when available.
    if (AI_PROVIDER === 'gemini') {
      if (!GEMINI_API_KEY) {
        const textErr = 'GEMINI_API_KEY not configured';
        const updatedErrAnalysis = analysis;
        updatedErrAnalysis.resultData = {
          ...updatedErrAnalysis.resultData,
          aiError: textErr,
        } as any;
        await this.analysisRepo.save(updatedErrAnalysis as any);
        throw new Error(textErr);
      }

      // Try to use the installed official client. If it's not usable for any reason,
      // fall back to the previous axios REST attempts so we don't break existing behavior.
  let usedClient = 'none';
  let usedModel = GEMINI_MODEL;
  let text = '';
      let lastError: any = null;

      // Compose finalPrompt = strict system prompt + user prompt to strongly enforce schema.
      const finalPrompt = GEMINI_SYSTEM_PROMPT + '\n\n' + prompt;

      try {
        // dynamic require to avoid hard TypeScript dependency assumptions
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const genai = require('@google/genai');

        // Prefer explicit GoogleGenAI usage when available (clear payload shape).
        const PROJECT = process.env.GENAI_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_PROJECT || undefined;
        let client: any = null;

        if (genai?.GoogleGenAI && PROJECT) {
          try {
            const gclient = new genai.GoogleGenAI({ apiKey: GEMINI_API_KEY });
            usedClient = 'google-genai';
            // SDK expects a 'contents' array for generateContent
              try {
              // Gemini SDK: use the documented payload shape where `contents[].parts[].text`
              // holds the prompt text and generation settings go into `generationConfig`.
              const resp = await gclient.models.generateContent({
                model: `models/${GEMINI_MODEL}`,
                parent: `projects/${PROJECT}`,
                contents: [{ parts: [{ text: finalPrompt }] }],
                // Do NOT include responseMimeType here: some Generative Language endpoints reject it.
                generationConfig: { maxOutputTokens: 800, temperature: 0.2 }
              });
              const extracted = AIService.extractGeminiTextFromData(resp);
              if (extracted) {
                text = AIService.cleanLLMText(extracted);
              }
            } catch (e) {
              lastError = e;
              // If the error is a model-not-found (404), try listing available models and attempt fallback among them.
              const status = e?.response?.status ?? e?.code ?? null;
              const msg = e?.message || '';
              console.warn('google-genai generateContent failed', status, msg);
              if (status === 404 || /not found|Requested entity was not found/i.test(msg)) {
                try {
                  const listRes: any = await gclient.models.list({ parent: `projects/${PROJECT}` });
                  // try to extract array of model descriptors from various shapes
                  const items = listRes?.pageInternal ?? listRes?.page ?? listRes?.models ?? listRes?.pageInternal?.pageInternal ?? listRes?.pageInternal?.page ?? [];
                  const modelsArr = Array.isArray(items) ? items : (items?.pageInternal || items?.models || []);
                  const candidates = (modelsArr as any[])
                    .filter(m => m?.name && (m?.supportedActions?.includes?.('generateContent') || (m?.supportedActions && m.supportedActions.indexOf('generateContent')>=0)))
                    .map(m => {
                      const name = m.name as string;
                      return name.startsWith('models/') ? name.replace(/^models\//, '') : name;
                    })
                    .filter(n => n && n !== GEMINI_MODEL);

                  for (const alt of candidates) {
                    try {
                      // Use correct `contents[].parts[].text` + `generationConfig` for alternate models too
                      const resp2 = await gclient.models.generateContent({
                        model: `models/${alt}`,
                        parent: `projects/${PROJECT}`,
                        contents: [{ parts: [{ text: finalPrompt }] }],
                        // Omit responseMimeType to avoid INVALID_ARGUMENT from REST API
                        generationConfig: { maxOutputTokens: 800, temperature: 0.2 }
                      });
                      const extracted2 = AIService.extractGeminiTextFromData(resp2);
                      if (extracted2) {
                        text = AIService.cleanLLMText(extracted2);
                        usedModel = alt;
                        lastError = null;
                        break;
                      }
                    } catch (err2) {
                      // continue to next candidate
                      lastError = err2;
                    }
                  }
                } catch (listErr) {
                  // listing failed; will fall back later
                  lastError = listErr;
                }
              }
            }
          } catch (e) {
            lastError = e;
            console.warn('google-genai generateContent failed, will try other client candidates or fallbacks', e?.message || e);
          }
        }

        // Many versions of the client expose different named clients. Try a couple of common ones.
        const ClientCandidates = [
          genai.TextServiceClient,
          genai.TextGenerationClient,
          genai.TextGenerationServiceClient,
          genai.TextClient,
          genai.GoogleGenAI,
          genai.GoogleGenAIClient,
          genai.GoogleGenAIService,
        ];
        for (const C of ClientCandidates) {
          if (typeof C === 'function') {
            try {
              client = new C({ apiKey: GEMINI_API_KEY });
              break;
            } catch (e) {
              try {
                // try constructor with explicit project when available
                if (PROJECT) {
                  try { client = new C({ apiKey: GEMINI_API_KEY, project: PROJECT }); break; } catch {}
                }
                // sometimes client constructors expect no args and rely on env-based auth
                client = new C();
                break;
              } catch (e2) {
                // continue
              }
            }
          }
        }

        // Some packages directly export a default client factory
        if (!client && genai?.Client) {
          try { client = new genai.Client({ apiKey: GEMINI_API_KEY }); } catch {}
        }

        if (client) {
          usedClient = 'genai-client';
          // Try a few common method names for generation APIs.
          const methodCandidates = ['generateText', 'generate', 'invoke', 'createText'];
          let got = null;
          for (const m of methodCandidates) {
            if (typeof client[m] === 'function') {
              try {
                // Try the simple shape first -- prefer the documented generation payload:
                // `contents[0].parts[0].text` and `generationConfig`.
                const maybeResp = await client[m]({
                  model: GEMINI_MODEL,
                  contents: [{ parts: [{ text: finalPrompt }] }],
                  generationConfig: { maxOutputTokens: 800, temperature: 0.2 }
                });
                // robust extraction to avoid passing objects like { role: 'model' }
                const extracted = AIService.extractGeminiTextFromData(maybeResp) || (maybeResp?.choices?.[0]?.message?.content ?? null);
                if (extracted) {
                  text = AIService.cleanLLMText(extracted);
                  got = maybeResp;
                  break;
                }
              } catch (err: any) {
                lastError = err;
                // continue to try other method names / shapes
              }
            }
          }

          // If we didn't get anything from the client, throw to trigger fallback below
          if (!text && lastError) throw lastError;
        }
      } catch (err) {
        // record the fact we couldn't use the client and continue to axios fallback
        lastError = err;
        console.warn('Official @google/genai client not usable; falling back to REST. Error:', err?.message || err);
      }

      // If the client branch didn't produce text, fall back to a REST attempt.
      // Different versions of the Generative Language REST API expect different request shapes,
      // so try several payload variants until one succeeds.
      if (!text) {
        const tryPostVariants = async (baseUrl: string, headers: any, p: string) => {
          const variants = [
            // Preferred, documented shape
            { body: { contents: [{ parts: [{ text: p }] }], generationConfig: { maxOutputTokens: 800, temperature: 0.2 } }, name: 'contents+generationConfig' },
            // Some older endpoints/clients used a `prompt.text` shape; try with generationConfig if accepted
            { body: { prompt: { text: p }, generationConfig: { maxOutputTokens: 800, temperature: 0.2 } }, name: 'prompt.text+generationConfig' },
            { body: { input: p, maxOutputTokens: 800, temperature: 0.2 }, name: 'input' },
            { body: { instances: [{ input: p }], parameters: { maxOutputTokens: 800, temperature: 0.2 } }, name: 'instances+parameters' },
            { body: { messages: [{ role: 'user', content: p }] }, name: 'messages' },
          ];
          let lastErr: any = null;
          for (const v of variants) {
            try {
              const res = await axios.post(baseUrl, v.body, { headers });
              const extracted = AIService.extractGeminiTextFromData(res.data);
              if (extracted) {
                return { text: AIService.cleanLLMText(extracted), variant: v.name };
              }
              // continue trying variants if no textual content
            } catch (err: any) {
              lastErr = err;
              // continue to next variant
            }
          }
          throw lastErr || new Error('No variant produced a response');
        };

        try {
          const useKeyParam = typeof GEMINI_API_KEY === 'string' && GEMINI_API_KEY.startsWith('AIza');
          const url = useKeyParam ? `https://generativelanguage.googleapis.com/v1/models/${usedModel}:generateContent?key=${GEMINI_API_KEY}` : `https://generativelanguage.googleapis.com/v1/models/${usedModel}:generateContent`;
          const headers: any = {};
          if (!useKeyParam) headers['Authorization'] = `Bearer ${GEMINI_API_KEY}`;
          const got = await tryPostVariants(url, headers, finalPrompt);
          text = got.text;
        } catch (err: any) {
          lastError = err;
          const status = err?.response?.status;
          const data = err?.response?.data;
          // If REST returns 404 for the model, attempt to list models via REST and try alternatives.
          if (status === 404) {
            try {
              const listUrl = `https://generativelanguage.googleapis.com/v1/models?key=${GEMINI_API_KEY}`;
              const listRes = await axios.get(listUrl);
              const models = listRes.data?.models ?? [];
              const candidates = (models as any[])
                .filter(m => m?.name && m?.supportedActions?.includes && m.supportedActions.includes('generateContent'))
                .map(m => m.name.startsWith('models/') ? m.name.replace(/^models\//, '') : m.name)
                .filter(n => n && n !== usedModel);

              for (const alt of candidates) {
                try {
                  const useKeyParam2 = typeof GEMINI_API_KEY === 'string' && GEMINI_API_KEY.startsWith('AIza');
                  const url2 = useKeyParam2 ? `https://generativelanguage.googleapis.com/v1/models/${alt}:generateContent?key=${GEMINI_API_KEY}` : `https://generativelanguage.googleapis.com/v1/models/${alt}:generateContent`;
                  const headers2: any = {};
                  if (!useKeyParam2) headers2['Authorization'] = `Bearer ${GEMINI_API_KEY}`;
                  const got2 = await tryPostVariants(url2, headers2, finalPrompt);
                  text = got2.text;
                  if (text) { usedModel = alt; lastError = null; break; }
                } catch (err2: any) {
                  lastError = err2;
                }
              }
            } catch (listErr) {
              lastError = listErr;
            }
          }

          const updatedErrAnalysis = analysis;
          updatedErrAnalysis.resultData = {
            ...updatedErrAnalysis.resultData,
            aiError: err?.message || String(err),
            aiErrorDetailed: { status, data },
          } as any;
          await this.analysisRepo.save(updatedErrAnalysis as any);
        }
      }

      if (lastError && !text) {
        const err = lastError;
        const status = err?.response?.status ?? err?.code ?? null;
        const data = err?.response?.data ?? null;
        const textErr = `Gemini error: status=${status} message=${err?.message || String(err)}`;
        const updatedErrAnalysis = analysis;
        updatedErrAnalysis.resultData = {
          ...updatedErrAnalysis.resultData,
          aiError: textErr,
          aiErrorDetailed: { status, data },
        } as any;
        await this.analysisRepo.save(updatedErrAnalysis as any);
        if (status === 404) {
          throw new Error(`${textErr} - endpoint not found; check GEMINI_MODEL name and API availability.`);
        }
        throw new Error(textErr);
      }

      // Try validation + retry using a simple REST-based model caller for Gemini
      let parsed: any = null;
      try {
        const modelCaller = async (p: string) => {
          const useKeyParam = typeof GEMINI_API_KEY === 'string' && GEMINI_API_KEY.startsWith('AIza');
          const url = useKeyParam ? `https://generativelanguage.googleapis.com/v1/models/${usedModel}:generateContent?key=${GEMINI_API_KEY}` : `https://generativelanguage.googleapis.com/v1/models/${usedModel}:generateContent`;
          const headers: any = {};
          if (!useKeyParam) headers['Authorization'] = `Bearer ${GEMINI_API_KEY}`;
          // Use the documented REST payload shape: contents[].parts[].text + generationConfig
          const res = await axios.post(url, { contents: [{ parts: [{ text: p }] }], generationConfig: { maxOutputTokens: 800, temperature: 0.2 } }, { headers });
          const extracted = AIService.extractGeminiTextFromData(res.data);
          return AIService.cleanLLMText(extracted || '');
        };
        // Pre-normalize first raw response before entering retry loop to reduce failures.
        const initialNormalized = this._attemptShapeNormalization(text, analysis);
        if (initialNormalized && initialNormalized._wasNormalized) {
          const check = AIService.validateLLMOutputRaw(JSON.stringify(initialNormalized.data));
          if (check.valid && check.parsed) {
            parsed = check.parsed;
          }
        }
        if (!parsed) {
          const finalParsed = await this.retryValidateAndRepair(text, finalPrompt, async (promptForRetry) => {
            const raw = await modelCaller(promptForRetry);
            const safeRaw = AIService.cleanLLMText(raw);
            const normalized = this._attemptShapeNormalization(safeRaw, analysis);
            return normalized && normalized._wasNormalized ? JSON.stringify(normalized.data) : safeRaw;
          }, 3);
          parsed = finalParsed;
        }
      } catch (e) {
        parsed = { _parseError: String(e), raw: text };
      }

      // Ensure we never persist a null aiAnalysis — replace with a diagnostic object if parsing failed.
      if (parsed == null) {
        console.warn('AI parsed result is null — saving diagnostic object. raw text length=', (text || '')?.length || 0);
        parsed = { _parseError: 'no-parsed-output', raw: text };
      }

      const updated = analysis;
      updated.resultData = {
        ...updated.resultData,
        aiAnalysis: parsed,
        aiRaw: text,
        aiProvider: AI_PROVIDER,
        aiModel: usedModel || GEMINI_MODEL,
        aiAt: new Date().toISOString(),
      } as any;

      try {
        const short = (parsed && parsed.repercussions) ? (typeof parsed.repercussions === 'string' ? parsed.repercussions.slice(0, 200) : JSON.stringify(parsed.repercussions).slice(0, 200)) : '';
        updated.summary = `${updated.summary || ''} | AI: ${short}`;
      } catch {}

      await this.analysisRepo.save(updated as any);
      return parsed;
    }

    throw new Error('Unsupported AI provider');
  }
}

export default new AIService();
