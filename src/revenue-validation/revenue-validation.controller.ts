import { Router, Request, Response } from 'express';
import { revenueValidationService } from './revenue-validation.service';

const router = Router();

/**
 * POST /revenue-validation
 * Valider une recette locale
 * @swagger
 * /revenue-validation:
 *   post:
 *     tags:
 *       - Revenue Validation
 *     summary: Valider une recette locale
 *     description: Analyse et valide une recette locale proposée par rapport au PCOP 2006 CTD et au Code des Impôts (LFI 2025)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - municipality_id
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Taxe marché municipal"
 *               municipality_id:
 *                 type: string
 *                 example: "municipality-uuid-123"
 *     responses:
 *       200:
 *         description: Validation effectuée avec succès
 *       400:
 *         description: Données d'entrée invalides
 *       500:
 *         description: Erreur interne du serveur
 */
router.post('/revenue-validation', async (req: Request, res: Response) => {
  try {
    const { name, municipality_id } = req.body;

    // Validation des données d'entrée
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Le champ "name" est requis et doit être une chaîne de caractères' });
    }

    if (!municipality_id || typeof municipality_id !== 'string') {
      return res.status(400).json({ error: 'Le champ "municipality_id" est requis et doit être une chaîne de caractères' });
    }

    const result = await revenueValidationService.validateRevenue({ name, municipality_id });
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Erreur lors de la validation de la recette:', error);
    return res.status(500).json({ 
      error: 'Erreur interne du serveur',
      message: error.message 
    });
  }
});

/**
 * GET /revenue-validation/history
 * Récupérer l'historique des validations
 * @swagger
 * /revenue-validation/history:
 *   get:
 *     tags:
 *       - Revenue Validation
 *     summary: Récupérer l'historique des validations
 *     description: Retourne l'historique des validations de recettes, optionnellement filtré par municipalité
 *     parameters:
 *       - in: query
 *         name: municipalityId
 *         schema:
 *           type: string
 *         description: Identifiant de la municipalité pour filtrer les résultats
 *     responses:
 *       200:
 *         description: Historique récupéré avec succès
 *       500:
 *         description: Erreur interne du serveur
 */
router.get('/revenue-validation/history', async (req: Request, res: Response) => {
  try {
    const { municipalityId } = req.query;
    const history = await revenueValidationService.getValidationHistory(
      municipalityId as string | undefined
    );
    return res.status(200).json(history);
  } catch (error: any) {
    console.error('Erreur lors de la récupération de l\'historique:', error);
    return res.status(500).json({ 
      error: 'Erreur interne du serveur',
      message: error.message 
    });
  }
});

/**
 * GET /revenue-validation/:id
 * Récupérer une validation spécifique
 * @swagger
 * /revenue-validation/{id}:
 *   get:
 *     tags:
 *       - Revenue Validation
 *     summary: Récupérer une validation spécifique
 *     description: Retourne les détails d'une validation de recette par son identifiant
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Identifiant unique de la validation
 *     responses:
 *       200:
 *         description: Validation trouvée
 *       404:
 *         description: Validation non trouvée
 *       500:
 *         description: Erreur interne du serveur
 */
router.get('/revenue-validation/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validation = await revenueValidationService.getValidationById(id);
    
    if (!validation) {
      return res.status(404).json({ error: 'Validation non trouvée' });
    }
    
    return res.status(200).json(validation);
  } catch (error: any) {
    console.error('Erreur lors de la récupération de la validation:', error);
    return res.status(500).json({ 
      error: 'Erreur interne du serveur',
      message: error.message 
    });
  }
});

export default router;
