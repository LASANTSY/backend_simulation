/**
 * Script de test pour le module de validation de recettes locales
 * 
 * Usage:
 *   node scripts/test-revenue-validation.js
 *   
 * Variables d'environnement requises:
 *   - GEMINI_API_KEY
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/serviceprediction';

// Exemples de recettes à tester
const testCases = [
  {
    name: 'Taxe marché municipal',
    municipality_id: 'test-municipality-001',
    description: 'Test avec un nom de recette commun',
  },
  {
    name: 'IFPB',
    municipality_id: 'test-municipality-002',
    description: 'Test avec une abréviation',
  },
  {
    name: 'Loyer boutique',
    municipality_id: 'test-municipality-003',
    description: 'Test avec une recette domaniale',
  },
  {
    name: 'Taxe sur les spectacles',
    municipality_id: 'test-municipality-004',
    description: 'Test avec une taxe spécifique',
  },
  {
    name: 'Recette inexistante XYZ',
    municipality_id: 'test-municipality-005',
    description: 'Test avec une recette qui n\'existe pas',
  },
];

/**
 * Teste la validation d'une recette
 */
async function testValidateRevenue(testCase) {
  console.log('\n' + '='.repeat(80));
  console.log(`Test: ${testCase.description}`);
  console.log(`Nom de recette: "${testCase.name}"`);
  console.log('='.repeat(80));

  try {
    const response = await axios.post(`${API_BASE_URL}/revenue-validation`, {
      name: testCase.name,
      municipality_id: testCase.municipality_id,
    });

    console.log('\n✅ Validation réussie!');
    console.log('\nRéponse:');
    console.log(`  Nom normalisé: ${response.data.name || 'N/A'}`);
    console.log(`  Description:\n${response.data.description.split('\n').map(line => `    ${line}`).join('\n')}`);
    
    return { success: true, data: response.data };
  } catch (error) {
    console.error('\n❌ Erreur lors de la validation!');
    if (error.response) {
      console.error(`  Statut: ${error.response.status}`);
      console.error(`  Message: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`  Erreur: ${error.message}`);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Teste la récupération de l'historique
 */
async function testGetHistory() {
  console.log('\n' + '='.repeat(80));
  console.log('Test: Récupération de l\'historique des validations');
  console.log('='.repeat(80));

  try {
    const response = await axios.get(`${API_BASE_URL}/revenue-validation/history`);
    
    console.log('\n✅ Historique récupéré!');
    console.log(`  Nombre de validations: ${response.data.length}`);
    
    if (response.data.length > 0) {
      console.log('\n  Dernières validations:');
      response.data.slice(0, 3).forEach((validation, index) => {
        console.log(`    ${index + 1}. ${validation.originalName} → ${validation.normalizedName || 'N/A'} (${validation.status})`);
      });
    }
    
    return { success: true, count: response.data.length };
  } catch (error) {
    console.error('\n❌ Erreur lors de la récupération de l\'historique!');
    if (error.response) {
      console.error(`  Statut: ${error.response.status}`);
      console.error(`  Message: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`  Erreur: ${error.message}`);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Fonction principale
 */
async function main() {
  console.log('\n🚀 Démarrage des tests du module de validation de recettes');
  console.log(`   API Base URL: ${API_BASE_URL}`);

  // Vérifier que GEMINI_API_KEY est configurée
  if (!process.env.GEMINI_API_KEY) {
    console.error('\n⚠️  Attention: GEMINI_API_KEY n\'est pas configurée!');
    console.error('   Les appels à l\'API Gemini échoueront.');
  }

  const results = {
    total: 0,
    success: 0,
    failed: 0,
  };

  // Tester chaque cas
  for (const testCase of testCases) {
    const result = await testValidateRevenue(testCase);
    results.total++;
    if (result.success) {
      results.success++;
    } else {
      results.failed++;
    }
    
    // Attendre un peu entre les requêtes pour ne pas surcharger l'API
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Tester la récupération de l'historique
  await testGetHistory();

  // Afficher le résumé
  console.log('\n' + '='.repeat(80));
  console.log('📊 Résumé des tests');
  console.log('='.repeat(80));
  console.log(`  Total: ${results.total}`);
  console.log(`  Réussis: ${results.success}`);
  console.log(`  Échoués: ${results.failed}`);
  console.log(`  Taux de réussite: ${((results.success / results.total) * 100).toFixed(1)}%`);
  console.log('\n✨ Tests terminés!\n');
}

// Exécuter les tests
if (require.main === module) {
  main().catch(error => {
    console.error('\n💥 Erreur fatale:', error);
    process.exit(1);
  });
}

module.exports = { testValidateRevenue, testGetHistory };
