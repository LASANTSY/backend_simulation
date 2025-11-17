"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
const data_source_1 = __importDefault(require("../data-source"));
const AnalysisResult_1 = require("../entities/AnalysisResult");
const Simulation_1 = require("../entities/Simulation");
const openai_1 = require("openai");
const axios_1 = __importDefault(require("axios"));
const ajv_1 = __importDefault(require("ajv"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const metrics_service_1 = require("../monitoring/metrics.service");
const llm_parser_1 = require("./llm-parser");
const context_service_1 = __importDefault(require("../context/context.service"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const AI_PROVIDER = process.env.AI_PROVIDER || 'openai';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4';
const OPENAI_FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL || 'gpt-3.5-turbo';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_SYSTEM_PROMPT = `Vous êtes un assistant d'analyse financière automatique spécialisé dans l'intégration de contextes multidimensionnels (temporel, météorologique, économique, démographique).

RÈGLE ABSOLUE: Vous devez RÉPONDRE UNIQUEMENT par un objet JSON valide correspondant EXACTEMENT au schéma demandé et RIEN D'AUTRE (pas d'explications, pas de Markdown, pas de backticks, pas de commentaires, pas de texte avant/après le JSON).

La structure exacte attendue est :
{
  "prediction": {
    "summary": "string (une phrase décrivant la projection)",
    "values": [
      { "key": "string", "value": number, "horizon": "string|null" }
    ]
  },
  "interpretation": "string (4-7 phrases DÉMONTRANT comment les contextes influencent la projection)",
  "risks": [
    {
      "factor": "string (nom court du risque)",
      "description": "string (description détaillée LIÉE aux contextes fournis)",
      "probability": 0.75,    // NOMBRE entre 0.0 et 1.0
      "impact": "high" | "medium" | "low"
    }
  ],
  "opportunities": [
    {
      "description": "string (opportunité IDENTIFIÉE à partir des contextes)",
      "impact": 0.8  // NOMBRE entre 0.0 et 1.0
    }
  ],
  "recommendations": [
    {
      "priority": 1,  // ENTIER >=1
      "action": "string (action concrète prenant en compte les contextes)"
    }
  ],
  "confidence": 0.85,  // NOMBRE entre 0.0 et 1.0
  "metadata": {
    "time": "string|null (résumé du contexte temporel utilisé)",
    "weather": "string|null (résumé des conditions météo considérées)",
    "economy": {},  // objet vide ou avec indicateurs économiques
    "demography": {}  // objet vide ou avec données démographiques
  }
}

RÈGLES STRICTES OBLIGATOIRES:
1) Retournez STRICTEMENT le JSON ci-dessus et AUCUNE propriété supplémentaire (additionalProperties interdites).
2) prediction.summary: string, décrivant la projection chiffrée.
3) prediction.values: tableau d'OBJETS { "key": string, "value": number, "horizon": string|null }. NON des nombres bruts.
4) interpretation: string de 4-7 phrases montrant EXPLICITEMENT comment saison/météo/économie/démographie influencent les résultats.
5) risks: tableau d'objets avec factor (optionnel), description (OBLIGATOIRE, liée aux contextes), probability (OBLIGATOIRE, nombre 0-1), impact (optionnel: "low"|"medium"|"high").
6) opportunities: tableau d'objets { "description": string (issue des contextes), "impact": number (0-1) }. Si aucune, retournez [].
7) recommendations: tableau d'objets { "priority": integer >=1, "action": string }. Actions adaptées aux contextes.
8) confidence: nombre 0-1 reflétant la qualité des contextes disponibles.
9) metadata: objet avec time, weather, economy, demography. Si pas d'info, mettez null ou {}.
10) AUCUNE valeur textuelle pour probability/impact numériques (uniquement number).
11) PAS de Markdown, PAS de code fences \`\`\`, PAS de prose autour: UNIQUEMENT LE JSON.
12) Votre analyse DOIT démontrer l'utilisation des contextes. Ne générez PAS d'analyse générique sans lien avec les données contextuelles fournies.

EXEMPLES VALIDES:
- probability: 0.3, 0.65, 0.9 (nombres, pas "30%" ou "high")
- priority: 1, 2, 3 (entiers)
- impact (string): "low", "medium", "high"
- impact (number pour opportunities): 0.7, 0.85

Si vous avez compris, répondez UNIQUEMENT par le JSON structuré demandé lorsqu'on vous fournira les données de simulation.
`;
class AIService {
    constructor() {
        this.analysisRepo = data_source_1.default.getRepository(AnalysisResult_1.AnalysisResult);
        this.simulationRepo = data_source_1.default.getRepository(Simulation_1.Simulation);
        if (AI_PROVIDER === 'openai') {
            if (!OPENAI_API_KEY) {
                console.warn('OPENAI_API_KEY not set; AI calls will fail until configured.');
            }
            this.client = new openai_1.OpenAI({ apiKey: OPENAI_API_KEY });
        }
        else if (AI_PROVIDER === 'gemini') {
            if (!GEMINI_API_KEY) {
                console.warn('GEMINI_API_KEY not set; Gemini calls will fail until configured.');
            }
            this.client = null;
        }
        else {
            this.client = null;
        }
    }
    static extractGeminiTextFromData(data) {
        var _a, _b, _c;
        try {
            if (!data)
                return null;
            const cand = (_a = data === null || data === void 0 ? void 0 : data.candidates) === null || _a === void 0 ? void 0 : _a[0];
            const content = cand === null || cand === void 0 ? void 0 : cand.content;
            const parts = content === null || content === void 0 ? void 0 : content.parts;
            if (Array.isArray(parts) && parts.length > 0) {
                const texts = parts.map((p) => (typeof (p === null || p === void 0 ? void 0 : p.text) === 'string' ? p.text : '')).filter(Boolean);
                if (texts.length)
                    return texts.join('');
            }
            if (typeof (content === null || content === void 0 ? void 0 : content.text) === 'string')
                return content.text;
            if (typeof content === 'string')
                return content;
            const output = data === null || data === void 0 ? void 0 : data.output;
            if (typeof output === 'string')
                return output;
            if (Array.isArray(output) && output.length) {
                const o0 = output[0];
                if (typeof o0 === 'string')
                    return o0;
                if (((_b = o0 === null || o0 === void 0 ? void 0 : o0.content) === null || _b === void 0 ? void 0 : _b.parts) && Array.isArray(o0.content.parts)) {
                    const texts = o0.content.parts.map((p) => (typeof (p === null || p === void 0 ? void 0 : p.text) === 'string' ? p.text : '')).filter(Boolean);
                    if (texts.length)
                        return texts.join('');
                }
                if (typeof ((_c = o0 === null || o0 === void 0 ? void 0 : o0.content) === null || _c === void 0 ? void 0 : _c.text) === 'string')
                    return o0.content.text;
            }
            if (typeof (data === null || data === void 0 ? void 0 : data.text) === 'string')
                return data.text;
            if (typeof data === 'string')
                return data;
            console.warn('[extractGeminiTextFromData] No text found in response structure:', JSON.stringify(data).slice(0, 500));
            return null;
        }
        catch (err) {
            console.error('[extractGeminiTextFromData] Extraction error:', err);
            return null;
        }
    }
    static cleanLLMText(raw) {
        if (!raw || typeof raw !== 'string')
            return '';
        const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (fenced && fenced[1])
            return fenced[1].trim();
        return raw.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, '')).trim();
    }
    static loadSchemaOnce() {
        if (AIService._validateFn)
            return;
        try {
            const ajv = new ajv_1.default({ allErrors: true, strict: true, coerceTypes: false });
            (0, ajv_formats_1.default)(ajv);
            const schemaPath = path.join(__dirname, 'schemas', 'analysis-result.schema.json');
            const schemaText = fs.readFileSync(schemaPath, 'utf8');
            const schema = JSON.parse(schemaText);
            AIService._schema = schema;
            AIService._ajv = ajv;
            AIService._validateFn = ajv.compile(schema);
        }
        catch (e) {
            AIService._validateFn = null;
            AIService._schema = null;
        }
    }
    static validateLLMOutputRaw(rawText) {
        var _a;
        AIService.loadSchemaOnce();
        if (!AIService._validateFn)
            return { valid: true, errors: null, parsed: null };
        try {
            const jsonText = (_a = (0, llm_parser_1.extractJSON)(rawText)) !== null && _a !== void 0 ? _a : rawText;
            const parsed = JSON.parse(jsonText);
            const valid = AIService._validateFn(parsed);
            return { valid: Boolean(valid), errors: AIService._validateFn.errors, parsed };
        }
        catch (e) {
            return { valid: false, errors: [{ message: String(e) }], parsed: null };
        }
    }
    _attemptShapeNormalization(raw, analysis) {
        var _a, _b;
        try {
            const jsonText = (_a = (0, llm_parser_1.extractJSON)(raw)) !== null && _a !== void 0 ? _a : raw;
            const data = JSON.parse(jsonText);
            let mutated = false;
            const ensure = (k, v) => { if (!(k in data)) {
                data[k] = v;
                mutated = true;
            } };
            ensure('interpretation', 'placeholder interpretation');
            ensure('opportunities', []);
            ensure('confidence', 0.5);
            ensure('metadata', { time: null, weather: null, economy: {}, demography: {} });
            if (data.metadata && typeof data.metadata === 'object') {
                if (data.metadata.time && typeof data.metadata.time === 'string') {
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
                    const months = (((_b = analysis === null || analysis === void 0 ? void 0 : analysis.resultData) === null || _b === void 0 ? void 0 : _b.months) && Array.isArray(analysis.resultData.months)) ? analysis.resultData.months : [];
                    data.prediction.values = arr.map((v, idx) => {
                        var _a, _b;
                        return ({
                            key: (_a = months[idx]) !== null && _a !== void 0 ? _a : `value_${idx}`,
                            value: typeof v === 'number' ? v : Number(v),
                            horizon: (_b = months[idx]) !== null && _b !== void 0 ? _b : null
                        });
                    });
                    mutated = true;
                }
            }
            if (Array.isArray(data.risks)) {
                data.risks = data.risks.map((r) => {
                    var _a, _b;
                    if (r && typeof r === 'object') {
                        const normalized = {
                            description: (_b = (_a = r.description) !== null && _a !== void 0 ? _a : r.factor) !== null && _b !== void 0 ? _b : 'Unknown risk',
                            probability: typeof r.probability === 'number' ? r.probability : 0.5
                        };
                        if (r.factor)
                            normalized.factor = r.factor;
                        if (r.impact)
                            normalized.impact = r.impact;
                        return normalized;
                    }
                    return r;
                });
                mutated = true;
            }
            if (!mutated)
                return null;
            return { _wasNormalized: true, data };
        }
        catch {
            return null;
        }
    }
    validateLLMOutput(response) {
        return AIService.validateLLMOutputRaw(response);
    }
    async retryValidateAndRepair(initialText, prompt, modelCaller, retries = 3) {
        var _a, _b, _c, _d, _e, _f;
        let check = AIService.validateLLMOutputRaw(initialText);
        if (check.valid && check.parsed)
            return check.parsed;
        console.error('LLM validation failed for initial response:', { errors: check.errors, raw: initialText });
        metrics_service_1.llmValidationFailures.inc();
        for (let i = 0; i < retries; i++) {
            const improved = `${prompt}\n\nIMPORTANT: respond with valid JSON matching this schema: ${JSON.stringify(AIService._schema || {})}`;
            try {
                const text = await modelCaller(improved);
                if (!text || text.trim() === '') {
                    console.error(`LLM call returned empty text on retry #${i + 1}`);
                    metrics_service_1.llmValidationFailures.inc();
                    continue;
                }
                const res = AIService.validateLLMOutputRaw(text);
                if (res.valid && res.parsed)
                    return res.parsed;
                console.error(`LLM validation failed on retry #${i + 1}:`, { errors: res.errors, raw: text });
                metrics_service_1.llmValidationFailures.inc();
            }
            catch (e) {
                try {
                    const status = (_c = (_b = (_a = e === null || e === void 0 ? void 0 : e.response) === null || _a === void 0 ? void 0 : _a.status) !== null && _b !== void 0 ? _b : e === null || e === void 0 ? void 0 : e.status) !== null && _c !== void 0 ? _c : null;
                    const data = (_f = (_e = (_d = e === null || e === void 0 ? void 0 : e.response) === null || _d === void 0 ? void 0 : _d.data) !== null && _e !== void 0 ? _e : e === null || e === void 0 ? void 0 : e.data) !== null && _f !== void 0 ? _f : null;
                    console.error(`LLM call error during retry #${i + 1}: status=${status}`, data !== null && data !== void 0 ? data : e);
                }
                catch (logErr) {
                    console.error(`LLM call error during retry #${i + 1}:`, e);
                }
                metrics_service_1.llmValidationFailures.inc();
            }
        }
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
    buildPrompt(sim, analysis, extraContext = {}) {
        var _a, _b, _c, _d, _e, _f;
        const contextParts = [];
        const detailedInstructions = [];
        if (extraContext.time) {
            contextParts.push(`Contexte temporel: ${JSON.stringify(extraContext.time)}`);
            const season = extraContext.time.season || ((_b = (_a = sim.parameters) === null || _a === void 0 ? void 0 : _a.seasonContext) === null || _b === void 0 ? void 0 : _b.season);
            if (season) {
                detailedInstructions.push(`- Saison: ${season}. Analysez comment cette saison affecte les revenus (ex: haute/basse saison touristique, périodes de récolte, variations saisonnières de consommation).`);
            }
            if (extraContext.time.trend) {
                detailedInstructions.push(`- Tendance: variation de ${((_c = extraContext.time.trend.percentChange) === null || _c === void 0 ? void 0 : _c.toFixed(2)) || 'N/A'}%. Expliquez si cette tendance est soutenable compte tenu du contexte.`);
            }
        }
        if (extraContext.weather) {
            contextParts.push(`Météo/Climat: ${JSON.stringify(extraContext.weather)}`);
            detailedInstructions.push(`- Conditions météorologiques: Analysez l'impact potentiel sur les activités économiques (agriculture, tourisme, commerce). Identifiez les risques climatiques (sécheresse, inondations, canicule) et leurs probabilités.`);
        }
        if (extraContext.economy || extraContext.indicators) {
            const ecoData = extraContext.economy || extraContext.indicators || {};
            contextParts.push(`Contexte économique: ${JSON.stringify(ecoData)}`);
            const gdp = ecoData.gdp || ecoData.imf_gdp;
            const population = ecoData.population;
            if (gdp || population) {
                detailedInstructions.push(`- Indicateurs économiques: PIB=${gdp || 'N/A'}, Population=${population || 'N/A'}. Évaluez l'impact du contexte macroéconomique sur la projection. Considérez l'inflation, le pouvoir d'achat, et les cycles économiques.`);
            }
        }
        if (extraContext.demography) {
            contextParts.push(`Contexte démographique: ${JSON.stringify(extraContext.demography)}`);
            detailedInstructions.push(`- Démographie: Analysez comment la structure démographique (densité, âge moyen, croissance) influence les revenus projetés. Identifiez les segments de population cibles et leur capacité contributive.`);
        }
        const seasonFromSim = (_e = (_d = sim.parameters) === null || _d === void 0 ? void 0 : _d.seasonContext) === null || _e === void 0 ? void 0 : _e.season;
        if (seasonFromSim && !((_f = extraContext.time) === null || _f === void 0 ? void 0 : _f.season)) {
            detailedInstructions.push(`- Saison (paramètre): ${seasonFromSim}. Intégrez l'effet saisonnier dans votre analyse des risques et opportunités.`);
        }
        const simJson = JSON.stringify(sim.parameters || {});
        const analysisJson = JSON.stringify(analysis.resultData || {});
        const instruction = `Vous êtes un expert financier/analyste capable d'intégrer le contexte temporel, météorologique, économique et démographique dans vos analyses. 

MISSION: Analysez cette simulation de revenus en tenant compte OBLIGATOIREMENT des contextes fournis ci-dessous.

CONTEXTES À INTÉGRER:
${detailedInstructions.length > 0 ? detailedInstructions.join('\n') : '- Aucun contexte spécifique fourni. Basez votre analyse uniquement sur les données de simulation.'}

INSTRUCTIONS DE SORTIE:
Produisez UN OBJET JSON structuré (sans Markdown, sans backticks) contenant:
- prediction: résumé chiffré avec valeurs clés et horizons temporels
- interpretation: explication détaillée (4-7 phrases) montrant EXPLICITEMENT comment les contextes (saison, météo, économie, démographie) influencent la projection
- risks: facteurs de risque LIÉS AUX CONTEXTES (ex: risque climatique si météo défavorable, risque économique si récession, risque saisonnier)
- opportunities: opportunités identifiées À PARTIR DES CONTEXTES (ex: exploiter la haute saison, profiter de la croissance démographique)
- recommendations: actions concrètes priorisant l'adaptation aux contextes identifiés
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
    async enrichAnalysis(analysisId, extraContext = {}) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12;
        const analysis = await this.analysisRepo.findOne({ where: { id: analysisId }, relations: ['simulation'] });
        if (!analysis)
            throw new Error('AnalysisResult not found');
        const sim = analysis.simulation;
        if (!extraContext || Object.keys(extraContext).length === 0) {
            try {
                extraContext = await context_service_1.default.fetchContextForSimulation(sim || analysis.simulation);
            }
            catch (e) {
                extraContext = { _contextError: String(e) };
            }
        }
        console.log('[AI enrichAnalysis] Contexts provided:', {
            hasTime: !!extraContext.time,
            hasWeather: !!extraContext.weather,
            hasEconomy: !!extraContext.economy,
            hasDemography: !!extraContext.demography,
            hasSeason: !!((_a = extraContext.time) === null || _a === void 0 ? void 0 : _a.season) || !!((_c = (_b = sim === null || sim === void 0 ? void 0 : sim.parameters) === null || _b === void 0 ? void 0 : _b.seasonContext) === null || _c === void 0 ? void 0 : _c.season),
            season: ((_d = extraContext.time) === null || _d === void 0 ? void 0 : _d.season) || ((_f = (_e = sim === null || sim === void 0 ? void 0 : sim.parameters) === null || _e === void 0 ? void 0 : _e.seasonContext) === null || _f === void 0 ? void 0 : _f.season) || 'unknown',
            contextKeys: Object.keys(extraContext)
        });
        const prompt = this.buildPrompt(sim || analysis.simulation, analysis, extraContext);
        if (AI_PROVIDER === 'openai') {
            if (!this.client)
                throw new Error('OpenAI client not configured');
            const callModel = async (modelName) => {
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
            let resp;
            let usedModel = OPENAI_MODEL;
            try {
                resp = await callModel(OPENAI_MODEL);
            }
            catch (err) {
                const msg = (err === null || err === void 0 ? void 0 : err.message) || String(err);
                const status = (err === null || err === void 0 ? void 0 : err.status) || (err === null || err === void 0 ? void 0 : err.statusCode) || (err === null || err === void 0 ? void 0 : err.code);
                if (status === 404 || /does not exist|not found|model error|You do not have access/i.test(msg)) {
                    try {
                        console.warn(`OpenAI model ${OPENAI_MODEL} not available (status=${status}). Retrying with fallback model ${OPENAI_FALLBACK_MODEL}.`);
                        resp = await callModel(OPENAI_FALLBACK_MODEL);
                        usedModel = OPENAI_FALLBACK_MODEL;
                    }
                    catch (err2) {
                        const finalErr = err2 || err;
                        const textErr = (finalErr === null || finalErr === void 0 ? void 0 : finalErr.message) || String(finalErr);
                        const updatedErrAnalysis = analysis;
                        updatedErrAnalysis.resultData = {
                            ...updatedErrAnalysis.resultData,
                            aiError: textErr,
                        };
                        await this.analysisRepo.save(updatedErrAnalysis);
                        throw new Error(`AI provider error: ${textErr}`);
                    }
                }
                else {
                    const textErr = msg;
                    const updatedErrAnalysis = analysis;
                    updatedErrAnalysis.resultData = {
                        ...updatedErrAnalysis.resultData,
                        aiError: textErr,
                    };
                    await this.analysisRepo.save(updatedErrAnalysis);
                    throw err;
                }
            }
            let text = (_o = (_k = (_j = (_h = (_g = resp.choices) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.message) === null || _j === void 0 ? void 0 : _j.content) !== null && _k !== void 0 ? _k : (_m = (_l = resp.choices) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.text) !== null && _o !== void 0 ? _o : '';
            const modelCaller = async (p) => {
                var _a, _b, _c, _d, _e, _f, _g;
                const resp2 = await this.client.chat.completions.create({
                    model: usedModel || OPENAI_MODEL,
                    messages: [
                        { role: 'system', content: 'You produce only JSON responses when asked.' },
                        { role: 'user', content: p },
                    ],
                    max_tokens: 800,
                    temperature: 0.2,
                });
                return (_g = (_d = (_c = (_b = (_a = resp2.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) !== null && _d !== void 0 ? _d : (_f = (_e = resp2.choices) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.text) !== null && _g !== void 0 ? _g : '';
            };
            const parsed = await this.retryValidateAndRepair(text, prompt, modelCaller, 3);
            const updated = analysis;
            updated.resultData = {
                ...updated.resultData,
                aiAnalysis: parsed,
                aiRaw: text,
                aiProvider: AI_PROVIDER,
                aiModel: usedModel || OPENAI_MODEL,
                aiAt: new Date().toISOString(),
            };
            try {
                const short = (parsed && parsed.repercussions) ? (typeof parsed.repercussions === 'string' ? parsed.repercussions.slice(0, 200) : JSON.stringify(parsed.repercussions).slice(0, 200)) : '';
                updated.summary = `${updated.summary || ''} | AI: ${short}`;
            }
            catch { }
            await this.analysisRepo.save(updated);
            return parsed;
        }
        if (AI_PROVIDER === 'gemini') {
            if (!GEMINI_API_KEY) {
                const textErr = 'GEMINI_API_KEY not configured';
                const updatedErrAnalysis = analysis;
                updatedErrAnalysis.resultData = {
                    ...updatedErrAnalysis.resultData,
                    aiError: textErr,
                };
                await this.analysisRepo.save(updatedErrAnalysis);
                throw new Error(textErr);
            }
            let usedClient = 'none';
            let usedModel = GEMINI_MODEL;
            let text = '';
            let lastError = null;
            const finalPrompt = GEMINI_SYSTEM_PROMPT + '\n\n' + prompt;
            try {
                const genai = require('@google/genai');
                const PROJECT = process.env.GENAI_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_PROJECT || undefined;
                let client = null;
                if ((genai === null || genai === void 0 ? void 0 : genai.GoogleGenAI) && PROJECT) {
                    try {
                        const gclient = new genai.GoogleGenAI({ apiKey: GEMINI_API_KEY });
                        usedClient = 'google-genai';
                        try {
                            const resp = await gclient.models.generateContent({
                                model: `models/${GEMINI_MODEL}`,
                                parent: `projects/${PROJECT}`,
                                contents: [{ parts: [{ text: finalPrompt }] }],
                                generationConfig: { maxOutputTokens: 800, temperature: 0.2 }
                            });
                            const extracted = AIService.extractGeminiTextFromData(resp);
                            if (extracted) {
                                text = AIService.cleanLLMText(extracted);
                            }
                        }
                        catch (e) {
                            lastError = e;
                            const status = (_r = (_q = (_p = e === null || e === void 0 ? void 0 : e.response) === null || _p === void 0 ? void 0 : _p.status) !== null && _q !== void 0 ? _q : e === null || e === void 0 ? void 0 : e.code) !== null && _r !== void 0 ? _r : null;
                            const msg = (e === null || e === void 0 ? void 0 : e.message) || '';
                            console.warn('google-genai generateContent failed', status, msg);
                            if (status === 404 || /not found|Requested entity was not found/i.test(msg)) {
                                try {
                                    const listRes = await gclient.models.list({ parent: `projects/${PROJECT}` });
                                    const items = (_y = (_w = (_u = (_t = (_s = listRes === null || listRes === void 0 ? void 0 : listRes.pageInternal) !== null && _s !== void 0 ? _s : listRes === null || listRes === void 0 ? void 0 : listRes.page) !== null && _t !== void 0 ? _t : listRes === null || listRes === void 0 ? void 0 : listRes.models) !== null && _u !== void 0 ? _u : (_v = listRes === null || listRes === void 0 ? void 0 : listRes.pageInternal) === null || _v === void 0 ? void 0 : _v.pageInternal) !== null && _w !== void 0 ? _w : (_x = listRes === null || listRes === void 0 ? void 0 : listRes.pageInternal) === null || _x === void 0 ? void 0 : _x.page) !== null && _y !== void 0 ? _y : [];
                                    const modelsArr = Array.isArray(items) ? items : ((items === null || items === void 0 ? void 0 : items.pageInternal) || (items === null || items === void 0 ? void 0 : items.models) || []);
                                    const candidates = modelsArr
                                        .filter(m => { var _a, _b; return (m === null || m === void 0 ? void 0 : m.name) && (((_b = (_a = m === null || m === void 0 ? void 0 : m.supportedActions) === null || _a === void 0 ? void 0 : _a.includes) === null || _b === void 0 ? void 0 : _b.call(_a, 'generateContent')) || ((m === null || m === void 0 ? void 0 : m.supportedActions) && m.supportedActions.indexOf('generateContent') >= 0)); })
                                        .map(m => {
                                        const name = m.name;
                                        return name.startsWith('models/') ? name.replace(/^models\//, '') : name;
                                    })
                                        .filter(n => n && n !== GEMINI_MODEL);
                                    for (const alt of candidates) {
                                        try {
                                            const resp2 = await gclient.models.generateContent({
                                                model: `models/${alt}`,
                                                parent: `projects/${PROJECT}`,
                                                contents: [{ parts: [{ text: finalPrompt }] }],
                                                generationConfig: { maxOutputTokens: 800, temperature: 0.2 }
                                            });
                                            const extracted2 = AIService.extractGeminiTextFromData(resp2);
                                            if (extracted2) {
                                                text = AIService.cleanLLMText(extracted2);
                                                usedModel = alt;
                                                lastError = null;
                                                break;
                                            }
                                        }
                                        catch (err2) {
                                            lastError = err2;
                                        }
                                    }
                                }
                                catch (listErr) {
                                    lastError = listErr;
                                }
                            }
                        }
                    }
                    catch (e) {
                        lastError = e;
                        console.warn('google-genai generateContent failed, will try other client candidates or fallbacks', (e === null || e === void 0 ? void 0 : e.message) || e);
                    }
                }
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
                        }
                        catch (e) {
                            try {
                                if (PROJECT) {
                                    try {
                                        client = new C({ apiKey: GEMINI_API_KEY, project: PROJECT });
                                        break;
                                    }
                                    catch { }
                                }
                                client = new C();
                                break;
                            }
                            catch (e2) {
                            }
                        }
                    }
                }
                if (!client && (genai === null || genai === void 0 ? void 0 : genai.Client)) {
                    try {
                        client = new genai.Client({ apiKey: GEMINI_API_KEY });
                    }
                    catch { }
                }
                if (client) {
                    usedClient = 'genai-client';
                    const methodCandidates = ['generateText', 'generate', 'invoke', 'createText'];
                    let got = null;
                    for (const m of methodCandidates) {
                        if (typeof client[m] === 'function') {
                            try {
                                const maybeResp = await client[m]({
                                    model: GEMINI_MODEL,
                                    contents: [{ parts: [{ text: finalPrompt }] }],
                                    generationConfig: { maxOutputTokens: 800, temperature: 0.2 }
                                });
                                const extracted = AIService.extractGeminiTextFromData(maybeResp) || ((_2 = (_1 = (_0 = (_z = maybeResp === null || maybeResp === void 0 ? void 0 : maybeResp.choices) === null || _z === void 0 ? void 0 : _z[0]) === null || _0 === void 0 ? void 0 : _0.message) === null || _1 === void 0 ? void 0 : _1.content) !== null && _2 !== void 0 ? _2 : null);
                                if (extracted) {
                                    text = AIService.cleanLLMText(extracted);
                                    got = maybeResp;
                                    break;
                                }
                            }
                            catch (err) {
                                lastError = err;
                            }
                        }
                    }
                    if (!text && lastError)
                        throw lastError;
                }
            }
            catch (err) {
                lastError = err;
                console.warn('Official @google/genai client not usable; falling back to REST. Error:', (err === null || err === void 0 ? void 0 : err.message) || err);
            }
            if (!text) {
                const tryPostVariants = async (baseUrl, headers, p) => {
                    const variants = [
                        { body: { contents: [{ parts: [{ text: p }] }], generationConfig: { maxOutputTokens: 800, temperature: 0.2 } }, name: 'contents+generationConfig' },
                        { body: { prompt: { text: p }, generationConfig: { maxOutputTokens: 800, temperature: 0.2 } }, name: 'prompt.text+generationConfig' },
                        { body: { input: p, maxOutputTokens: 800, temperature: 0.2 }, name: 'input' },
                        { body: { instances: [{ input: p }], parameters: { maxOutputTokens: 800, temperature: 0.2 } }, name: 'instances+parameters' },
                        { body: { messages: [{ role: 'user', content: p }] }, name: 'messages' },
                    ];
                    let lastErr = null;
                    for (const v of variants) {
                        try {
                            const res = await axios_1.default.post(baseUrl, v.body, { headers });
                            const extracted = AIService.extractGeminiTextFromData(res.data);
                            if (extracted) {
                                return { text: AIService.cleanLLMText(extracted), variant: v.name };
                            }
                        }
                        catch (err) {
                            lastErr = err;
                        }
                    }
                    throw lastErr || new Error('No variant produced a response');
                };
                try {
                    const useKeyParam = typeof GEMINI_API_KEY === 'string' && GEMINI_API_KEY.startsWith('AIza');
                    const url = useKeyParam ? `https://generativelanguage.googleapis.com/v1/models/${usedModel}:generateContent?key=${GEMINI_API_KEY}` : `https://generativelanguage.googleapis.com/v1/models/${usedModel}:generateContent`;
                    const headers = {};
                    if (!useKeyParam)
                        headers['Authorization'] = `Bearer ${GEMINI_API_KEY}`;
                    const got = await tryPostVariants(url, headers, finalPrompt);
                    text = got.text;
                }
                catch (err) {
                    lastError = err;
                    const status = (_3 = err === null || err === void 0 ? void 0 : err.response) === null || _3 === void 0 ? void 0 : _3.status;
                    const data = (_4 = err === null || err === void 0 ? void 0 : err.response) === null || _4 === void 0 ? void 0 : _4.data;
                    if (status === 404) {
                        try {
                            const listUrl = `https://generativelanguage.googleapis.com/v1/models?key=${GEMINI_API_KEY}`;
                            const listRes = await axios_1.default.get(listUrl);
                            const models = (_6 = (_5 = listRes.data) === null || _5 === void 0 ? void 0 : _5.models) !== null && _6 !== void 0 ? _6 : [];
                            const candidates = models
                                .filter(m => { var _a; return (m === null || m === void 0 ? void 0 : m.name) && ((_a = m === null || m === void 0 ? void 0 : m.supportedActions) === null || _a === void 0 ? void 0 : _a.includes) && m.supportedActions.includes('generateContent'); })
                                .map(m => m.name.startsWith('models/') ? m.name.replace(/^models\//, '') : m.name)
                                .filter(n => n && n !== usedModel);
                            for (const alt of candidates) {
                                try {
                                    const useKeyParam2 = typeof GEMINI_API_KEY === 'string' && GEMINI_API_KEY.startsWith('AIza');
                                    const url2 = useKeyParam2 ? `https://generativelanguage.googleapis.com/v1/models/${alt}:generateContent?key=${GEMINI_API_KEY}` : `https://generativelanguage.googleapis.com/v1/models/${alt}:generateContent`;
                                    const headers2 = {};
                                    if (!useKeyParam2)
                                        headers2['Authorization'] = `Bearer ${GEMINI_API_KEY}`;
                                    const got2 = await tryPostVariants(url2, headers2, finalPrompt);
                                    text = got2.text;
                                    if (text) {
                                        usedModel = alt;
                                        lastError = null;
                                        break;
                                    }
                                }
                                catch (err2) {
                                    lastError = err2;
                                }
                            }
                        }
                        catch (listErr) {
                            lastError = listErr;
                        }
                    }
                    const updatedErrAnalysis = analysis;
                    updatedErrAnalysis.resultData = {
                        ...updatedErrAnalysis.resultData,
                        aiError: (err === null || err === void 0 ? void 0 : err.message) || String(err),
                        aiErrorDetailed: { status, data },
                    };
                    await this.analysisRepo.save(updatedErrAnalysis);
                }
            }
            if (lastError && !text) {
                const err = lastError;
                const status = (_9 = (_8 = (_7 = err === null || err === void 0 ? void 0 : err.response) === null || _7 === void 0 ? void 0 : _7.status) !== null && _8 !== void 0 ? _8 : err === null || err === void 0 ? void 0 : err.code) !== null && _9 !== void 0 ? _9 : null;
                const data = (_11 = (_10 = err === null || err === void 0 ? void 0 : err.response) === null || _10 === void 0 ? void 0 : _10.data) !== null && _11 !== void 0 ? _11 : null;
                const textErr = `Gemini error: status=${status} message=${(err === null || err === void 0 ? void 0 : err.message) || String(err)}`;
                const updatedErrAnalysis = analysis;
                updatedErrAnalysis.resultData = {
                    ...updatedErrAnalysis.resultData,
                    aiError: textErr,
                    aiErrorDetailed: { status, data },
                };
                await this.analysisRepo.save(updatedErrAnalysis);
                if (status === 404) {
                    throw new Error(`${textErr} - endpoint not found; check GEMINI_MODEL name and API availability.`);
                }
                throw new Error(textErr);
            }
            let parsed = null;
            try {
                const modelCaller = async (p) => {
                    const useKeyParam = typeof GEMINI_API_KEY === 'string' && GEMINI_API_KEY.startsWith('AIza');
                    const url = useKeyParam ? `https://generativelanguage.googleapis.com/v1/models/${usedModel}:generateContent?key=${GEMINI_API_KEY}` : `https://generativelanguage.googleapis.com/v1/models/${usedModel}:generateContent`;
                    const headers = {};
                    if (!useKeyParam)
                        headers['Authorization'] = `Bearer ${GEMINI_API_KEY}`;
                    const res = await axios_1.default.post(url, { contents: [{ parts: [{ text: p }] }], generationConfig: { maxOutputTokens: 800, temperature: 0.2 } }, { headers });
                    const extracted = AIService.extractGeminiTextFromData(res.data);
                    return AIService.cleanLLMText(extracted || '');
                };
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
            }
            catch (e) {
                parsed = { _parseError: String(e), raw: text };
            }
            if (parsed == null) {
                console.warn('AI parsed result is null — saving diagnostic object. raw text length=', ((_12 = (text || '')) === null || _12 === void 0 ? void 0 : _12.length) || 0);
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
            };
            try {
                const short = (parsed && parsed.repercussions) ? (typeof parsed.repercussions === 'string' ? parsed.repercussions.slice(0, 200) : JSON.stringify(parsed.repercussions).slice(0, 200)) : '';
                updated.summary = `${updated.summary || ''} | AI: ${short}`;
            }
            catch { }
            await this.analysisRepo.save(updated);
            return parsed;
        }
        throw new Error('Unsupported AI provider');
    }
}
exports.AIService = AIService;
AIService._ajv = null;
AIService._validateFn = null;
AIService._schema = null;
exports.default = new AIService();
//# sourceMappingURL=ai.service.js.map