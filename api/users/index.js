import db from "../../lib/turso.js";
import { verifyToken } from "../../lib/auth.js";
import { randomUUID } from "crypto";

export default async function handler(req, res) {
  try {
    const decoded = await verifyToken(req);

    if (req.method === "POST") {
      const { display_name, avatar_url } = req.body;
      const existing = await db.execute({
        sql: "SELECT * FROM users WHERE firebase_uid = ?",
        args: [decoded.uid],
      });
      if (existing.rows.length > 0) {
        return res.status(200).json(existing.rows[0]);
      }
      const id = randomUUID();
      await db.execute({
        sql: "INSERT INTO users (id, display_name, avatar_url, firebase_uid) VALUES (?, ?, ?, ?)",
        args: [id, display_name || decoded.name || "Anonymous", avatar_url || decoded.picture || null, decoded.uid],
      });
      const user = await db.execute({
        sql: "SELECT * FROM users WHERE id = ?",
        args: [id],
      });
      return res.status(201).json(user.rows[0]);
    }

    if (req.method === "GET") {
      const user = await db.execute({
        sql: "SELECT * FROM users WHERE firebase_uid = ?",
        args: [decoded.uid],
      });
      if (user.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      return res.status(200).json(user.rows[0]);
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: err.message });
  }
}
