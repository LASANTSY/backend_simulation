/**
 * Test rapide du module de validation de recettes
 * Exécuter après avoir démarré le serveur
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000/serviceprediction/revenue-validation';

async function testValidation() {
  console.log('🧪 Test du module de validation de recettes\n');

  const testData = {
    name: 'IFPB',
    municipality_id: 'test-001'
  };

  try {
    console.log('📤 Envoi de la requête...');
    console.log('Données:', JSON.stringify(testData, null, 2));

    const response = await axios.post(API_URL, testData, {
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('\n✅ Succès!');
    console.log('\n📥 Réponse reçue:');
    console.log(JSON.stringify(response.data, null, 2));

    console.log('\n✨ Test terminé avec succès!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur!');
    if (error.response) {
      console.error('Statut HTTP:', error.response.status);
      console.error('Données:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('Aucune réponse reçue. Le serveur est-il démarré?');
      console.error('URL:', API_URL);
    } else {
      console.error('Erreur:', error.message);
    }
    process.exit(1);
  }
}

testValidation();
