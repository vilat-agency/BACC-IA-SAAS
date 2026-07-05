import { GoogleGenAI } from "@google/genai";
import { Router } from "express";
import { requireAuth } from "../middleware/auth";

export const solveRouter = Router();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("WARNING: GEMINI_API_KEY environment variable is not set.");
}
const ai = new GoogleGenAI({ apiKey: apiKey || "dummy-key" });

/**
 * Prompt système.
 *
 * Objectif : une copie propre et lisible, pas une accumulation de règles
 * contradictoires. On garde uniquement ce qui a un vrai impact sur la
 * lisibilité (présentation verticale, tableaux Markdown, pagination, SVG),
 * et on retire les répétitions / formulations ambiguës qui poussaient le
 * modèle à produire un texte trop haché ou trop chargé en symboles.
 */
function buildPrompt(subject: string, problem: string | undefined): string {
  const isScientific = ["Mathématiques", "Physique-Chimie", "Spécialité NSI"].includes(subject);

  return `Tu es un lycéen brillant de Terminale, en train de rédiger une copie de baccalauréat en ${subject}.

Sujet :
${problem ? problem : "(fourni en pièce jointe)"}

Rédige la copie complète, comme si elle allait être corrigée par un examinateur. Réponds uniquement avec le contenu de la copie : pas de salutation, pas de commentaire hors-sujet.

FORMAT (toujours) :
- Structure ta copie avec des titres clairs et une numérotation académique (ex. "Partie A", "1. a) Continuité de f en 1", "b) Dérivabilité de f en 1").
- Rédige en français rigoureux et fluide : "Démontrons que...", "On a...", "D'où...", "Donc...".
- Mets en gras les résultats finaux importants.
- Pour toute formule mathématique, utilise LaTeX : "$...$" pour l'inline, "$$...$$" pour les blocs.
- Pour un tableau (variations, signes, probabilités...), utilise un vrai tableau Markdown en colonnes ("|"), jamais les environnements LaTeX array/tabular. Dans un tableau de variations, utilise ↗ et ↘.
- Pour changer de page (grande partie ou long exercice terminé), place un séparateur "---" seul sur sa ligne. Utilise-le avec modération (2 à 4 fois maximum), pas après chaque paragraphe.
- S'il faut tracer une courbe ou une figure géométrique, fournis un bloc de code \`\`\`xml contenant un SVG : fond transparent (pas de rect de fond), "fill=\"none\"" sur les path/polyline/polygon/line, couleurs de type stylo (bleu, rouge, vert, noir), stroke-width 1.5 à 2, axes et légendes minimalistes uniquement (aucun texte de démonstration dans le SVG).

${
  isScientific
    ? `RÉDACTION SCIENTIFIQUE (Mathématiques, Physique-Chimie, NSI) :
- Va à l'essentiel dans les phrases : une courte phrase de méthode (ex. "D'après le théorème de Pythagore...") puis les calculs.
- Présente chaque calcul verticalement, une étape par ligne (jamais plusieurs égalités à la suite sur la même ligne).
- Quand plusieurs solutions ou cas existent (ex. "x = 2 ou x = -2"), écris chaque cas sur sa propre ligne, avec "ou" isolé entre les deux.
- Pour une suite d'étapes équivalentes, tu peux introduire chaque nouvelle ligne par "$$\\iff$$" uniquement quand cela clarifie réellement l'enchaînement logique (pas systématiquement sur des lignes triviales).`
    : `RÉDACTION LITTÉRAIRE (Philosophie, Français, Histoire-Géographie, SVT...) :
- Structure classique : introduction (accroche, problématique, annonce du plan), développement en parties/sous-parties, conclusion (bilan, ouverture).
- Vocabulaire riche mais naturel, arguments illustrés par des exemples précis.`
}`;
}

solveRouter.post("/", requireAuth, async (req, res) => {
  try {
    const { subject, problem, fileData, fileMimeType } = req.body ?? {};

    if (!subject || (!problem && !fileData)) {
      return res.status(400).json({ error: "Sujet et (problème ou fichier) sont requis." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Clé API Gemini manquante. Veuillez la configurer côté serveur." });
    }

    const prompt = buildPrompt(subject, problem);

    let contents: any = prompt;
    if (fileData && fileMimeType) {
      contents = [
        prompt,
        { inlineData: { data: fileData, mimeType: fileMimeType } },
      ];
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
    });

    res.json({ result: response.text });
  } catch (error: any) {
    console.error("Error generating content:", error);
    let errorMessage = "Une erreur s'est produite lors de la résolution du problème.";
    if (error.status === 429 || error.message?.includes("429")) {
      errorMessage = "Le quota de l'API Gemini est dépassé. Veuillez réessayer dans quelques instants.";
    } else if (error.status === 503 || error.message?.includes("503")) {
      errorMessage = "Le modèle d'IA est actuellement surchargé. Veuillez réessayer plus tard.";
    }
    res.status(500).json({ error: errorMessage });
  }
});
