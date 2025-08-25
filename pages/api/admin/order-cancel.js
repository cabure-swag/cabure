// pages/api/admin/order-cancel.js
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { orderId, requesterEmail } = req.body || {};
    if (!orderId || !requesterEmail) return res.status(400).json({ error: "Faltan parámetros" });

    // Verificar admin por email
    if (requesterEmail !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      return res.status(403).json({ error: "Solo admin" });
    }

    // Soft delete: marcamos como 'canceled'
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: "canceled" })
      .eq("id", orderId);

    if (error) return res.status(400).json({ error: error.message });

    // (Opcional) Restock de items si tu flujo lo descuenta:
    // const { data: items } = await supabaseAdmin.from("order_items").select("product_id, qty").eq("order_id", orderId);
    // for (const it of items || []) {
    //   await supabaseAdmin.rpc("increment_stock", { p_id: it.product_id, p_qty: it.qty }); // si tuvieras una RPC
    // }

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Error" });
  }
}
