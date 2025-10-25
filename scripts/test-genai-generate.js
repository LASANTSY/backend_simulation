require('dotenv').config();

(async function(){
  try {
    const { GoogleGenAI } = require('@google/genai');
    const apiKey = process.env.GEMINI_API_KEY;
    const project = process.env.GENAI_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    if (!apiKey) return console.error('GEMINI_API_KEY not set');
    if (!project) return console.error('GENAI_PROJECT/GOOGLE_CLOUD_PROJECT not set');

    const client = new GoogleGenAI({ apiKey });
    console.log('Instantiated GoogleGenAI');

    const payloads = [
      { model: `models/${model}`, parent: `projects/${project}`, input: [{ content: [{ type: 'text', text: 'Bonjour, fais une courte analyse pour une simulation fiscale.' }] }], maxOutputTokens: 400, temperature: 0.2 },
      { model: `models/${model}`, parent: `projects/${project}`, prompt: { text: 'Bonjour, fais une courte analyse pour une simulation fiscale.' }, maxOutputTokens: 400, temperature: 0.2 },
      { model: `models/${model}`, parent: `projects/${project}`, input: 'Bonjour, fais une courte analyse pour une simulation fiscale.', maxOutputTokens: 400, temperature: 0.2 },
        // Try payloads with explicit 'contents' per SDK error message
        { model: `models/${model}`, parent: `projects/${project}`, contents: [{ text: 'Bonjour, fais une courte analyse pour une simulation fiscale.' }], maxOutputTokens: 400, temperature: 0.2 },
        { model: `models/${model}`, parent: `projects/${project}`, contents: [{ content: [{ type: 'text', text: 'Bonjour, fais une courte analyse pour une simulation fiscale.' }] }], maxOutputTokens: 400, temperature: 0.2 },
        { model: `models/${model}`, parent: `projects/${project}`, contents: [{ prompt: { text: 'Bonjour, fais une courte analyse pour une simulation fiscale.' } }], maxOutputTokens: 400, temperature: 0.2 },
        { model: `models/${model}`, parent: `projects/${project}`, contents: [{ content: 'Bonjour, fais une courte analyse pour une simulation fiscale.' }], maxOutputTokens: 400, temperature: 0.2 },
    ];

    for (const p of payloads) {
      try {
        console.log('Trying payload shape:', Object.keys(p));
        const res = await client.models.generateContent(p);
        console.log('Success, response keys:', Object.keys(res || {}));
        console.log(JSON.stringify(res, null, 2).slice(0,4000));
        return;
      } catch (err) {
        console.warn('Payload failed:', Object.keys(p), err && err.message ? err.message : err);
        if (err && err.response) console.warn('response data:', JSON.stringify(err.response.data).slice(0,1000));
      }
    }

    console.error('All payload shapes failed');

  } catch (err) {
    console.error('Error during genai generate test:', err && err.message ? err.message : err);
    if (err && err.response) console.error('response:', err.response.data || err.response.statusText || err.response);
  }
})();
