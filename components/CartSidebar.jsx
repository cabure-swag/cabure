// components/CartSidebar.jsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function readCart(slug) {
  try {
    const raw = localStorage.getItem(`cart:${slug}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeCart(slug, items) {
  localStorage.setItem(`cart:${slug}`, JSON.stringify(items || []));
  // Dispara un evento manual para que otros componentes/ventanas reaccionen
  window.dispatchEvent(new StorageEvent("storage", { key: `cart:${slug}` }));
}

export default function CartSidebar({ brandSlug }) {
  const [items, setItems] = useState([]);

  // Carga inicial
  useEffect(() => {
    if (!brandSlug) return;
    setItems(readCart(brandSlug));
  }, [brandSlug]);

  // Reacción a cambios en otras pestañas/componentes
  useEffect(() => {
    if (!brandSlug) return;
    const onStorage = (e) => {
      if (e.key === `cart:${brandSlug}` || e.key === null) {
        setItems(readCart(brandSlug));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [brandSlug]);

  const total = useMemo(
    () =>
      (items || []).reduce(
        (acc, it) => acc + (Number(it.price || 0) * Number(it.qty || 0)),
        0
      ),
    [items]
  );

  function inc(i) {
    const copy = [...items];
    const max = Number.isFinite(copy[i]?.max) ? Math.max(0, copy[i].max) : Infinity;
    const next = Math.min((copy[i].qty || 1) + 1, max);
    copy[i] = { ...copy[i], qty: next };
    setItems(copy);
    writeCart(brandSlug, copy);
  }
  function dec(i) {
    const copy = [...items];
    const next = Math.max((copy[i].qty || 1) - 1, 1);
    copy[i] = { ...copy[i], qty: next };
    setItems(copy);
    writeCart(brandSlug, copy);
  }
  function remove(i) {
    const copy = items.filter((_, idx) => idx !== i);
    setItems(copy);
    writeCart(brandSlug, copy);
  }
  function clear() {
    setItems([]);
    writeCart(brandSlug, []);
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
                <div className="info">
                  <div className="name">{it.name || "Producto"}</div>
                  <div className="sub">
                    ${Number(it.price || 0).toLocaleString("es-AR")}
                    {Number.isFinite(it.max) && (
                      <span className="max"> · máx. {it.max}</span>
                    )}
                  </div>
                </div>

                <div className="qty">
                  <button onClick={() => dec(i)} aria-label="Disminuir">−</button>
                  <span>{it.qty || 1}</span>
                  <button onClick={() => inc(i)} aria-label="Aumentar">+</button>
                </div>

                <button className="remove" onClick={() => remove(i)} title="Quitar">
                  ✕
                </button>
              </li>
            ))}
          </ul>

          <div className="total">
            <span>Total</span>
            <strong>${total.toLocaleString("es-AR")}</strong>
          </div>

          {/* 🔴 ACÁ el cambio importante: ruta dinámica */}
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
        .row { display:grid; grid-template-columns: 1fr auto auto; gap:8px; align-items:center; border:1px solid #1a1a1a; border-radius:10px; padding:8px; background:#0f0f0f; }
        .name { font-weight:600; }
        .sub { opacity:.8; font-size:.92rem; }
        .max { opacity:.75; }
        .qty { display:flex; align-items:center; gap:8px; }
        .qty button { width:26px; height:26px; border-radius:6px; background:#151515; border:1px solid #2a2a2a; color:#fff; cursor:pointer; }
        .remove { width:26px; height:26px; border-radius:6px; background:#151515; border:1px solid #2a2a2a; color:#fff; cursor:pointer; }
        .total { display:flex; justify-content:space-between; align-items:center; padding-top:8px; margin-top:8px; border-top:1px solid #1a1a1a; }
        .btnPrimary { display:block; text-align:center; margin-top:10px; padding:10px 12px; border-radius:10px; background:#2b5cff; border:1px solid #2b5cff; color:#fff; text-decoration:none; font-weight:600; }
        .btnPrimary:hover { filter:brightness(1.1); }
      `}</style>
    </aside>
  );
}
