import db from "../../lib/turso.js";
import { verifyToken } from "../../lib/auth.js";
import { runCors } from "../../lib/cors.js";

export default async function handler(req, res) {
  await runCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const decoded = await verifyToken(req);

    if (req.method === "GET") {
      const { space_id } = req.query;
      if (!space_id) return res.status(400).json({ error: "space_id is required" });
      const canvas = await db.execute({
        sql: "SELECT * FROM canvases WHERE space_id = ? ORDER BY updated_at DESC LIMIT 1",
        args: [space_id],
      });
      if (canvas.rows.length === 0) {
        return res.status(404).json({ error: "Canvas not found" });
      }
      return res.status(200).json(canvas.rows[0]);
    }

    if (req.method === "PATCH") {
      const { canvas_id, snapshot_url } = req.body;
      if (!canvas_id || !snapshot_url) {
        return res.status(400).json({ error: "canvas_id and snapshot_url are required" });
      }
      const now = Math.floor(Date.now() / 1000);
      await db.execute({
        sql: "UPDATE canvases SET snapshot_url = ?, updated_at = ? WHERE id = ?",
        args: [snapshot_url, now, canvas_id],
      });
      const spaceRes = await db.execute({
        sql: "SELECT space_id FROM canvases WHERE id = ?",
        args: [canvas_id],
      });
      if (spaceRes.rows.length > 0) {
        await db.execute({
          sql: "UPDATE widgets SET last_snapshot_url = ?, updated_at = ? WHERE space_id = ?",
          args: [snapshot_url, now, spaceRes.rows[0].space_id],
        });
      }
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
