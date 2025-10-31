require('dotenv').config();

(async function(){
  try {
    const { GoogleGenAI } = require('@google/genai');
    const apiKey = process.env.GEMINI_API_KEY;
    const project = process.env.GENAI_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
    if (!apiKey) return console.error('GEMINI_API_KEY not set');
    if (!project) return console.error('GENAI_PROJECT/GOOGLE_CLOUD_PROJECT not set');

    // Note: some client versions treat apiKey vs project/auth differently.
    // The client errors if both project and apiKey are provided together, so instantiate with apiKey only.
    const client = new GoogleGenAI({ apiKey });
    console.log('Instantiated GoogleGenAI');
    console.log('models keys:', Object.keys(client.models || {}));

    // Try to call a listing method if available
    if (typeof client.models.list === 'function') {
      console.log('Calling client.models.list() with parent project ...');
      const res = await client.models.list({ parent: `projects/${project}` });
      console.log('list result keys:', Object.keys(res || {}));
      console.log(JSON.stringify(res, null, 2).slice(0, 2000));
      return;
    }

    if (typeof client.models.listModels === 'function') {
      console.log('Calling client.models.listModels() with parent project ...');
      const res = await client.models.listModels({ parent: `projects/${project}` });
      console.log(JSON.stringify(res, null, 2).slice(0, 2000));
      return;
    }

    if (typeof client.models.get === 'function') {
      console.log('Calling client.models.get() for model', process.env.GEMINI_MODEL);
      const res = await client.models.get({ name: `projects/${project}/models/${process.env.GEMINI_MODEL}` });
      console.log(JSON.stringify(res, null, 2));
      return;
    }

    console.log('No known listing method found on client.models; available keys shown above.');

  } catch (err) {
    console.error('Error during genai client test:', err && err.message ? err.message : err);
    if (err && err.response) console.error('response:', err.response.data || err.response.statusText || err.response);
  }
})();
