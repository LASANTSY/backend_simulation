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
import { applyPredictionMethods, PredictionResults } from './prediction-methods';
import * as dotenv from 'dotenv';

dotenv.config();

const AI_PROVIDER = process.env.AI_PROVIDER || 'gemini';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4';
const OPENAI_FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL || 'gpt-3.5-turbo';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
// Default Gemini model: use a model that is available for most projects
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
// Strict system prompt to force Gemini to return ONLY valid JSON matching the required schema.
const GEMINI_SYSTEM_PROMPT = `Vous êtes un analyste financier expert spécialisé dans l'interprétation de projections fiscales pour Madagascar, avec une approche pédagogique et accessible.

⚠️ RÈGLES ABSOLUES ET NON-NÉGOCIABLES:
1. Répondez UNIQUEMENT en langue FRANÇAISE (jamais en anglais ou autre langue)
2. Produisez UNIQUEMENT un objet JSON valide, sans Markdown, sans backticks, sans texte superflu
3. TOUS les champs textuels (summary, interpretation, description, factor, action, justification, etc.) DOIVENT être rédigés EN FRANÇAIS

Structure JSON attendue (TOUS LES TEXTES EN FRANÇAIS) :
{
  "prediction": {
    "summary": "string EN FRANÇAIS (synthèse claire de la projection en une phrase)",
    "values": [
      { "key": "string", "value": number, "horizon": "string|null" }
    ]
  },
  "interpretation": "string EN FRANÇAIS (4-7 phrases claires expliquant comment les contextes influencent concrètement la projection)",
  "risks": [
    {
      "factor": "string EN FRANÇAIS (nom du risque)",
      "description": "string EN FRANÇAIS (explication accessible liée aux contextes)",
      "probability": 0.75,    // nombre entre 0.0 et 1.0
      "impact": "high" | "medium" | "low"
    }
  ],
  "opportunities": [
    {
      "description": "string EN FRANÇAIS (opportunité concrète identifiée)",
      "impact": 0.8  // nombre entre 0.0 et 1.0
    }
  ],
  "recommendations": [
    {
      "priority": 1,  // entier >=1
      "action": "string EN FRANÇAIS (action concrète et opérationnelle)",
      "justification": "string EN FRANÇAIS (explication du pourquoi de cette recommandation, liée aux contextes et aux prédictions)"
    }
  ],
  "confidence": 0.85,  // nombre entre 0.0 et 1.0
  "metadata": {
    "time": "string|null",
    "weather": "string|null",
    "economy": {},
    "demography": {}
  }
}

DIRECTIVES DE RÉDACTION (LANGUE: FRANÇAIS OBLIGATOIRE):

1) INTERPRETATION (section clé - RÉDIGEZ EN FRANÇAIS):
   • Expliquez les résultats des modèles prédictifs de manière ACCESSIBLE et CONCRÈTE EN FRANÇAIS
   • Au lieu de dire "la régression linéaire prévoit +5%", dites "la croissance démographique soutient une hausse modérée de 5%"
   • Reliez TOUJOURS les chiffres aux facteurs contextuels réels (saison, météo, économie)
   • Style: professionnel mais pédagogique EN FRANÇAIS, évitez le jargon technique excessif
   • Objectif: que le lecteur comprenne POURQUOI telle projection, pas seulement COMBIEN
   • ⚠️ ATTENTION: Ne traduisez JAMAIS vers l'anglais, restez en français

2) RISKS (RÉDIGEZ EN FRANÇAIS):
   • Identifiez les vulnérabilités en termes simples et liées aux contextes fournis EN FRANÇAIS
   • Probability: nombre décimal (ex: 0.65 pour "probable à 65%")
   • Impact: "low", "medium", ou "high"
   • TOUS les textes (factor, description) DOIVENT être en français

3) OPPORTUNITIES (RÉDIGEZ EN FRANÇAIS):
   • Mettez en lumière les leviers d'amélioration détectés par les modèles EN FRANÇAIS
   • Exprimez l'impact potentiel en termes compréhensibles EN FRANÇAIS
   • Le champ description DOIT être en français

4) RECOMMENDATIONS (RÉDIGEZ EN FRANÇAIS):
   • Chaque recommandation DOIT inclure:
     - priority: ordre d'importance (1 = le plus urgent)
     - action: description claire de l'action à entreprendre EN FRANÇAIS
     - justification: explication du pourquoi EN FRANÇAIS (basée sur les prédictions, contextes, risques ou opportunités identifiés)
   • La justification doit établir le lien entre l'action recommandée et l'analyse effectuée
   • ⚠️ TOUS LES TEXTES en français (action, justification)

5) CONFIDENCE:
   • Reflète la cohérence des signaux prédictifs et la qualité des données contextuelles
   • Convergence forte (écart <5%) → confidence > 0.8
   • Divergence notable (écart >10%) → confidence < 0.7

IMPORTANT: Votre valeur ajoutée réside dans l'INTERPRÉTATION intelligible des signaux quantitatifs, pas dans leur simple répétition. Traduisez les pourcentages en insights opérationnels.

⚠️⚠️⚠️ RAPPEL FINAL IMPÉRATIF ⚠️⚠️⚠️
RÉPONDEZ INTÉGRALEMENT EN LANGUE FRANÇAISE.
AUCUN MOT EN ANGLAIS N'EST ACCEPTÉ dans les champs textuels.
Si vous répondez en anglais, votre réponse sera REJETÉE.
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
    const detailedInstructions: string[] = [];
    
    // revenue category context for enhanced precision
    if (extraContext.revenue) {
      contextParts.push(`Catégorie de revenu: ${extraContext.revenue.category || 'Non spécifiée'}`);
      detailedInstructions.push(`- Type de revenu: "${extraContext.revenue.category}" (montant initial: ${extraContext.revenue.originalAmount}, nouveau montant: ${extraContext.revenue.newAmount}). Analysez comment cette catégorie spécifique de revenu est influencée par les contextes saisonniers, météorologiques et économiques. Considérez les particularités de ce type de revenu (périodicité naturelle, sensibilité aux saisons, dépendance au contexte économique local).`);
    }
    
    // time context with specific guidance
    if (extraContext.time) {
      contextParts.push(`Contexte temporel: ${JSON.stringify(extraContext.time)}`);
      
      // Enhanced seasonal analysis for multi-month simulations
      const seasonsCovered = extraContext.time.seasonsCovered || [extraContext.time.season];
      const startSeason = extraContext.time.startSeason || extraContext.time.season;
      const endSeason = extraContext.time.endSeason || extraContext.time.season;
      const period = extraContext.time.period || 1;
      
      if (seasonsCovered.length > 1) {
        detailedInstructions.push(`- Période multi-saisonnière (${period} mois): Du ${startSeason} au ${endSeason}, couvrant ${seasonsCovered.join(', ')}. Analysez comment CHAQUE saison traversée affecte différemment les revenus (variations saisonnières de demande, cycles touristiques, périodes agricoles, comportements de consommation selon les saisons).`);
      } else if (startSeason) {
        detailedInstructions.push(`- Saison unique: ${startSeason} (${period} mois). Analysez l'impact de cette saison sur les revenus (haute/basse saison touristique, périodes de récolte, variations de consommation).`);
      }
      
      if (extraContext.time.startDate && extraContext.time.endDate) {
        detailedInstructions.push(`- Période complète: Du ${extraContext.time.startDate} au ${extraContext.time.endDate}. Considérez les événements calendaires, fêtes, périodes fiscales qui pourraient influencer les revenus durant cette période.`);
      }
      
      if (extraContext.time.trend) {
        detailedInstructions.push(`- Tendance globale: variation de ${extraContext.time.trend.percentChange?.toFixed(2) || 'N/A'}% sur la période. Expliquez si cette tendance est soutenable compte tenu des contextes saisonniers et économiques.`);
      }
    }
    
    // weather/climate with impact analysis
    if (extraContext.weather) {
      contextParts.push(`Météo/Climat: ${JSON.stringify(extraContext.weather)}`);
      detailedInstructions.push(`- Conditions météorologiques actuelles: Analysez l'impact potentiel sur les activités économiques (agriculture, tourisme, commerce). IMPORTANT: Considérez comment ces conditions peuvent évoluer sur toute la durée de la simulation et leur impact cumulé. Identifiez les risques climatiques saisonniers (sécheresse estivale, pluies, températures extrêmes).`);
    }
    
    // economic context with indicators
    if (extraContext.economy || extraContext.indicators) {
      const ecoData = extraContext.economy || extraContext.indicators || {};
      contextParts.push(`Contexte économique: ${JSON.stringify(ecoData)}`);
      const gdp = ecoData.gdp || ecoData.imf_gdp;
      const population = ecoData.population;
      if (gdp || population) {
        detailedInstructions.push(`- Indicateurs économiques: PIB=${gdp || 'N/A'}, Population=${population || 'N/A'}. Évaluez l'impact du contexte macroéconomique sur la projection. Considérez l'inflation, le pouvoir d'achat, les cycles économiques, et leur évolution probable sur la période de simulation.`);
      }
    }
    
    // demographic context
    if (extraContext.demography) {
      contextParts.push(`Contexte démographique: ${JSON.stringify(extraContext.demography)}`);
      detailedInstructions.push(`- Démographie: Analysez comment la structure démographique (densité, âge moyen, croissance) influence les revenus projetés sur toute la période. Identifiez les segments de population cibles et leur capacité contributive selon les saisons.`);
    }

    // Season from simulation parameters if not in extraContext
    const seasonFromSim = (sim as any).parameters?.seasonContext?.season;
    if (seasonFromSim && !extraContext.time?.season) {
      detailedInstructions.push(`- Saison (paramètre): ${seasonFromSim}. Intégrez l'effet saisonnier dans votre analyse des risques et opportunités.`);
    }

    // ============================================================================
    // PRÉDICTIONS QUANTITATIVES - SECTION CRUCIALE
    // ============================================================================
    if (extraContext.predictions) {
      const pred = extraContext.predictions;
      contextParts.push(`Prédictions quantitatives: ${JSON.stringify(pred)}`);
      
      const methodsUsed = [];
      if (pred.methods?.linear?.used) methodsUsed.push('tendances historiques');
      if (pred.methods?.neural?.used) methodsUsed.push('apprentissage automatique');
      if (pred.methods?.seasonal?.used) methodsUsed.push('cycles saisonniers');
      
      // Calculer les écarts pour évaluer la convergence
      const predictions = [pred.linear || 0, pred.neural || 0, pred.seasonal || 0].filter(v => v !== 0);
      const maxPred = Math.max(...predictions);
      const minPred = Math.min(...predictions);
      const spreadPercent = predictions.length > 1 ? ((maxPred - minPred) / Math.abs(pred.average || 1) * 100) : 0;
      const isConvergent = spreadPercent <= 5;
      
      detailedInstructions.push(`
ANALYSE PRÉDICTIVE MULTI-APPROCHES:
================================================================================
Nos modèles prévisionnels suggèrent une variation moyenne de ${pred.average?.toFixed(1) || 'N/A'}% par rapport à la baseline de ${pred.baseline?.toLocaleString() || 'N/A'} MGA.

SIGNAUX QUANTITATIFS:
• Analyse des tendances: ${pred.linear?.toFixed(1) || 'N/A'}% — Projection fondée sur l'évolution démographique et économique observée
• Modélisation avancée: ${pred.neural?.toFixed(1) || 'N/A'}% — Détection des interactions complexes entre climat, saison et contexte socio-économique
• Ajustement saisonnier: ${pred.seasonal?.toFixed(1) || 'N/A'}% — Prise en compte des cycles récurrents propres à cette catégorie de recettes

INTERPRÉTATION ATTENDUE:
Vous devez produire une analyse synthétique et accessible qui:

1) EXPLIQUE LA COHÉRENCE DES SIGNAUX:
   ${isConvergent 
     ? `Les trois approches convergent (écart < 5%), ce qui témoigne d'une forte cohérence et justifie un niveau de confiance élevé (>0.8). Expliquez pourquoi les facteurs contextuels (saison, météo, économie) conduisent à cet alignement.`
     : `Les approches présentent des divergences notables (écart ~${spreadPercent.toFixed(1)}%), révélant des incertitudes. Expliquez les facteurs qui peuvent justifier ces écarts : volatilité saisonnière accentuée, sensibilité climatique variable, ou effets économiques non-linéaires.`
   }

2) TRADUIT LES RÉSULTATS EN TERMES CONCRETS:
   Ne vous contentez pas de répéter les pourcentages. Expliquez ce qu'ils impliquent concrètement pour Madagascar :
   • Si hausse prévue: Quels facteurs contextuels (croissance démographique, reprise économique, saison favorable) la soutiennent?
   • Si baisse anticipée: Quelles vulnérabilités (climat défavorable, récession, basse saison) l'expliquent?
   • Reliez toujours aux contextes fournis (météo, saison, indicateurs économiques).

