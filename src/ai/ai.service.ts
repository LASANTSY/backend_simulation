import AppDataSource from '../data-source';
import { AnalysisResult } from '../entities/AnalysisResult';
import { Simulation } from '../entities/Simulation';
import { OpenAI } from 'openai';
import axios from 'axios';
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

      const text = resp.choices?.[0]?.message?.content ?? resp.choices?.[0]?.text ?? '';

      let parsed: any = null;
      try {
        const m = text.match(/\{[\s\S]*\}/m);
        const jsonText = m ? m[0] : text;
        parsed = JSON.parse(jsonText);
      } catch (err) {
        parsed = { _parseError: String(err), raw: text };
      }

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
              const resp = await gclient.models.generateContent({ model: `models/${GEMINI_MODEL}`, parent: `projects/${PROJECT}`, contents: [{ text: prompt }], maxOutputTokens: 800, temperature: 0.2 });
              const cand = resp?.candidates?.[0];
              const content = cand?.content;
              const maybeText = content?.parts ? content.parts.map((p: any) => p.text).join('') : (content?.text ?? content ?? '');
              if (maybeText) {
                text = maybeText;
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
                      const resp2 = await gclient.models.generateContent({ model: `models/${alt}`, parent: `projects/${PROJECT}`, contents: [{ text: prompt }], maxOutputTokens: 800, temperature: 0.2 });
                      const cand2 = resp2?.candidates?.[0];
                      const content2 = cand2?.content;
                      const maybeText2 = content2?.parts ? content2.parts.map((p: any) => p.text).join('') : (content2?.text ?? content2 ?? '');
                      if (maybeText2) {
                        text = maybeText2;
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
                // Try the simple shape first
                const maybeResp = await client[m]({ model: GEMINI_MODEL, prompt: { text: prompt }, maxOutputTokens: 800, temperature: 0.2 });
                // try to extract text from a few known shapes
                const maybeText = maybeResp?.candidates?.[0]?.content ?? maybeResp?.output?.[0]?.content ?? maybeResp?.output ?? maybeResp?.text ?? (maybeResp?.choices?.[0]?.message?.content);
                if (maybeText) {
                  text = maybeText;
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

      // If the client branch didn't produce text, fall back to a minimal REST attempt using 'contents'.
      if (!text) {
        try {
          const useKeyParam = typeof GEMINI_API_KEY === 'string' && GEMINI_API_KEY.startsWith('AIza');
          const url = useKeyParam ? `https://generativelanguage.googleapis.com/v1/models/${usedModel}:generateContent?key=${GEMINI_API_KEY}` : `https://generativelanguage.googleapis.com/v1/models/${usedModel}:generateContent`;
          const headers: any = {};
          if (!useKeyParam) headers['Authorization'] = `Bearer ${GEMINI_API_KEY}`;
          const res = await axios.post(url, { contents: [{ text: prompt }], maxOutputTokens: 800, temperature: 0.2 }, { headers });
          text = res.data?.candidates?.[0]?.content?.parts ? res.data.candidates[0].content.parts.map((p: any) => p.text).join('') : (res.data?.candidates?.[0]?.content ?? res.data?.output ?? '');
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
                  const res2 = await axios.post(url2, { contents: [{ text: prompt }], maxOutputTokens: 800, temperature: 0.2 }, { headers: headers2 });
                  text = res2.data?.candidates?.[0]?.content?.parts ? res2.data.candidates[0].content.parts.map((p: any) => p.text).join('') : (res2.data?.candidates?.[0]?.content ?? res2.data?.output ?? '');
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

      let parsed: any = null;
      try {
        const m = text.match(/\{[\s\S]*\}/m);
        const jsonText = m ? m[0] : text;
        parsed = JSON.parse(jsonText);
      } catch (err) {
        parsed = { _parseError: String(err), raw: text };
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
