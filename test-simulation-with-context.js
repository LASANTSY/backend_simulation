/**
 * Script de test : Simulation avec récupération automatique de contexte
 * 
 * Ce script teste que lorsqu'on fournit le paramètre "city",
 * le système récupère automatiquement les contextes météo, économiques et démographiques
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000/serviceprediction';

async function testSimulationWithContext() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('TEST 1: Simulation AVEC city (contextes récupérés auto)');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    const response = await axios.post(`${API_URL}/simulations`, {
      revenueId: "edecca6e-d16a-4ccf-8d02-02379c7231f5",
      newAmount: 5000,
      devise: "MGA",
      city: "Mahajanga",  // ✅ Fourni
      frequency: "monthly",
      durationMonths: 12,
      startDate: "2026-01-01",
      note: "Test avec récupération automatique de contexte"
      // ⚠️ NE PAS envoyer weatherContext, economicContext, demographicContext
      //    pour permettre la récupération automatique
    });

    console.log('✅ Simulation créée avec succès!\n');
    console.log('📊 Paramètres:');
    console.log(JSON.stringify(response.data.parameters, null, 2));
    
    console.log('\n🌤️  Contexte Météo:');
    console.log(response.data.weather ? JSON.stringify(response.data.weather, null, 2) : '❌ null');
    
    console.log('\n💰 Contexte Économique:');
    console.log(response.data.economic ? JSON.stringify(response.data.economic, null, 2) : '❌ null');
    
    console.log('\n👥 Contexte Démographique:');
    console.log(response.data.demographics ? JSON.stringify(response.data.demographics, null, 2) : '❌ null');
    
    console.log('\n🤖 Analyse AI (langue):');
    console.log('Summary:', response.data.analysis_results?.ai_analysis?.prediction_summary?.substring(0, 150) + '...');
    console.log('Est en français?', /[àâäéèêëïîôùûüÿçœæ]/i.test(response.data.analysis_results?.ai_analysis?.prediction_summary || '') ? '✅ OUI' : '❌ NON');

  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST 2: Simulation SANS city (contextes null)');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    const response = await axios.post(`${API_URL}/simulations`, {
      revenueId: "edecca6e-d16a-4ccf-8d02-02379c7231f5",
      newAmount: 4500,
      devise: "MGA",
      // ❌ PAS de city fourni
      frequency: "monthly",
      durationMonths: 6,
      startDate: "2026-01-01",
      note: "Test sans contexte"
    });

    console.log('✅ Simulation créée avec succès!\n');
    
    console.log('🌤️  Contexte Météo:', response.data.weather ? '✅ Présent' : '❌ null');
    console.log('💰 Contexte Économique:', response.data.economic ? '✅ Présent' : '❌ null');
    console.log('👥 Contexte Démographique:', response.data.demographics ? '✅ Présent' : '❌ null');
    
    console.log('\n⚠️  Attendu: Tous les contextes doivent être null car city n\'est pas fourni');

  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST 3: Simulation avec objets vides (doivent être ignorés)');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    const response = await axios.post(`${API_URL}/simulations`, {
      revenueId: "edecca6e-d16a-4ccf-8d02-02379c7231f5",
      newAmount: 5500,
      devise: "MGA",
      city: "Antananarivo",  // ✅ Fourni
      frequency: "monthly",
      durationMonths: 12,
      startDate: "2026-01-01",
      note: "Test avec objets vides qui doivent être ignorés",
      // Objets vides - doivent être traités comme absents
      weatherContext: {},
      economicContext: {},
      demographicContext: {}
    });

    console.log('✅ Simulation créée avec succès!\n');
    
    console.log('🌤️  Contexte Météo:', response.data.weather ? '✅ Présent (récupéré auto)' : '❌ null');
    console.log('💰 Contexte Économique:', response.data.economic ? '✅ Présent (récupéré auto)' : '❌ null');
    console.log('👥 Contexte Démographique:', response.data.demographics ? '✅ Présent (récupéré auto)' : '❌ null');
    
    console.log('\n✅ Attendu: Les objets vides {} doivent être ignorés et les contextes récupérés automatiquement');

  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
  }
}

// Exécution
console.log('\n🚀 Démarrage des tests de simulation avec contexte...\n');
testSimulationWithContext().then(() => {
  console.log('\n✅ Tests terminés!\n');
}).catch(err => {
  console.error('\n❌ Erreur fatale:', err);
  process.exit(1);
});
