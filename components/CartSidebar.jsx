// components/CartSidebar.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  subscribeCart,
  getCartSnapshot,
  getCartTotal,
  updateQty,
  removeItem,
  clearCart,
} from "@/utils/cart";

/**
 * Sidebar del Carrito por marca
 * Props:
 *  - brandSlug: string (obligatorio)
 *  - onCheckout?: (cart) => void (opcional) si querés manejo custom
 */
export default function CartSidebar({ brandSlug, onCheckout }) {
  const router = useRouter();
  const [cart, setCart] = useState({ items: [] });
  const [ready, setReady] = useState(false);

  // Cargar estado inicial + suscribirse a cambios (sin refrescar la página)
  useEffect(() => {
    if (!brandSlug) return;
    // estado inicial
    try {
      setCart(getCartSnapshot(brandSlug));
      setReady(true);
    } catch {}
    // suscripción
    const unsub = subscribeCart(brandSlug, (next) => setCart(next));
    return () => unsub && unsub();
  }, [brandSlug]);

  const total = useMemo(() => {
    if (!brandSlug) return 0;
    try {
      return getCartTotal(brandSlug);
    } catch {
      return 0;
    }
  }, [brandSlug, cart]);

  function inc(it) {
    const next = Math.min((it.qty || 0) + 1, it.stock_qty ?? Infinity);
    updateQty(brandSlug, it.id, next);
  }
  function dec(it) {
    const next = Math.max((it.qty || 0) - 1, 0);
    updateQty(brandSlug, it.id, next);
  }
  function set(it, raw) {
    let v = parseInt(String(raw), 10);
    if (!Number.isFinite(v) || Number.isNaN(v)) v = it.qty || 1;
    v = Math.max(0, Math.min(v, it.stock_qty ?? Infinity));
    updateQty(brandSlug, it.id, v);
  }
  function remove(it) {
    removeItem(brandSlug, it.id);
  }
  function clearAll() {
    if (confirm("¿Vaciar el carrito?")) clearCart(brandSlug);
  }

  function doCheckout() {
    const current = getCartSnapshot(brandSlug);
    if (!current?.items?.length) return;
    if (typeof onCheckout === "function") {
      onCheckout(current);
    } else {
      // Ruta por defecto del proyecto (ajustá si tu checkout es otra)
      router.push(`/checkout?brand=${encodeURIComponent(brandSlug)}`);
    }
  }

  return (
    <aside className="cart">
      <header className="cart__head">
        <h3 style={{ margin: 0 }}>Tu carrito</h3>
        {cart?.items?.length > 0 && (
          <button className="btn ghost sm" onClick={clearAll} title="Vaciar carrito">
            Vaciar
          </button>
        )}
      </header>

      {!ready ? (
        <div className="sk" />
      ) : cart.items.length === 0 ? (
        <div className="empty">Tu carrito está vacío.</div>
      ) : (
        <>
          <ul className="list" role="list">
            {cart.items.map((it) => (
              <li key={it.id} className="row item">
                <div className="thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {it.image ? (
                    <img src={it.image} alt={it.name || "producto"} />
                  ) : (
                    <div className="ph">IMG</div>
                  )}
                </div>
                <div className="meta">
                  <div className="name">{it.name || "Producto"}</div>
                  <div className="sub">
                    Stock máx.:{" "}
                    {Number.isFinite(it.stock_qty) ? it.stock_qty : "—"}
                  </div>
                  <div className="price">
                    ${Number(it.price || 0).toLocaleString("es-AR")}
                  </div>

                  <div className="qtyrow">
                    <button
                      className="btn sm"
                      onClick={() => dec(it)}
                      aria-label="Disminuir cantidad"
                    >
                      −
                    </button>
                    <input
                      className="qty"
                      inputMode="numeric"
                      value={it.qty || 1}
                      onChange={(e) => set(it, e.target.value)}
                    />
                    <button
                      className="btn sm"
                      onClick={() => inc(it)}
                      aria-label="Aumentar cantidad"
                      disabled={
                        Number.isFinite(it.stock_qty) &&
                        (it.qty || 0) >= (it.stock_qty || 0)
                      }
                    >
                      +
                    </button>

                    <button
                      className="btn ghost sm"
                      onClick={() => remove(it)}
                      title="Eliminar"
                      style={{ marginLeft: 8 }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <footer className="cart__foot">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>Total</strong>
              <strong>${Number(total || 0).toLocaleString("es-AR")}</strong>
            </div>
            <button className="btn primary lg" onClick={doCheckout}>
              Finalizar compra
            </button>
          </footer>
        </>
      )}

      <style jsx>{`
        .cart {
          border: 1px solid #1a1a1a;
          border-radius: 12px;
          background: #0b0b0b;
          padding: 12px;
        }
        .cart__head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .sk {
          height: 80px;
          border-radius: 10px;
          background: linear-gradient(90deg, #0f0f0f, #151515, #0f0f0f);
          animation: pulse 1.4s infinite;
        }
        @keyframes pulse {
          0% { opacity: .6; } 50% { opacity: 1; } 100% { opacity: .6; }
        }
        .empty {
          padding: 16px;
          border: 1px dashed #2a2a2a;
          border-radius: 12px;
          text-align: center;
          opacity: .9;
        }
        .list { display: grid; gap: 10px; margin: 0; padding: 0; }
        .item {
          border: 1px solid #1a1a1a;
          border-radius: 10px;
          padding: 8px;
          background: #0f0f0f;
          gap: 10px;
        }
        .row { display: flex; }
        .thumb {
          width: 72px; height: 72px; border-radius: 8px; overflow: hidden;
          border: 1px solid #222; background: #0a0a0a; flex-shrink: 0;
        }
        .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .ph { width: 100%; height: 100%; display: grid; place-items: center; color: #777; }
        .meta { display: grid; gap: 6px; flex: 1; min-width: 0; }
        .name { font-weight: 600; }
        .sub { opacity: .8; font-size: .9rem; }
        .price { font-weight: 700; }

        .qtyrow { display: flex; align-items: center; gap: 6px; margin-top: 2px; flex-wrap: wrap; }
        .qty {
          width: 56px; text-align: center; padding: 6px 8px;
          border-radius: 10px; border: 1px solid #2a2a2a; background: #0f0f0f; color: #fff;
        }

        .cart__foot {
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px dashed #222;
          display: grid; gap: 10px;
        }

        .btn {
          padding: 8px 10px; border-radius: 10px; border: 1px solid #2a2a2a;
          background: #161616; color: #fff; cursor: pointer;
        }
        .btn.sm { padding: 6px 10px; }
        .btn.lg { padding: 10px 12px; font-weight: 600; }
        .btn.primary { background: #2b5cff; border-color: #2b5cff; }
        .btn.primary:hover { filter: brightness(1.1); }
        .btn.ghost { background: #0f0f0f; }
        .btn:disabled { opacity: .6; cursor: not-allowed; }
      `}</style>
    </aside>
  );
}
