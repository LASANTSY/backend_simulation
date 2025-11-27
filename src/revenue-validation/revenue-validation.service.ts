import { Repository } from 'typeorm';
import { RevenueValidation } from '../entities/RevenueValidation';
import { ValidateRevenueRequestDto } from './dto/validate-revenue-request.dto';
import { ValidateRevenueResponseDto } from './dto/validate-revenue-response.dto';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import AppDataSource from '../data-source';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

class RevenueValidationService {
  private validationRepository: Repository<RevenueValidation>;

  constructor() {
    this.validationRepository = AppDataSource.getRepository(RevenueValidation);
  }

  /**
   * Valide une recette proposée par rapport au PCOP 2006 CTD et au Code des Impôts (LFI 2025)
   */
  async validateRevenue(
    dto: ValidateRevenueRequestDto,
  ): Promise<ValidateRevenueResponseDto> {
    console.log(`[RevenueValidation] Validation de la recette: ${dto.name} pour la municipalité: ${dto.municipality_id}`);

    // Créer une entrée de validation en base
    const validation = this.validationRepository.create({
      originalName: dto.name,
      municipalityId: dto.municipality_id,
      status: 'pending',
    });

    try {
      // Charger les documents de référence
      const pcopContent = await this.loadPCOPReference();
      const codeImpotsContent = await this.loadCodeImpotsReference();

      // Construire le prompt pour l'IA
      const prompt = this.buildValidationPrompt(
        dto.name,
        dto.municipality_id,
        pcopContent,
        codeImpotsContent,
      );

      // Appeler l'IA pour l'analyse
      const aiResponse = await this.callGeminiAPI(prompt);

      // Parser la réponse de l'IA
      const parsedResponse = this.parseAIResponse(aiResponse);

      // Mettre à jour l'entité validation
      validation.normalizedName = parsedResponse.name;
      validation.description = parsedResponse.description;
      validation.rawAiResponse = aiResponse;

      // Déterminer le statut basé sur la réponse
      if (parsedResponse.name === null) {
        if (parsedResponse.description.startsWith('ERREUR')) {
          validation.status = 'invalid';
        } else if (parsedResponse.description.startsWith('AMBIGUÏTÉ')) {
          validation.status = 'ambiguous';
        } else {
          validation.status = 'error';
        }
      } else {
        validation.status = 'valid';
        // Extraire les détails structurés de la description
        this.extractStructuredData(validation, parsedResponse.description);
      }

      // Sauvegarder en base
      await this.validationRepository.save(validation);

      // Retourner la réponse formatée
      return {
        name: parsedResponse.name,
        description: parsedResponse.description,
        municipality_id: dto.municipality_id,
      };
    } catch (error: any) {
      console.error(`[RevenueValidation] Erreur lors de la validation: ${error.message}`, error.stack);
      
      validation.status = 'error';
      validation.errorMessage = error.message;
      await this.validationRepository.save(validation);

      return {
        name: null,
        description: `ERREUR SYSTÈME : Une erreur s'est produite lors de l'analyse de la recette. Détails: ${error.message}`,
        municipality_id: dto.municipality_id,
      };
    }
  }

  /**
   * Charge le contenu du guide PCOP 2006 CTD
   */
  private async loadPCOPReference(): Promise<string> {
    try {
      const pcopPath = path.join(
        __dirname,
        '../../ressource/guide-pcop-2006-collectivites-territoriales-decentralisees.pdf',
      );
      
      // Pour une vraie implémentation, il faudrait extraire le texte du PDF
      // Pour l'instant, on retourne une indication que le document est disponible
      if (fs.existsSync(pcopPath)) {
        console.log('[RevenueValidation] Document PCOP 2006 CTD trouvé');
        return 'PCOP_2006_CTD_DISPONIBLE';
      } else {
        console.warn('[RevenueValidation] Document PCOP 2006 CTD non trouvé');
        return 'PCOP_2006_CTD_NON_DISPONIBLE';
      }
    } catch (error: any) {
      console.error(`[RevenueValidation] Erreur lors du chargement du PCOP: ${error.message}`);
      return 'PCOP_2006_CTD_ERREUR';
    }
  }

