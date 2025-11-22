/**
 * Script de test simple pour vérifier la connectivité à l'API Gemini
 * Usage: node scripts/test-gemini-simple.js
 */

require('dotenv').config();
const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';

async function testGemini() {
  console.log('🧪 Test de connectivité Gemini');
  console.log('━'.repeat(50));
  console.log(`Modèle: ${GEMINI_MODEL}`);
  console.log(`API Key: ${GEMINI_API_KEY ? GEMINI_API_KEY.slice(0, 10) + '...' : 'NON DÉFINIE'}`);
  console.log('━'.repeat(50));

  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY n\'est pas définie dans .env');
    process.exit(1);
  }

  const prompt = 'Réponds simplement "OK" si tu reçois ce message.';

  // Essayer avec la forme documentée: contents[].parts[].text + generationConfig
  const payload = {
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ],
    generationConfig: {
      maxOutputTokens: 100,
      temperature: 0.2
    }
  };

  const url = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  console.log(`\n📡 Envoi de la requête à: ${url.replace(GEMINI_API_KEY, 'HIDDEN')}`);
  console.log(`Payload:`, JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('\n✅ Réponse reçue avec succès!');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

    // Extraire le texte de la réponse
    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      console.log('\n📝 Texte extrait:', text);
    } else {
      console.log('\n⚠️ Impossible d\'extraire le texte de la réponse');
    }

  } catch (error) {
    console.error('\n❌ Erreur lors de l\'appel à Gemini:');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.message);
    console.error('Data:', JSON.stringify(error.response?.data, null, 2));

    // Si 404, lister les modèles disponibles
    if (error.response?.status === 404) {
      console.log('\n🔍 Tentative de listage des modèles disponibles...');
      try {
        const listUrl = `https://generativelanguage.googleapis.com/v1/models?key=${GEMINI_API_KEY}`;
        const listResponse = await axios.get(listUrl);
        const models = listResponse.data?.models || [];
        console.log(`\n📋 Modèles disponibles (${models.length}):`);
        models
          .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
          .forEach(m => {
            console.log(`  - ${m.name} (${m.displayName || 'N/A'})`);
          });
      } catch (listError) {
        console.error('Impossible de lister les modèles:', listError.message);
      }
    }

    process.exit(1);
  }
}

testGemini();
