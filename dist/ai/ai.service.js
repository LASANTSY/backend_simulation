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
const context_service_1 = __importDefault(require("../context/context.service"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const AI_PROVIDER = process.env.AI_PROVIDER || 'openai';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4';
const OPENAI_FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL || 'gpt-3.5-turbo';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
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
    buildPrompt(sim, analysis, extraContext = {}) {
        const contextParts = [];
        if (extraContext.time)
            contextParts.push(`Time context: ${JSON.stringify(extraContext.time)}`);
        if (extraContext.weather)
            contextParts.push(`Weather/Climate: ${JSON.stringify(extraContext.weather)}`);
        if (extraContext.economy)
            contextParts.push(`Economic context: ${JSON.stringify(extraContext.economy)}`);
        if (extraContext.indicators)
            contextParts.push(`Economic indicators: ${JSON.stringify(extraContext.indicators)}`);
        if (extraContext.demography)
            contextParts.push(`Demographic context: ${JSON.stringify(extraContext.demography)}`);
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
    async enrichAnalysis(analysisId, extraContext = {}) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24, _25, _26, _27, _28, _29, _30, _31, _32, _33, _34, _35, _36, _37, _38;
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
            const text = (_g = (_d = (_c = (_b = (_a = resp.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) !== null && _d !== void 0 ? _d : (_f = (_e = resp.choices) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.text) !== null && _g !== void 0 ? _g : '';
            let parsed = null;
            try {
                const m = text.match(/\{[\s\S]*\}/m);
                const jsonText = m ? m[0] : text;
                parsed = JSON.parse(jsonText);
            }
            catch (err) {
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
            try {
                const genai = require('@google/genai');
                const PROJECT = process.env.GENAI_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_PROJECT || undefined;
                let client = null;
                if ((genai === null || genai === void 0 ? void 0 : genai.GoogleGenAI) && PROJECT) {
                    try {
                        const gclient = new genai.GoogleGenAI({ apiKey: GEMINI_API_KEY });
                        usedClient = 'google-genai';
                        try {
                            const resp = await gclient.models.generateContent({ model: `models/${GEMINI_MODEL}`, parent: `projects/${PROJECT}`, contents: [{ text: prompt }], maxOutputTokens: 800, temperature: 0.2 });
                            const cand = (_h = resp === null || resp === void 0 ? void 0 : resp.candidates) === null || _h === void 0 ? void 0 : _h[0];
                            const content = cand === null || cand === void 0 ? void 0 : cand.content;
                            const maybeText = (content === null || content === void 0 ? void 0 : content.parts) ? content.parts.map((p) => p.text).join('') : ((_k = (_j = content === null || content === void 0 ? void 0 : content.text) !== null && _j !== void 0 ? _j : content) !== null && _k !== void 0 ? _k : '');
                            if (maybeText) {
                                text = maybeText;
                            }
                        }
                        catch (e) {
                            lastError = e;
                            const status = (_o = (_m = (_l = e === null || e === void 0 ? void 0 : e.response) === null || _l === void 0 ? void 0 : _l.status) !== null && _m !== void 0 ? _m : e === null || e === void 0 ? void 0 : e.code) !== null && _o !== void 0 ? _o : null;
                            const msg = (e === null || e === void 0 ? void 0 : e.message) || '';
                            console.warn('google-genai generateContent failed', status, msg);
                            if (status === 404 || /not found|Requested entity was not found/i.test(msg)) {
                                try {
                                    const listRes = await gclient.models.list({ parent: `projects/${PROJECT}` });
                                    const items = (_v = (_t = (_r = (_q = (_p = listRes === null || listRes === void 0 ? void 0 : listRes.pageInternal) !== null && _p !== void 0 ? _p : listRes === null || listRes === void 0 ? void 0 : listRes.page) !== null && _q !== void 0 ? _q : listRes === null || listRes === void 0 ? void 0 : listRes.models) !== null && _r !== void 0 ? _r : (_s = listRes === null || listRes === void 0 ? void 0 : listRes.pageInternal) === null || _s === void 0 ? void 0 : _s.pageInternal) !== null && _t !== void 0 ? _t : (_u = listRes === null || listRes === void 0 ? void 0 : listRes.pageInternal) === null || _u === void 0 ? void 0 : _u.page) !== null && _v !== void 0 ? _v : [];
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
                                            const resp2 = await gclient.models.generateContent({ model: `models/${alt}`, parent: `projects/${PROJECT}`, contents: [{ text: prompt }], maxOutputTokens: 800, temperature: 0.2 });
                                            const cand2 = (_w = resp2 === null || resp2 === void 0 ? void 0 : resp2.candidates) === null || _w === void 0 ? void 0 : _w[0];
                                            const content2 = cand2 === null || cand2 === void 0 ? void 0 : cand2.content;
                                            const maybeText2 = (content2 === null || content2 === void 0 ? void 0 : content2.parts) ? content2.parts.map((p) => p.text).join('') : ((_y = (_x = content2 === null || content2 === void 0 ? void 0 : content2.text) !== null && _x !== void 0 ? _x : content2) !== null && _y !== void 0 ? _y : '');
                                            if (maybeText2) {
                                                text = maybeText2;
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
                                const maybeResp = await client[m]({ model: GEMINI_MODEL, prompt: { text: prompt }, maxOutputTokens: 800, temperature: 0.2 });
                                const maybeText = (_6 = (_5 = (_4 = (_1 = (_0 = (_z = maybeResp === null || maybeResp === void 0 ? void 0 : maybeResp.candidates) === null || _z === void 0 ? void 0 : _z[0]) === null || _0 === void 0 ? void 0 : _0.content) !== null && _1 !== void 0 ? _1 : (_3 = (_2 = maybeResp === null || maybeResp === void 0 ? void 0 : maybeResp.output) === null || _2 === void 0 ? void 0 : _2[0]) === null || _3 === void 0 ? void 0 : _3.content) !== null && _4 !== void 0 ? _4 : maybeResp === null || maybeResp === void 0 ? void 0 : maybeResp.output) !== null && _5 !== void 0 ? _5 : maybeResp === null || maybeResp === void 0 ? void 0 : maybeResp.text) !== null && _6 !== void 0 ? _6 : ((_9 = (_8 = (_7 = maybeResp === null || maybeResp === void 0 ? void 0 : maybeResp.choices) === null || _7 === void 0 ? void 0 : _7[0]) === null || _8 === void 0 ? void 0 : _8.message) === null || _9 === void 0 ? void 0 : _9.content);
                                if (maybeText) {
                                    text = maybeText;
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
                try {
                    const useKeyParam = typeof GEMINI_API_KEY === 'string' && GEMINI_API_KEY.startsWith('AIza');
                    const url = useKeyParam ? `https://generativelanguage.googleapis.com/v1/models/${usedModel}:generateContent?key=${GEMINI_API_KEY}` : `https://generativelanguage.googleapis.com/v1/models/${usedModel}:generateContent`;
                    const headers = {};
                    if (!useKeyParam)
                        headers['Authorization'] = `Bearer ${GEMINI_API_KEY}`;
                    const res = await axios_1.default.post(url, { contents: [{ text: prompt }], maxOutputTokens: 800, temperature: 0.2 }, { headers });
                    text = ((_13 = (_12 = (_11 = (_10 = res.data) === null || _10 === void 0 ? void 0 : _10.candidates) === null || _11 === void 0 ? void 0 : _11[0]) === null || _12 === void 0 ? void 0 : _12.content) === null || _13 === void 0 ? void 0 : _13.parts) ? res.data.candidates[0].content.parts.map((p) => p.text).join('') : ((_19 = (_17 = (_16 = (_15 = (_14 = res.data) === null || _14 === void 0 ? void 0 : _14.candidates) === null || _15 === void 0 ? void 0 : _15[0]) === null || _16 === void 0 ? void 0 : _16.content) !== null && _17 !== void 0 ? _17 : (_18 = res.data) === null || _18 === void 0 ? void 0 : _18.output) !== null && _19 !== void 0 ? _19 : '');
                }
                catch (err) {
                    lastError = err;
                    const status = (_20 = err === null || err === void 0 ? void 0 : err.response) === null || _20 === void 0 ? void 0 : _20.status;
                    const data = (_21 = err === null || err === void 0 ? void 0 : err.response) === null || _21 === void 0 ? void 0 : _21.data;
                    if (status === 404) {
                        try {
                            const listUrl = `https://generativelanguage.googleapis.com/v1/models?key=${GEMINI_API_KEY}`;
                            const listRes = await axios_1.default.get(listUrl);
                            const models = (_23 = (_22 = listRes.data) === null || _22 === void 0 ? void 0 : _22.models) !== null && _23 !== void 0 ? _23 : [];
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
                                    const res2 = await axios_1.default.post(url2, { contents: [{ text: prompt }], maxOutputTokens: 800, temperature: 0.2 }, { headers: headers2 });
                                    text = ((_27 = (_26 = (_25 = (_24 = res2.data) === null || _24 === void 0 ? void 0 : _24.candidates) === null || _25 === void 0 ? void 0 : _25[0]) === null || _26 === void 0 ? void 0 : _26.content) === null || _27 === void 0 ? void 0 : _27.parts) ? res2.data.candidates[0].content.parts.map((p) => p.text).join('') : ((_33 = (_31 = (_30 = (_29 = (_28 = res2.data) === null || _28 === void 0 ? void 0 : _28.candidates) === null || _29 === void 0 ? void 0 : _29[0]) === null || _30 === void 0 ? void 0 : _30.content) !== null && _31 !== void 0 ? _31 : (_32 = res2.data) === null || _32 === void 0 ? void 0 : _32.output) !== null && _33 !== void 0 ? _33 : '');
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
                const status = (_36 = (_35 = (_34 = err === null || err === void 0 ? void 0 : err.response) === null || _34 === void 0 ? void 0 : _34.status) !== null && _35 !== void 0 ? _35 : err === null || err === void 0 ? void 0 : err.code) !== null && _36 !== void 0 ? _36 : null;
                const data = (_38 = (_37 = err === null || err === void 0 ? void 0 : err.response) === null || _37 === void 0 ? void 0 : _37.data) !== null && _38 !== void 0 ? _38 : null;
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
                const m = text.match(/\{[\s\S]*\}/m);
                const jsonText = m ? m[0] : text;
                parsed = JSON.parse(jsonText);
            }
            catch (err) {
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
exports.default = new AIService();
//# sourceMappingURL=ai.service.js.map