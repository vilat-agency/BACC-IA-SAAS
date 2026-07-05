import bcrypt from "bcryptjs";
import { Router } from "express";
import { isDatabaseConnected } from "../db";
import { requireAuth, signToken, type AuthenticatedRequest } from "../middleware/auth";
import { User } from "../models/User";

export const authRouter = Router();

function ensureDbReady(res: any): boolean {
  if (!isDatabaseConnected()) {
    res.status(503).json({
      error: "Base de données indisponible. Vérifiez la variable MONGODB_URI côté serveur.",
    });
    return false;
  }
  return true;
}

authRouter.post("/register", async (req, res) => {
  if (!ensureDbReady(res)) return;

  try {
    const { name, email, password } = req.body ?? {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Nom, email et mot de passe sont requis." });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caractères." });
    }

    const existing = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: "Un compte existe déjà avec cet email." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });

    const token = signToken(user._id.toString());
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Erreur lors de l'inscription :", error);
    res.status(500).json({ error: "Impossible de créer le compte pour le moment." });
  }
});

authRouter.post("/login", async (req, res) => {
  if (!ensureDbReady(res)) return;

  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe sont requis." });
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect." });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect." });
    }

    const token = signToken(user._id.toString());
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Erreur lors de la connexion :", error);
    res.status(500).json({ error: "Impossible de vous connecter pour le moment." });
  }
});

authRouter.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!ensureDbReady(res)) return;

  try {
    const user = await User.findById(req.userId).select("name email");
    if (!user) {
      return res.status(404).json({ error: "Utilisateur introuvable." });
    }
    res.json({ user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    console.error("Erreur lors de la récupération du profil :", error);
    res.status(500).json({ error: "Impossible de récupérer le profil." });
  }
});
