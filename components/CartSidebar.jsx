// components/CartSidebar.jsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { readCart, clearCart as clearCartUtil } from "@/utils/cart";

export default function CartSidebar({ brandSlug }) {
  const [items, setItems] = useState([]);

  function refresh() {
    if (!brandSlug) return;
    setItems(readCart(brandSlug));
  }

  // Carga inicial
  useEffect(() => {
    refresh();
  }, [brandSlug]);

  // Reaccionar a cambios (misma pestaña y/o otras)
  useEffect(() => {
    if (!brandSlug) return;

    const onStorage = (e) => {
      if (!e) return;
      // En la misma pestaña normalmente no dispara "storage", pero lo dejamos por si hay otras pestañas.
      if (!e.key || e.key === `cart:${brandSlug}`) refresh();
    };

    const onCartChanged = (e) => {
      // Nuestro evento propio de carrito
      if (!e?.detail?.slug || e.detail.slug === brandSlug) refresh();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("cart:changed", onCartChanged);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("cart:changed", onCartChanged);
      window.removeEventListener("focus", refresh);
    };
  }, [brandSlug]);

  const total = useMemo(
    () =>
      (items || []).reduce(
        (acc, it) => acc + (Number(it.price || 0) * Number(it.qty || 0)),
        0
      ),
    [items]
  );

  // Botón "Vaciar"
  function clear() {
    if (!brandSlug) return;
    clearCartUtil(brandSlug);
    refresh();
  }

  return (
    <aside className="cart">
      <div className="cart__head">
        <strong>Carrito</strong>
        {!!items.length && (
          <button className="link" onClick={clear} title="Vaciar carrito">
            Vaciar
          </button>
        )}
      </div>

      {!items.length ? (
        <div className="empty">Tu carrito está vacío.</div>
      ) : (
        <>
          <ul className="list">
            {items.map((it, i) => (
              <li key={i} className="row">
                <div className="thumb" aria-hidden>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {it.thumb ? <img src={it.thumb} alt="" /> : <div className="ph" />}
                </div>

                <div className="info">
                  <div className="name">{it.name || "Producto"}</div>
                  <div className="sub">
                    ${Number(it.price || 0).toLocaleString("es-AR")}
                    {Number.isFinite(it.max) && it.max !== Infinity && (
                      <span className="max"> · máx. {it.max}</span>
                    )}
                  </div>
                </div>

                <div className="qty">
                  <span>x{it.qty || 1}</span>
                </div>
              </li>
            ))}
          </ul>

          <div className="total">
            <span>Total</span>
            <strong>${total.toLocaleString("es-AR")}</strong>
          </div>

          <Link href={`/checkout/${brandSlug}`} className="btnPrimary">
            Finalizar compra
          </Link>
        </>
      )}

      <style jsx>{`
        .cart { border:1px solid #1a1a1a; border-radius:12px; padding:12px; background:#0b0b0b; }
        .cart__head { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
        .link { background:none; border:none; color:#82aaff; cursor:pointer; }
        .empty { padding:10px; border:1px dashed #2a2a2a; border-radius:10px; text-align:center; }

        .list { display:grid; gap:8px; margin:8px 0; }
        .row { display:grid; grid-template-columns: 52px 1fr auto; gap:10px; align-items:center; border:1px solid #1a1a1a; border-radius:10px; padding:8px; background:#0f0f0f; }

        .thumb { width:52px; height:52px; border-radius:8px; overflow:hidden; border:1px solid #222; background:#0a0a0a; }
        .thumb img { width:100%; height:100%; object-fit:cover; display:block; }
        .ph { width:100%; height:100%; background:#111; }

        .name { font-weight:600; }
        .sub { opacity:.8; font-size:.92rem; }
        .max { opacity:.75; }

        .qty { font-weight:600; }

        .total { display:flex; justify-content:space-between; align-items:center; padding-top:8px; margin-top:8px; border-top:1px solid #1a1a1a; }
        .btnPrimary { display:block; text-align:center; margin-top:10px; padding:10px 12px; border-radius:10px; background:#2b5cff; border:1px solid #2b5cff; color:#fff; text-decoration:none; font-weight:600; }
        .btnPrimary:hover { filter:brightness(1.1); }
      `}</style>
    </aside>
  );
}
