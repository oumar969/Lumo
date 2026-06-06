import db from "../../lib/turso.js";
import { verifyToken } from "../../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const decoded = await verifyToken(req);
    const { invite_code } = req.body;
    if (!invite_code) {
      return res.status(400).json({ error: "invite_code is required" });
    }
    const userRes = await db.execute({
      sql: "SELECT * FROM users WHERE firebase_uid = ?",
      args: [decoded.uid],
    });
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const user = userRes.rows[0];
    const spaceRes = await db.execute({
      sql: "SELECT * FROM spaces WHERE invite_code = ?",
      args: [invite_code.toUpperCase()],
    });
    if (spaceRes.rows.length === 0) {
      return res.status(404).json({ error: "Invalid invite code" });
    }
    const space = spaceRes.rows[0];
    const memberRes = await db.execute({
      sql: "SELECT * FROM space_members WHERE space_id = ? AND user_id = ?",
      args: [space.id, user.id],
    });
    if (memberRes.rows.length > 0) {
      return res.status(200).json({ message: "Already a member", space });
    }
    await db.execute({
      sql: "INSERT INTO space_members (space_id, user_id, role) VALUES (?, ?, 'member')",
      args: [space.id, user.id],
    });
    return res.status(201).json({ message: "Joined successfully", space });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
