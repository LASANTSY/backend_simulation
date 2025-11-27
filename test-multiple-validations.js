const axios = require('axios');

async function testMultipleCases() {
  const API_URL = 'http://localhost:3000/serviceprediction/revenue-validation';

  const testCases = [
    { name: 'Taxe marché municipal', municipality_id: 'antananarivo-001' },
    { name: 'Loyer boutique', municipality_id: 'fianarantsoa-001' },
    { name: 'Recette XYZ inexistante', municipality_id: 'mahajanga-001' }
  ];

  console.log('🧪 Tests multiples du module de validation\n');

  for (const testData of testCases) {
    console.log('='.repeat(80));
    console.log(`📝 Test: "${testData.name}"`);
    console.log('='.repeat(80));

    try {
      const response = await axios.post(API_URL, testData, {
        headers: { 'Content-Type': 'application/json' }
      });

      console.log(`\n✅ Nom normalisé: ${response.data.name || 'N/A'}`);
      console.log(`📄 Description (premiers 300 caractères):\n${response.data.description.substring(0, 300)}...\n`);
    } catch (error) {
      console.error(`\n❌ Erreur: ${error.message}\n`);
    }

    await new Promise(resolve => setTimeout(resolve, 2000)); // Pause entre les requêtes
  }

  // Test historique
  console.log('\n' + '='.repeat(80));
  console.log('📚 Test de l\'historique');
  console.log('='.repeat(80));

  try {
    const response = await axios.get(`${API_URL}/history`);
    console.log(`\n✅ Nombre de validations dans l'historique: ${response.data.length}`);
    if (response.data.length > 0) {
      console.log('\nDernières validations:');
      response.data.slice(0, 3).forEach((v, i) => {
        console.log(`  ${i + 1}. ${v.originalName} → ${v.normalizedName || 'N/A'} (${v.status})`);
      });
    }
  } catch (error) {
    console.error(`\n❌ Erreur historique: ${error.message}\n`);
  }

  console.log('\n✨ Tests terminés!\n');
}

testMultipleCases();
