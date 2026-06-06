import db from "../../lib/turso.js";
import { verifyToken } from "../../lib/auth.js";
import { randomUUID } from "crypto";

export default async function handler(req, res) {
  try {
    const decoded = await verifyToken(req);
    const userRes = await db.execute({
      sql: "SELECT * FROM users WHERE firebase_uid = ?",
      args: [decoded.uid],
    });
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const user = userRes.rows[0];

    if (req.method === "GET") {
      const { space_id } = req.query;
      if (!space_id) return res.status(400).json({ error: "space_id is required" });
      const widget = await db.execute({
        sql: "SELECT * FROM widgets WHERE space_id = ? AND user_id = ?",
        args: [space_id, user.id],
      });
      if (widget.rows.length === 0) {
        const id = randomUUID();
        await db.execute({
          sql: "INSERT INTO widgets (id, space_id, user_id) VALUES (?, ?, ?)",
          args: [id, space_id, user.id],
        });
        return res.status(200).json({ id, space_id, user_id: user.id, last_snapshot_url: null });
      }
      return res.status(200).json(widget.rows[0]);
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