3) IDENTIFIE LES OPPORTUNITÉS ET RISQUES:
   • Opportunités: Tirez parti des signaux positifs convergents (ex: si les 3 méthodes prévoient une hausse en haute saison touristique)
   • Risques: Soulignez les divergences et leurs causes (ex: si le modèle climatique détecte un risque de sécheresse non capté par les tendances historiques)

4) PROPOSE DES RECOMMANDATIONS ACTIONNABLES:
   Formulez des actions concrètes basées sur l'interprétation des signaux, en tenant compte des contextes multidimensionnels.

REGISTRE: Maintenez un style professionnel et accessible, sans jargon technique excessif. Privilégiez la clarté et la pertinence opérationnelle.
================================================================================
      `.trim());
    }

    const simJson = JSON.stringify(sim.parameters || {});
    const analysisJson = JSON.stringify(analysis.resultData || {});

    const instruction = `Vous êtes un expert financier/analyste capable d'intégrer le contexte temporel, météorologique, économique et démographique dans vos analyses. 

⚠️ LANGUE OBLIGATOIRE: Répondez UNIQUEMENT EN FRANÇAIS. Aucun mot en anglais n'est autorisé.

MISSION: Analysez cette simulation de revenus en tenant compte OBLIGATOIREMENT des contextes fournis ci-dessous, EN PARTICULIER les variations saisonnières sur TOUTE LA DURÉE de la simulation.

