import express from "express";
import pool from "./db";

const app = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);

app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "healthy" });
  } catch {
    res.status(503).json({ status: "unhealthy" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
