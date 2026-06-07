import db from "../../lib/turso.js";
import { verifyToken } from "../../lib/auth.js";
import { runCors } from "../../lib/cors.js";

async function ensureTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS presence (
      user_id   TEXT    PRIMARY KEY,
      last_seen INTEGER NOT NULL DEFAULT 0
    )
  `);
}

export default async function handler(req, res) {
  await runCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    await ensureTable();
    const decoded = await verifyToken(req);
    const userRes = await db.execute({
      sql: "SELECT * FROM users WHERE firebase_uid = ?",
      args: [decoded.uid],
    });
    if (userRes.rows.length === 0)
      return res.status(404).json({ error: "User not found" });
    const user = userRes.rows[0];

    if (req.method === "POST") {
      const now = Math.floor(Date.now() / 1000);
      await db.execute({
        sql: `INSERT INTO presence (user_id, last_seen) VALUES (?, ?)
              ON CONFLICT(user_id) DO UPDATE SET last_seen = excluded.last_seen`,
        args: [user.id, now],
      });
      return res.status(200).json({ success: true, last_seen: now });
    }

    if (req.method === "GET") {
      const { space_id } = req.query;
      if (!space_id) return res.status(400).json({ error: "space_id is required" });
      const rows = await db.execute({
        sql: `SELECT sm.user_id, p.last_seen
              FROM space_members sm
              LEFT JOIN presence p ON p.user_id = sm.user_id
              WHERE sm.space_id = ?`,
        args: [space_id],
      });
      return res.status(200).json(rows.rows);
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