  /**
   * Charge le contenu du Code des Impôts (LFI 2025)
   */
  private async loadCodeImpotsReference(): Promise<string> {
    try {
      const codeImpotsPath = path.join(
        __dirname,
        '../../ressource/Code des Impots suivant la loi de finances 2025.pdf',
      );
      
      // Pour une vraie implémentation, il faudrait extraire le texte du PDF
      // Pour l'instant, on retourne une indication que le document est disponible
      if (fs.existsSync(codeImpotsPath)) {
        console.log('[RevenueValidation] Document Code des Impôts (LFI 2025) trouvé');
        return 'CODE_IMPOTS_LFI_2025_DISPONIBLE';
      } else {
        console.warn('[RevenueValidation] Document Code des Impôts (LFI 2025) non trouvé');
        return 'CODE_IMPOTS_LFI_2025_NON_DISPONIBLE';
      }
    } catch (error: any) {
      console.error(`[RevenueValidation] Erreur lors du chargement du Code des Impôts: ${error.message}`);
      return 'CODE_IMPOTS_LFI_2025_ERREUR';
    }
  }

  /**
   * Construit le prompt pour l'analyse par l'IA
   */
  private buildValidationPrompt(
    revenueName: string,
    municipalityId: string,
    pcopContent: string,
    codeImpotsContent: string,
  ): string {
    return `Tu es un expert en fiscalité locale malgache et en comptabilité publique. Ta mission est d'analyser une recette locale proposée par un utilisateur et de vérifier sa conformité réglementaire vis-à-vis du Plan Comptable des Opérations Publiques (PCOP 2006) pour les Collectivités Territoriales Décentralisées (CTD) et du Code des Impôts tel que modifié par la Loi de Finances 2025.

CONTEXTE
L'utilisateur souhaite ajouter une nouvelle recette dans le système de gestion des recettes locales d'une municipalité malgache. Tu dois garantir que cette recette soit conforme aux normes légales et comptables en vigueur et proposer, si nécessaire, une version corrigée et normalisée de cette recette.

DOCUMENTS DE RÉFÉRENCE
Tu as accès aux documents suivants :
- PCOP 2006 CTD : Plan Comptable des Opérations Publiques applicable aux Collectivités Territoriales Décentralisées. [Statut: ${pcopContent}]
- Code des Impôts (version à jour) issu de la Loi de Finances 2025 : dispositions fiscales régissant les recettes des communes et autres CTD. [Statut: ${codeImpotsContent}]

DONNÉES D'ENTRÉE
Recette proposée :
{
  "name": "${revenueName}",
  "municipality_id": "${municipalityId}"
}

PROCESSUS D'ANALYSE
À partir de ces informations, tu dois exécuter les étapes suivantes :

1. Lecture et compréhension
   - Analyse le champ "name" pour comprendre de quel type de recette il pourrait s'agir (recette fiscale, non fiscale, domaniale, redevance, etc.).
   - Détecte les abréviations, formulations imprécises, erreurs orthographiques ou expressions non normalisées.

2. Recherche dans la documentation
   - Dans le PCOP 2006 CTD, identifie :
     * La ou les rubriques et comptes budgétaires correspondants
     * La classe et la nature de la recette (produit fiscal, produit non fiscal, revenu du domaine, etc.)
   
   - Dans le Code des Impôts (LFI 2025), identifie :
     * La base légale de la recette (articles, chapitres, sections)
     * L'assiette (base imposable)
     * Les taux, barèmes ou modalités de calcul, si disponibles
     * Les modalités de recouvrement (qui recouvre, selon quelle périodicité, sur quel territoire)
     * Les restrictions ou conditions particulières (catégorie de commune, zone urbaine/rurale, etc.)

3. Validation de conformité
   - Vérifie si la recette proposée existe explicitement ou implicitement dans le cadre légal et comptable en vigueur.
   - Détermine clairement :
     * Si la recette est autorisée par la LFI 2025 et le Code des Impôts
     * À quel type de recette elle appartient (fiscale / non fiscale / domaniale / autre)
     * Si la recette est toujours actuelle ou si elle a été modifiée, remplacée ou recentralisée

4. Normalisation du nom de la recette
   - Si la recette est valide, propose un nom officiel normalisé, cohérent avec :
     * La terminologie du PCOP 2006 CTD
     * La terminologie du Code des Impôts / LFI 2025
   - Si le nom fourni par l'utilisateur est imprécis ou erroné, corrige-le en expliquant cette correction dans la description.

5. Documentation et justification
   - Rédige une description claire et structurée, destinée à des administrateurs de communes :
     * Résume la base légale (références aux articles ou sections pertinents)
     * Indique la nomenclature comptable PCOP (classe, chapitre, compte)
     * Explique la nature de la recette, l'assiette, le principe de calcul, la périodicité et le mode de recouvrement
     * Signale, le cas échéant, les effets des modifications introduites par la LFI 2025
     * Mentionne les éventuelles précautions ou limites

FORMAT DE SORTIE
Tu dois répondre STRICTEMENT avec un objet JSON, sans aucun texte avant ou après. Le format attendu est :

Pour une recette VALIDE :
{
  "name": "Nom officiel normalisé de la recette selon PCOP/LFI",
  "description": "Description structurée comprenant :\\n- Base légale : références aux textes applicables\\n- Nomenclature PCOP : classe, chapitre, compte budgétaire\\n- Nature : type de recette\\n- Assiette : description de la base imposable\\n- Taux ou montant : indication des taux, barèmes\\n- Modalités de recouvrement : qui recouvre, périodicité\\n- Conditions d'application : catégories de communes, zones\\n- Observations : informations complémentaires utiles",
  "municipality_id": "${municipalityId}"
}

Pour une recette NON CONFORME :
{
  "name": null,
  "description": "ERREUR : La recette fournie ne correspond à aucune recette clairement définie ou autorisée dans le PCOP 2006 CTD et le Code des Impôts (LFI 2025). Indique les principaux problèmes identifiés et suggère, si possible, une ou plusieurs recettes officielles proches avec leurs noms normalisés.",
  "municipality_id": "${municipalityId}"
}

Pour une recette AMBIGUË :
{
  "name": null,
  "description": "AMBIGUÏTÉ : Le nom de recette fourni correspond potentiellement à plusieurs recettes officielles. Détaille au moins deux ou trois options plausibles, chacune avec : nom normalisé, type de recette, base légale résumée, et différence principale entre elles.",
  "municipality_id": "${municipalityId}"
}

RÈGLES IMPORTANTES
- Ne renvoie jamais de texte en dehors de l'objet JSON
- Ne modifie jamais la valeur de municipality_id : recopie-la telle quelle
- Priorise toujours les informations issues du PCOP 2006 CTD et du Code des Impôts/LFI 2025
- En cas de doute, sois conservateur : signale l'incertitude dans la description
- La description doit être exploitable directement pour l'affichage et la documentation

Analyse maintenant la recette proposée et renvoie UNIQUEMENT le JSON de réponse.`;
  }

