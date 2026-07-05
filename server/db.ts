import mongoose from "mongoose";

let isConnected = false;

/**
 * Connecte l'application à MongoDB.
 * L'URI provient de la variable d'environnement MONGODB_URI
 * (sur Railway : ajouter le plugin "MongoDB" ou une base Atlas,
 * puis coller l'URI fournie dans les variables d'environnement du service).
 */
export async function connectToDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn(
      "WARNING: MONGODB_URI n'est pas défini. L'historique et l'authentification ne fonctionneront pas."
    );
    return;
  }

  if (isConnected) return;

  try {
    await mongoose.connect(uri);
    isConnected = true;
    console.log("MongoDB connecté avec succès.");
  } catch (error) {
    console.error("Échec de la connexion à MongoDB :", error);
    // On ne bloque pas le démarrage du serveur : les routes qui ont besoin
    // de la base renverront une erreur explicite tant que la connexion échoue.
  }
}

export function isDatabaseConnected(): boolean {
  return isConnected;
}
