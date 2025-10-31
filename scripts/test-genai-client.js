require('dotenv').config();

(async function(){
  try {
    const genai = require('@google/genai');
    console.log('genai loaded:', typeof genai);
    const keys = Object.keys(genai || {});
    console.log('exports:', keys);
    const candidates = ['TextServiceClient','TextGenerationClient','TextGenerationServiceClient','TextClient','Client','GoogleGenAI','GoogleGenAIClient','GoogleGenAIService'];
    for (const c of candidates) {
      console.log(c + ':', typeof genai[c]);
      if (typeof genai[c] === 'function') {
        try {
          const key = process.env.GEMINI_API_KEY || process.env.GENERATIVE_API_KEY || process.env.GOOGLE_API_KEY || null;
          const inst = key ? new genai[c]({ apiKey: key }) : new genai[c]();
          console.log('  instantiated', c, 'methods:', Object.keys(inst).slice(0,30));
        } catch (e) {
          console.log('  could not instantiate', c, 'error:', e && e.message ? e.message : e);
        }
      }
    }
  } catch (err) {
    console.error('require failed:', err && err.message ? err.message : err);
  }
})();