  /**
   * Appelle l'API Gemini pour l'analyse
   */
  private async callGeminiAPI(prompt: string): Promise<any> {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY non configurée dans les variables d\'environnement');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    try {
      const response = await axios.post(
        url,
        {
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 60000, // 60 secondes
        },
      );

      console.log('[RevenueValidation] Réponse reçue de Gemini API');
      return response.data;
    } catch (error: any) {
      console.error(`[RevenueValidation] Erreur lors de l'appel à Gemini API: ${error.message}`);
      if (error.response) {
        console.error(`[RevenueValidation] Détails de l'erreur: ${JSON.stringify(error.response.data)}`);
      }
      throw new Error(`Échec de l'appel à l'API Gemini: ${error.message}`);
    }
  }

  /**
   * Parse la réponse de l'IA et extrait le JSON
   */
  private parseAIResponse(aiResponse: any): {
    name: string | null;
    description: string;
  } {
    try {
      // Extraire le texte de la réponse Gemini
      let text = '';
      
      if (aiResponse?.candidates?.[0]?.content?.parts?.[0]?.text) {
        text = aiResponse.candidates[0].content.parts[0].text;
      } else {
        throw new Error('Format de réponse Gemini inattendu');
      }

      // Nettoyer le texte (enlever les balises markdown si présentes)
      text = text.trim();
      if (text.startsWith('```json')) {
        text = text.substring(7);
      }
      if (text.startsWith('```')) {
        text = text.substring(3);
      }
      if (text.endsWith('```')) {
        text = text.substring(0, text.length - 3);
      }
      text = text.trim();

      // Parser le JSON
      const parsed = JSON.parse(text);

      // Valider la structure
      if (typeof parsed.description !== 'string') {
        throw new Error('La réponse ne contient pas de champ "description" valide');
      }

      return {
        name: parsed.name === null ? null : String(parsed.name),
        description: parsed.description,
      };
    } catch (error: any) {
      console.error(`[RevenueValidation] Erreur lors du parsing de la réponse IA: ${error.message}`);
      throw new Error(`Impossible de parser la réponse de l'IA: ${error.message}`);
    }
  }

  /**
   * Extrait les données structurées de la description pour remplir les champs de l'entité
   */
  private extractStructuredData(validation: RevenueValidation, description: string): void {
    // Utiliser des regex pour extraire les sections de la description
    
    // Base légale
    const legalMatch = description.match(/Base légale\s*:\s*([^\n]+)/i);
    if (legalMatch) {
      validation.legalReference = {
        loi: legalMatch[1].trim(),
      };
    }

    // Nomenclature PCOP
    const pcopMatch = description.match(/Nomenclature PCOP\s*:\s*([^\n]+)/i);
    if (pcopMatch) {
      const pcopText = pcopMatch[1].trim();
      validation.pcopReference = {
        rubrique: pcopText,
      };
    }

    // Nature
    const natureMatch = description.match(/Nature\s*:\s*([^\n]+)/i);
    if (natureMatch) {
      validation.revenueType = natureMatch[1].trim();
    }

    // Assiette
    const assietteMatch = description.match(/Assiette\s*:\s*([^\n]+)/i);
    if (assietteMatch) {
      validation.assiette = assietteMatch[1].trim();
    }

    // Taux
    const tauxMatch = description.match(/Taux ou montant\s*:\s*([^\n]+)/i);
    if (tauxMatch) {
      validation.taux = tauxMatch[1].trim();
    }

    // Modalités de recouvrement
    const modalitesMatch = description.match(/Modalités de recouvrement\s*:\s*([^\n]+)/i);
    if (modalitesMatch) {
      validation.modalitesRecouvrement = modalitesMatch[1].trim();
    }

    // Conditions d'application
    const conditionsMatch = description.match(/Conditions d'application\s*:\s*([^\n]+)/i);
    if (conditionsMatch) {
      validation.conditionsApplication = conditionsMatch[1].trim();
    }

    // Observations
    const observationsMatch = description.match(/Observations\s*:\s*([^\n]+)/i);
    if (observationsMatch) {
      validation.observations = observationsMatch[1].trim();
    }
  }

  /**
   * Récupère l'historique des validations pour une municipalité
   */
  async getValidationHistory(municipalityId?: string): Promise<RevenueValidation[]> {
    const options: any = {
      order: { createdAt: 'DESC' },
    };

    if (municipalityId) {
      options.where = { municipalityId };
    }

    return this.validationRepository.find(options);
  }

  /**
   * Récupère une validation spécifique par son ID
   */
  async getValidationById(id: string): Promise<RevenueValidation | null> {
    return this.validationRepository.findOne({ where: { id } });
  }
}

// Export singleton instance
export const revenueValidationService = new RevenueValidationService();
export default revenueValidationService;
