/**
 * server.ts — Express entry point
 *
 * Keep this file thin. Middleware setup and route mounting only.
 * All business logic lives in services/, all request handling in routes/.
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import { generateRouter } from "./routes/generate.route";

const app = express();
const PORT = process.env.PORT ?? 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/api/generate", generateRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✅ Magi backend running on http://localhost:${PORT}`);
  if (!process.env.OPENAI_API_KEY) {
    console.warn("⚠️  OPENAI_API_KEY is not set — generation will fail.");
  }
});