CONTEXTES À INTÉGRER:
${detailedInstructions.length > 0 ? detailedInstructions.join('\n') : '- Aucun contexte spécifique fourni. Basez votre analyse uniquement sur les données de simulation.'}

INSTRUCTIONS DE SORTIE:
Produisez UN OBJET JSON structuré (sans Markdown, sans backticks) contenant:
- prediction: résumé chiffré avec valeurs clés et horizons temporels
- interpretation: explication détaillée (4-7 phrases) montrant EXPLICITEMENT comment les contextes (saisons traversées, météo, économie, démographie) influencent la projection sur TOUTE LA PÉRIODE
- risks: facteurs de risque LIÉS AUX CONTEXTES et à leur évolution temporelle (ex: risque climatique selon les saisons, risque économique, risques saisonniers spécifiques)
- opportunities: opportunités identifiées À PARTIR DES CONTEXTES et des variations saisonnières (ex: exploiter les hautes saisons, profiter de la croissance démographique)
- recommendations: actions concrètes priorisant l'adaptation aux contextes et aux cycles saisonniers
- confidence: score 0-1 basé sur la qualité/disponibilité des données contextuelles
- metadata: résumé des contextes utilisés (time, weather, economy, demography avec valeurs non-null)

ATTENTION: Votre analyse DOIT démontrer que vous avez utilisé les contextes fournis. Ne produisez PAS une analyse générique.`;

  const prompt = `${instruction}

