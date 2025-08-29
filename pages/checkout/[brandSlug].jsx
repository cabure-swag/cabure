// pages/checkout.jsx
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import {
  subscribeCart,
  getCartSnapshot,
  getCartTotal,
  updateQty,
  removeItem,
  clearCart,
} from "@/utils/cart";

export default function CheckoutPage() {
  const router = useRouter();
  const brandSlug = String(router.query.brand || "").trim();

  const [cart, setCart] = useState({ items: [] });
  const [brand, setBrand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Datos de contacto / envío (checkout sin login)
  const [contact, setContact] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });
  const [paymentMethod, setPaymentMethod] = useState("transferencia"); // o "efectivo", etc.

  useEffect(() => {
    if (!brandSlug) return;
    // 1) estado inicial del carrito + suscripción
    try {
      setCart(getCartSnapshot(brandSlug));
    } catch {}
    const unsub = subscribeCart(brandSlug, (next) => setCart(next));

    // 2) datos de la marca
    (async () => {
      const { data } = await supabase
        .from("brands")
        .select("id,name,slug,color,bank_alias,bank_cbu")
        .eq("slug", brandSlug)
        .maybeSingle();
      setBrand(data || null);
      setLoading(false);
    })();

    return () => unsub && unsub();
  }, [brandSlug]);

  const total = useMemo(() => {
    try {
      return getCartTotal(brandSlug) || 0;
    } catch {
      return 0;
    }
  }, [brandSlug, cart]);

  // Valida stock en server y corrige si hace falta
  async function validateAndClampStock(items) {
    if (!items?.length) return { ok: true, items: [] };

    const ids = items.map((it) => it.id);
    const { data: serverProducts, error } = await supabase
      .from("products")
      .select("id, stock, active, deleted_at")
      .in("id", ids);

    if (error) {
      return { ok: false, reason: "No se pudo verificar stock." };
    }

    const map = new Map(serverProducts.map((p) => [p.id, p]));
    let changed = false;

    const fixed = items.map((it) => {
      const srv = map.get(it.id);
      // producto inexistente / inactivo / borrado => a 0
      if (!srv || srv.deleted_at || !srv.active) {
        changed = true;
        return { ...it, qty: 0, stock_qty: 0 };
      }
      const stockSrv = Number.isFinite(srv.stock) ? Math.max(0, srv.stock) : 0;
      const clamped = Math.max(0, Math.min(it.qty || 0, stockSrv));
      if (clamped !== it.qty || (it.stock_qty ?? -1) !== stockSrv) changed = true;
      return { ...it, qty: clamped, stock_qty: stockSrv };
    });

    return { ok: true, items: fixed, changed };
  }

  async function placeOrder() {
    setErrorMsg("");
    if (!brandSlug) {
      setErrorMsg("Falta la marca.");
      return;
    }
    if (cart?.items?.length === 0) {
      setErrorMsg("Tu carrito está vacío.");
      return;
    }
    // Datos básicos requeridos
    if (!contact.name || !contact.phone) {
      setErrorMsg("Completá tu nombre y teléfono para avanzar.");
      return;
    }

    setSubmitting(true);

    // 1) validar stock contra el servidor y clamp local si hace falta
    const res = await validateAndClampStock(cart.items);
    if (!res.ok) {
      setSubmitting(false);
      setErrorMsg(res.reason || "No se pudo validar el stock.");
      return;
    }
    if (res.changed) {
      // actualizar carrito local con las cantidades corregidas
      for (const it of res.items) updateQty(brandSlug, it.id, it.qty || 0);
      // refrescar snapshot de estado
      setCart(getCartSnapshot(brandSlug));
      setSubmitting(false);
      setErrorMsg(
        "Ajustamos cantidades según stock disponible. Revisá y volvé a confirmar."
      );
      return;
    }

    // 2) preparar payload
    const itemsPayload = (cart.items || []).map((it) => ({
      product_id: it.id,
      qty: it.qty,
      price: it.price, // unitario
      name: it.name,
      image: it.image || null,
    }));

    try {
      // Primero intentamos la RPC transaccional (recomendada)
      const { data, error } = await supabase.rpc("place_order_v2", {
        p_brand_slug: brandSlug,
        p_items: itemsPayload,
        p_contact: contact,
        p_payment_method: paymentMethod,
      });

      if (error) {
        // Si la función no existe o falla por RLS, mostramos error claro
        throw new Error(
          error?.message ||
            "No se pudo crear el pedido (RPC). Revisá configuración."
        );
      }

      // ok
      clearCart(brandSlug);
      setSubmitting(false);

      // data puede traer { order_id, vendor_thread_id }
      const orderId = data?.order_id || data?.id || null;

      router.replace(
        orderId
          ? `/pedido-exitoso?id=${encodeURIComponent(orderId)}`
          : `/pedido-exitoso`
      );
    } catch (e) {
      setSubmitting(false);
      setErrorMsg(
        e?.message?.includes("place_order_v2")
          ? "Falta instalar la función de checkout en la base (abajo te dejo el SQL)."
          : e?.message || "No se pudo crear el pedido."
      );
    }
  }

  function del(it) {
    removeItem(brandSlug, it.id);
  }

  if (!brandSlug) {
    return (
      <div className="container">
        <Head><title>Checkout — CABURE.STORE</title></Head>
        <div className="empty">Falta el parámetro de marca (?brand=...)</div>
      </div>
    );
  }

  return (
    <div className="container">
      <Head><title>Checkout — CABURE.STORE</title></Head>

      <h1 style={{ margin: 0, marginBottom: 10 }}>Finalizar compra</h1>
      <div className="row top">
        <div className="col">
          <section className="card">
            <header className="secHead">
              <strong>Tu pedido</strong>
            </header>

            {loading ? (
              <div className="sk" />
            ) : (cart.items || []).length === 0 ? (
              <div className="empty">Tu carrito está vacío.</div>
            ) : (
              <ul className="list" role="list">
                {cart.items.map((it) => (
                  <li key={it.id} className="item">
                    <div className="thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {it.image ? (
                        <img src={it.image} alt={it.name || "producto"} />
                      ) : (
                        <div className="ph">IMG</div>
                      )}
                    </div>
                    <div className="meta">
                      <div className="name">{it.name}</div>
                      <div className="row sm">
                        <span className="muted">
                          Máx. {Number.isFinite(it.stock_qty) ? it.stock_qty : "—"}
                        </span>
                      </div>
                      <div className="price">
                        ${Number(it.price || 0).toLocaleString("es-AR")}
                      </div>
                      <div className="qtyrow">
                        <input
                          className="qty"
                          inputMode="numeric"
                          value={it.qty || 1}
                          onChange={(e) =>
                            updateQty(
                              brandSlug,
                              it.id,
                              Math.max(
                                0,
                                Math.min(
                                  parseInt(String(e.target.value || "0"), 10) || 0,
                                  it.stock_qty ?? Infinity
                                )
                              )
                            )
                          }
                        />
                        <button className="btn ghost sm" onClick={() => del(it)}>
                          Quitar
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <footer className="foot">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span>Total</span>
                <strong>${Number(total || 0).toLocaleString("es-AR")}</strong>
              </div>
            </footer>
          </section>
        </div>

        <div className="col">
          <section className="card">
            <header className="secHead">
              <strong>Tus datos</strong>
            </header>

            <div className="frm">
              <label className="lab">Nombre y apellido</label>
              <input
                className="inp"
                value={contact.name}
                onChange={(e) => setContact({ ...contact, name: e.target.value })}
                placeholder="Tu nombre"
              />

              <label className="lab">Teléfono</label>
              <input
                className="inp"
                value={contact.phone}
                onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                placeholder="+54 ..."
              />

              <label className="lab">Email (opcional)</label>
              <input
                className="inp"
                value={contact.email}
                onChange={(e) => setContact({ ...contact, email: e.target.value })}
                placeholder="tu@email.com"
              />

              <label className="lab">Dirección (opcional)</label>
              <input
                className="inp"
                value={contact.address}
                onChange={(e) =>
                  setContact({ ...contact, address: e.target.value })
                }
                placeholder="Calle, número, piso"
              />

              <label className="lab">Notas (opcional)</label>
              <textarea
                className="inp"
                rows={3}
                value={contact.notes}
                onChange={(e) =>
                  setContact({ ...contact, notes: e.target.value })
                }
                placeholder="Aclaraciones para el vendedor…"
              />

              <label className="lab">Pago</label>
              <select
                className="inp"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
                <option value="otro">Otro</option>
              </select>

              {errorMsg && <div className="error">{errorMsg}</div>}

              <button
                className="btn primary lg"
                disabled={submitting || (cart.items || []).length === 0}
                onClick={placeOrder}
              >
                {submitting ? "Creando pedido…" : "Confirmar pedido"}
              </button>
            </div>
          </section>

          {brand?.bank_alias || brand?.bank_cbu ? (
            <section className="card" style={{ marginTop: 12 }}>
              <header className="secHead">
                <strong>Datos de pago (marca)</strong>
              </header>
              <div className="box">
                {brand?.bank_alias && (
                  <div className="row space">
                    <span className="muted">Alias</span>
                    <strong>{brand.bank_alias}</strong>
                  </div>
                )}
                {brand?.bank_cbu && (
                  <div className="row space">
                    <span className="muted">CBU</span>
                    <strong>{brand.bank_cbu}</strong>
                  </div>
                )}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      <style jsx>{`
        .container { padding: 16px; }
        .row { display:flex; align-items:center; gap: 8px; }
        .row.top { align-items: flex-start; }
        .row.sm { gap: 6px; }
        .row.space { justify-content: space-between; width: 100%; }

        .col { flex:1; min-width:0; }
        .card { border:1px solid #1a1a1a; border-radius:14px; background:#0a0a0a; }
        .secHead { padding:10px 12px; border-bottom:1px solid #151515; }

        .sk { height: 140px; margin:12px; border-radius:10px; background:linear-gradient(90deg,#0f0f0f,#151515,#0f0f0f); animation:pulse 1.4s infinite; }
        @keyframes pulse { 0%{opacity:.6} 50%{opacity:1} 100%{opacity:.6} }
        .empty { padding:12px; margin:12px; border:1px dashed #2a2a2a; border-radius:12px; text-align:center; opacity:.9; }

        .list { display:grid; gap: 10px; margin:12px; }
        .item { display:grid; grid-template-columns: 84px 1fr; gap:10px; border:1px solid #1a1a1a; border-radius:10px; background:#0f0f0f; padding:8px; }
        .thumb { width:84px; height:84px; border:1px solid #222; border-radius:10px; overflow:hidden; background:#0a0a0a; }
        .thumb img { width:100%; height:100%; object-fit:cover; display:block; }
        .ph { width:100%; height:100%; display:grid; place-items:center; color:#777; }
        .meta { display:grid; gap:6px; align-content:start; }
        .muted { opacity:.75; }

        .qtyrow { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
        .qty {
          width:64px; text-align:center; padding:6px 8px;
          border-radius:10px; border:1px solid #2a2a2a; background:#0f0f0f; color:#fff;
        }

        .price { font-weight:700; }

        .foot { padding: 12px; border-top:1px dashed #222; }

        .frm { padding: 12px; display:grid; gap:8px; }
        .lab { font-size:.95rem; opacity:.8; }
        .inp {
          padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#0f0f0f; color:#fff; width:100%;
        }
        .box { padding: 12px; display:grid; gap: 8px; }

        .btn {
          padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#161616; color:#fff; cursor:pointer;
        }
        .btn.lg { padding:10px 12px; font-weight:600; }
        .btn.primary { background:#2b5cff; border-color:#2b5cff; }
        .btn.primary:hover { filter:brightness(1.1); }
        .btn.ghost { background:#0f0f0f; }
        .btn:disabled { opacity:.6; cursor:not-allowed; }

        @media (max-width: 980px) {
          .row.top { flex-direction: column; }
          .col { width: 100%; }
        }
      `}</style>
    </div>
  );
}
