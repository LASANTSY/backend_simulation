/**
 * Script de test pour diagnostiquer l'analyse AI
 * Usage: node scripts/test-ai-enrichment.js
 */

require('dotenv').config();
const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
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
      "probability": 0.75,
      "impact": "high" | "medium" | "low"
    }
  ],
  "opportunities": [
    {
      "description": "string (opportunité IDENTIFIÉE à partir des contextes)",
      "impact": 0.8
    }
  ],
  "recommendations": [
    {
      "priority": 1,
      "action": "string (action concrète prenant en compte les contextes)"
    }
  ],
  "confidence": 0.85,
  "metadata": {
    "time": "string|null (résumé du contexte temporel utilisé)",
    "weather": "string|null (résumé des conditions météo considérées)",
    "economy": {},
    "demography": {}
  }
}`;

const testPrompt = `Vous êtes un expert financier/analyste capable d'intégrer le contexte temporel, météorologique, économique et démographique dans vos analyses. 

MISSION: Analysez cette simulation de revenus en tenant compte OBLIGATOIREMENT des contextes fournis ci-dessous.

CONTEXTES À INTÉGRER:
- Saison: summer. Analysez comment cette saison affecte les revenus (ex: haute/basse saison touristique, périodes de récolte, variations saisonnières de consommation).
- Tendance: variation de -3.56%. Expliquez si cette tendance est soutenable compte tenu du contexte.

INSTRUCTIONS DE SORTIE:
Produisez UN OBJET JSON structuré (sans Markdown, sans backticks) contenant:
- prediction: résumé chiffré avec valeurs clés et horizons temporels
- interpretation: explication détaillée (4-7 phrases) montrant EXPLICITEMENT comment les contextes (saison, météo, économie, démographie) influencent la projection
- risks: facteurs de risque LIÉS AUX CONTEXTES
- opportunities: opportunités identifiées À PARTIR DES CONTEXTES
- recommendations: actions concrètes priorisant l'adaptation aux contextes identifiés
- confidence: score 0-1 basé sur la qualité/disponibilité des données contextuelles
- metadata: résumé des contextes utilisés

=== PARAMÈTRES DE SIMULATION ===
{"revenueId":"0e25bd90-f900-463e-a0c9-b98174bc5240","originalAmount":20000,"newAmount":2000,"frequency":"monthly","durationMonths":12,"startDate":"2025-06-01","note":"Simulation automatique avec contexte réel","devise":"MGA","seasonContext":null}

=== RÉSULTATS/DONNÉES ===
{"months":["2025-06-01","2025-07-01","2025-08-01","2025-09-01","2025-10-01","2025-11-01","2025-12-01","2026-01-01","2026-02-01","2026-03-01","2026-04-01","2026-05-01"],"baselineSeries":[0,0,0,0,0,1010000,1010000,1010000,1010000,1010000,1010000,0],"simulatedSeries":[-18000,-18000,-18000,-18000,-18000,992000,992000,992000,992000,992000,992000,-18000],"baselineTotal":6060000,"simulatedTotal":5844000,"deltaTotal":-216000,"percentChange":-3.564356435643564}

=== CONTEXTES DISPONIBLES ===
Contexte temporel: {"period":12,"season":"summer","trend":{"percentChange":-3.564356435643564,"baselineTotal":6060000,"simulatedTotal":5844000},"startDate":"2025-06-01"}
`;

async function testAIEnrichment() {
  console.log('🧪 Test d\'enrichissement AI avec prompt complet');
  console.log('━'.repeat(70));

  const finalPrompt = GEMINI_SYSTEM_PROMPT + '\n\n' + testPrompt;

  const payload = {
    contents: [
      {
        parts: [
          { text: finalPrompt }
        ]
      }
    ],
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.2
    }
  };

  const url = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  console.log(`📡 Envoi du prompt à Gemini...`);
  console.log(`Longueur du prompt: ${finalPrompt.length} caractères\n`);

  try {
    const response = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('✅ Réponse reçue!');
    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      console.error('❌ Aucun texte dans la réponse');
      console.log('Réponse complète:', JSON.stringify(response.data, null, 2));
      process.exit(1);
    }

    console.log('\n📝 Texte brut de la réponse:');
    console.log('─'.repeat(70));
    console.log(text);
    console.log('─'.repeat(70));

    // Tenter de parser le JSON
    try {
      // Nettoyer le texte (enlever les code fences si présents)
      let cleanText = text.trim();
      const fenced = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenced && fenced[1]) {
        cleanText = fenced[1].trim();
        console.log('\n⚠️ Le texte contenait des code fences Markdown, elles ont été retirées');
      }

      const parsed = JSON.parse(cleanText);
      console.log('\n✅ JSON parsé avec succès!');
      console.log('Structure:', JSON.stringify(parsed, null, 2).slice(0, 500) + '...');

      // Valider les champs requis
      const required = ['prediction', 'interpretation', 'risks', 'opportunities', 'recommendations', 'confidence', 'metadata'];
      const missing = required.filter(field => !(field in parsed));
      
      if (missing.length > 0) {
        console.log('\n⚠️ Champs manquants:', missing.join(', '));
      } else {
        console.log('\n✅ Tous les champs requis sont présents');
      }

      // Vérifier la structure de prediction.values
      if (parsed.prediction?.values) {
        const firstValue = parsed.prediction.values[0];
        if (typeof firstValue === 'number') {
          console.log('\n⚠️ prediction.values contient des nombres au lieu d\'objets {key, value, horizon}');
        } else if (firstValue && typeof firstValue === 'object' && 'key' in firstValue && 'value' in firstValue) {
          console.log('\n✅ prediction.values a la bonne structure');
        }
      }

    } catch (parseError) {
      console.error('\n❌ Erreur de parsing JSON:', parseError.message);
      console.log('Le texte n\'est pas un JSON valide');
    }

  } catch (error) {
    console.error('\n❌ Erreur lors de l\'appel à Gemini:');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.message);
    console.error('Data:', JSON.stringify(error.response?.data, null, 2));
    process.exit(1);
  }
}

testAIEnrichment();
