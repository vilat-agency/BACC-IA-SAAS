import { Router } from "express";
import { isDatabaseConnected } from "../db";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { History } from "../models/History";

export const historyRouter = Router();

historyRouter.use(requireAuth);

function ensureDbReady(res: any): boolean {
  if (!isDatabaseConnected()) {
    res.status(503).json({
      error: "Base de données indisponible. Vérifiez la variable MONGODB_URI côté serveur.",
    });
    return false;
  }
  return true;
}

// Liste l'historique de l'utilisateur connecté, du plus récent au plus ancien.
historyRouter.get("/", async (req: AuthenticatedRequest, res) => {
  if (!ensureDbReady(res)) return;

  try {
    const items = await History.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ items });
  } catch (error) {
    console.error("Erreur lors de la récupération de l'historique :", error);
    res.status(500).json({ error: "Impossible de récupérer l'historique." });
  }
});

// Sauvegarde une nouvelle copie générée.
historyRouter.post("/", async (req: AuthenticatedRequest, res) => {
  if (!ensureDbReady(res)) return;

  try {
    const { subject, problem, result } = req.body ?? {};
    if (!subject || !result) {
      return res.status(400).json({ error: "Sujet et résultat sont requis." });
    }

    const item = await History.create({
      userId: req.userId,
      subject,
      problem: problem ?? "",
      result,
    });
    res.status(201).json({ item });
  } catch (error) {
    console.error("Erreur lors de la sauvegarde de l'historique :", error);
    res.status(500).json({ error: "Impossible de sauvegarder cette copie." });
  }
});

// Supprime un élément d'historique appartenant à l'utilisateur connecté.
historyRouter.delete("/:id", async (req: AuthenticatedRequest, res) => {
  if (!ensureDbReady(res)) return;

  try {
    const deleted = await History.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!deleted) {
      return res.status(404).json({ error: "Élément introuvable." });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Erreur lors de la suppression de l'historique :", error);
    res.status(500).json({ error: "Impossible de supprimer cet élément." });
  }
});
