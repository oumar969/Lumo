import db from "../../lib/turso.js";
import { verifyToken } from "../../lib/auth.js";
import { randomUUID } from "crypto";

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default async function handler(req, res) {
  try {
    const decoded = await verifyToken(req);
    const userRes = await db.execute({
      sql: "SELECT * FROM users WHERE firebase_uid = ?",
      args: [decoded.uid],
    });
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "User not found. Call POST /api/users first." });
    }
    const user = userRes.rows[0];

    if (req.method === "POST") {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: "name is required" });
      const id = randomUUID();
      const invite_code = generateInviteCode();
      await db.execute({
        sql: "INSERT INTO spaces (id, name, owner_id, invite_code) VALUES (?, ?, ?, ?)",
        args: [id, name, user.id, invite_code],
      });
      await db.execute({
        sql: "INSERT INTO space_members (space_id, user_id, role) VALUES (?, ?, 'owner')",
        args: [id, user.id],
      });
      const canvasId = randomUUID();
      await db.execute({
        sql: "INSERT INTO canvases (id, space_id, created_by) VALUES (?, ?, ?)",
        args: [canvasId, id, user.id],
      });
      const space = await db.execute({
        sql: "SELECT * FROM spaces WHERE id = ?",
        args: [id],
      });
      return res.status(201).json({ ...space.rows[0], canvas_id: canvasId });
    }

    if (req.method === "GET") {
      const spaces = await db.execute({
        sql: "SELECT s.*, sm.role FROM spaces s JOIN space_members sm ON sm.space_id = s.id WHERE sm.user_id = ? ORDER BY s.created_at DESC",
        args: [user.id],
      });
      return res.status(200).json(spaces.rows);
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
