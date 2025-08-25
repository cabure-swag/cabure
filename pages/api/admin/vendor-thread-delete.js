// pages/api/admin/vendor-thread-delete.js
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { threadId, requesterEmail } = req.body || {};
    if (!threadId || !requesterEmail) return res.status(400).json({ error: "Faltan parámetros" });

    // Verificar admin
    if (requesterEmail !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      return res.status(403).json({ error: "Solo admin" });
    }

    // Borrar mensajes del hilo
    const { error: mErr } = await supabaseAdmin
      .from("vendor_messages")
      .delete()
      .eq("thread_id", threadId);
    if (mErr) return res.status(400).json({ error: mErr.message });

    // Borrar el hilo
    const { error: tErr } = await supabaseAdmin
      .from("vendor_threads")
      .delete()
      .eq("id", threadId);
    if (tErr) return res.status(400).json({ error: tErr.message });

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Error" });
  }
}
