import db from "../../lib/turso.js";
import { verifyToken } from "../../lib/auth.js";
import { runCors } from "../../lib/cors.js";
import { randomUUID } from "crypto";

async function ensureTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id         TEXT    PRIMARY KEY,
      space_id   TEXT    NOT NULL,
      author_id  TEXT    NOT NULL,
      content    TEXT    NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
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

    if (req.method === "GET") {
      const { space_id } = req.query;
      if (!space_id) return res.status(400).json({ error: "space_id is required" });
      const notes = await db.execute({
        sql: `SELECT n.*, u.display_name AS author_name
              FROM notes n
              LEFT JOIN users u ON u.id = n.author_id
              WHERE n.space_id = ?
              ORDER BY n.updated_at DESC`,
        args: [space_id],
      });
      return res.status(200).json(notes.rows);
    }

    if (req.method === "POST") {
      const { space_id, content } = req.body;
      if (!space_id) return res.status(400).json({ error: "space_id is required" });
      const id = randomUUID();
      const now = Math.floor(Date.now() / 1000);
      await db.execute({
        sql: "INSERT INTO notes (id, space_id, author_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        args: [id, space_id, user.id, content ?? "", now, now],
      });
      return res.status(201).json({
        id, space_id, author_id: user.id,
        content: content ?? "", created_at: now, updated_at: now,
        author_name: user.display_name,
      });
    }

    if (req.method === "PATCH") {
      const { note_id, content } = req.body;
      if (!note_id) return res.status(400).json({ error: "note_id is required" });
      const now = Math.floor(Date.now() / 1000);
      await db.execute({
        sql: "UPDATE notes SET content = ?, updated_at = ? WHERE id = ? AND author_id = ?",
        args: [content ?? "", now, note_id, user.id],
      });
      return res.status(200).json({ success: true });
    }

    if (req.method === "DELETE") {
      const { note_id } = req.body;
      if (!note_id) return res.status(400).json({ error: "note_id is required" });
      await db.execute({
        sql: "DELETE FROM notes WHERE id = ? AND author_id = ?",
        args: [note_id, user.id],
      });
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
