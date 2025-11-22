/**
 * Test du contexte temporel amélioré avec saisons multiples
 */

require('dotenv').config();
const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

const testPrompt = `Vous êtes un expert financier/analyste capable d'intégrer le contexte temporel, météorologique, économique et démographique dans vos analyses. 

MISSION: Analysez cette simulation de revenus en tenant compte OBLIGATOIREMENT des contextes fournis ci-dessous, EN PARTICULIER les variations saisonnières sur TOUTE LA DURÉE de la simulation.

CONTEXTES À INTÉGRER:
- Période multi-saisonnière (12 mois): Du summer au spring, couvrant summer, autumn, winter, spring. Analysez comment CHAQUE saison traversée affecte différemment les revenus (variations saisonnières de demande, cycles touristiques, périodes agricoles, comportements de consommation selon les saisons).
- Période complète: Du 2025-06-01 au 2026-05-01. Considérez les événements calendaires, fêtes, périodes fiscales qui pourraient influencer les revenus durant cette période.
- Tendance globale: variation de -3.56% sur la période. Expliquez si cette tendance est soutenable compte tenu des contextes saisonniers et économiques.

INSTRUCTIONS DE SORTIE:
Produisez UN OBJET JSON structuré (sans Markdown, sans backticks) contenant:
- prediction: résumé chiffré avec valeurs clés et horizons temporels
- interpretation: explication détaillée (4-7 phrases) montrant EXPLICITEMENT comment les contextes (saisons traversées, météo, économie, démographie) influencent la projection sur TOUTE LA PÉRIODE
- risks: facteurs de risque LIÉS AUX CONTEXTES et à leur évolution temporelle
- opportunities: opportunités identifiées À PARTIR DES CONTEXTES et des variations saisonnières
- recommendations: actions concrètes priorisant l'adaptation aux contextes et aux cycles saisonniers
- confidence: score 0-1 basé sur la qualité/disponibilité des données contextuelles
- metadata: résumé des contextes utilisés

=== PARAMÈTRES DE SIMULATION ===
{"revenueId":"0e25bd90-f900-463e-a0c9-b98174bc5240","originalAmount":20000,"newAmount":2000,"frequency":"monthly","durationMonths":12,"startDate":"2025-06-01"}

=== RÉSULTATS/DONNÉES ===
{"months":["2025-06-01","2025-07-01","2025-08-01","2025-09-01","2025-10-01","2025-11-01","2025-12-01","2026-01-01","2026-02-01","2026-03-01","2026-04-01","2026-05-01"],"baselineSeries":[0,0,0,0,0,1010000,1010000,1010000,1010000,1010000,1010000,0],"simulatedSeries":[-18000,-18000,-18000,-18000,-18000,992000,992000,992000,992000,992000,992000,-18000],"baselineTotal":6060000,"simulatedTotal":5844000,"deltaTotal":-216000,"percentChange":-3.564356435643564}

=== CONTEXTES DISPONIBLES ===
Contexte temporel: {"period":12,"startDate":"2025-06-01","endDate":"2026-05-01","startSeason":"summer","endSeason":"spring","seasonsCovered":["summer","autumn","winter","spring"],"season":"summer","trend":{"percentChange":-3.564356435643564,"baselineTotal":6060000,"simulatedTotal":5844000}}
`;

async function testMultiSeasonContext() {
  console.log('🧪 Test du contexte multi-saisons (12 mois)');
  console.log('━'.repeat(70));

  const payload = {
    contents: [{ parts: [{ text: testPrompt }] }],
    generationConfig: { maxOutputTokens: 2048, temperature: 0.2 }
  };

  const url = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  console.log(`📡 Test avec une simulation de 12 mois couvrant 4 saisons...\n`);

  try {
    const response = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      console.error('❌ Aucun texte dans la réponse');
      console.log('Réponse:', JSON.stringify(response.data, null, 2));
      process.exit(1);
    }

    // Nettoyer le texte
    let cleanText = text.trim();
    const fenced = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced && fenced[1]) {
      cleanText = fenced[1].trim();
    }

    const parsed = JSON.parse(cleanText);
    console.log('✅ Analyse AI reçue avec succès!\n');
    
    // Vérifier que l'interprétation mentionne les saisons
    const interpretation = parsed.interpretation || '';
    const mentionsSaisons = /summer|autumn|winter|spring|saison|saisonnier|été|automne|hiver|printemps/i.test(interpretation);
    
    if (mentionsSaisons) {
      console.log('✅ L\'interprétation mentionne les saisons traversées');
    } else {
      console.log('⚠️ L\'interprétation ne mentionne PAS les saisons traversées');
    }
    
    console.log('\n📝 Interprétation:');
    console.log(interpretation);
    
    console.log('\n📊 Risques identifiés:', parsed.risks?.length || 0);
    parsed.risks?.forEach((r, i) => {
      console.log(`  ${i+1}. ${r.factor || r.description}: ${r.probability}`);
    });
    
    console.log('\n💡 Opportunités:', parsed.opportunities?.length || 0);
    parsed.opportunities?.forEach((o, i) => {
      console.log(`  ${i+1}. ${o.description} (impact: ${o.impact})`);
    });
    
    console.log('\n🎯 Confiance:', parsed.confidence);

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    if (error.response?.data) {
      console.error('Détails:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testMultiSeasonContext();