=== PARAMÈTRES DE SIMULATION ===
${simJson}

=== RÉSULTATS/DONNÉES ===
${analysisJson}

=== CONTEXTES DISPONIBLES ===
${contextParts.join('\n') || 'Aucun contexte additionnel'}
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

    // Log contexts for debugging
    console.log('[AI enrichAnalysis] Contexts provided:', {
      hasTime: !!extraContext.time,
      hasWeather: !!extraContext.weather,
      hasEconomy: !!extraContext.economy,
      hasDemography: !!extraContext.demography,
      hasSeason: !!extraContext.time?.season || !!(sim as any)?.parameters?.seasonContext?.season,
      season: extraContext.time?.season || (sim as any)?.parameters?.seasonContext?.season || 'unknown',
      contextKeys: Object.keys(extraContext)
    });

    // ============================================================================
    // APPLIQUER LES MÉTHODES DE PRÉDICTION QUANTITATIVES
    // ============================================================================
    try {
      const city = (sim?.parameters as any)?.city || 'Antananarivo';
      const recipeType = (sim?.parameters as any)?.recipeType || 'TVA';
      
      console.log('[AI enrichAnalysis] Applying prediction methods with:', {
        city,
        recipeType,
        fromParameters: {
          city: (sim?.parameters as any)?.city,
          recipeType: (sim?.parameters as any)?.recipeType
        }
      });
      
      const predictions: PredictionResults = await applyPredictionMethods(
        sim || (analysis as any).simulation,
        city,
        recipeType,
        extraContext
      );

      // Injecter les prédictions dans extraContext pour utilisation dans le prompt
      extraContext.predictions = predictions;
      
      console.log('[AI enrichAnalysis] Predictions computed:', {
        linear: predictions.linear.toFixed(2) + '%',
        neural: predictions.neural.toFixed(2) + '%',
        seasonal: predictions.seasonal.toFixed(2) + '%',
        average: predictions.average.toFixed(2) + '%',
      });
    } catch (predictionError) {
      console.error('[AI enrichAnalysis] Prediction methods failed:', predictionError);
      // Ne pas bloquer l'analyse si les prédictions échouent
      extraContext.predictions = {
        error: String(predictionError),
        linear: 0,
        neural: 0,
        seasonal: 0,
        average: 0,
      };
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
          max_tokens: 2048,
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
              aiProvider: AI_PROVIDER,
              aiModel: OPENAI_FALLBACK_MODEL,
              aiAt: new Date().toISOString(),
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
            aiProvider: AI_PROVIDER,
            aiModel: OPENAI_MODEL,
            aiAt: new Date().toISOString(),
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
          max_tokens: 2048,
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
          aiProvider: AI_PROVIDER,
          aiModel: GEMINI_MODEL,
          aiAt: new Date().toISOString(),
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
                generationConfig: { maxOutputTokens: 2048, temperature: 0.2 }
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
                        generationConfig: { maxOutputTokens: 2048, temperature: 0.2 }
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
                  generationConfig: { maxOutputTokens: 2048, temperature: 0.2 }
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
            { body: { contents: [{ parts: [{ text: p }] }], generationConfig: { maxOutputTokens: 2048, temperature: 0.2 } }, name: 'contents+generationConfig' },
            // Some older endpoints/clients used a `prompt.text` shape; try with generationConfig if accepted
            { body: { prompt: { text: p }, generationConfig: { maxOutputTokens: 2048, temperature: 0.2 } }, name: 'prompt.text+generationConfig' },
            { body: { input: p, maxOutputTokens: 2048, temperature: 0.2 }, name: 'input' },
            { body: { instances: [{ input: p }], parameters: { maxOutputTokens: 2048, temperature: 0.2 } }, name: 'instances+parameters' },
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
            aiProvider: AI_PROVIDER,
            aiModel: usedModel,
            aiAt: new Date().toISOString(),
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
          aiProvider: AI_PROVIDER,
          aiModel: usedModel || GEMINI_MODEL,
          aiAt: new Date().toISOString(),
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
          const res = await axios.post(url, { contents: [{ parts: [{ text: p }] }], generationConfig: { maxOutputTokens: 2048, temperature: 0.2 } }, { headers });
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
