import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { connectToDatabase } from "./server/db";
import { authRouter } from "./server/routes/auth";
import { historyRouter } from "./server/routes/history";
import { solveRouter } from "./server/routes/solve";

async function startServer() {
  const app = express();
  // Railway (et la plupart des PaaS) fournissent le port via process.env.PORT.
  // Le serveur DOIT écouter sur ce port, sinon le déploiement échoue.
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "50mb" }));

  await connectToDatabase();

  app.use("/api/auth", authRouter);
  app.use("/api/history", historyRouter);
  app.use("/api/solve", solveRouter);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
