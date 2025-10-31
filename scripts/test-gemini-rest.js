const axios = require('axios');
require('dotenv').config();
(async ()=>{
  const KEY = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  if (!KEY) return console.error('No GEMINI_API_KEY in env');
  const endpoints = [
    `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`,
    `https://generativelanguage.googleapis.com/v1/models/${model}:generateText`,
    `https://generativelanguage.googleapis.com/v1beta2/models/${model}:generateText`,
  ];
  const prompt = 'Test quick prompt: say hello and return a JSON {"hello":"world"}';
  const payloads = [
    { content: [{ type: 'text', text: prompt }] },
    { prompt: { text: prompt } },
    { input: prompt },
    { instances: [{ content: [{ type: 'text', text: prompt }] }] },
  ];

  for (const ep of endpoints) {
    console.log('\nTRY ENDPOINT:', ep);
    for (const p of payloads) {
      try {
        const url = ep + `?key=${KEY}`;
        console.log('  payload:', Object.keys(p));
        const res = await axios.post(url, p, { headers: { 'Content-Type': 'application/json' } });
        console.log('  SUCCESS status=', res.status);
        console.log('  data=', JSON.stringify(res.data).slice(0,1000));
        return;
      } catch (err) {
        const status = err?.response?.status;
        const data = err?.response?.data;
        console.log('  ERROR status=', status, 'data snippet=', JSON.stringify(data).slice(0,400));
      }
    }
  }
})();
