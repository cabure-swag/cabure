import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export default function CartSidebar({ brand }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const key = brand ? `cart_${brand.id}` : null;

  useEffect(() => {
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      setItems(raw ? JSON.parse(raw).items || [] : []);
    } catch {}
  }, [key, open]);

  function total() {
    return (items || []).reduce((s, it) => s + (Number(it.unit_price || 0) * Number(it.qty || 0)), 0);
  }

  function updateQty(i, val) {
    const v = Math.max(0, Number(val || 0));
    const copy = [...items];
    copy[i].qty = v;
    if (v === 0) copy.splice(i, 1);
    persist(copy);
  }

  function persist(newItems) {
    setItems(newItems);
    try {
      localStorage.setItem(key, JSON.stringify({ items: newItems }));
    } catch {}
  }

  const count = useMemo(() => (items || []).reduce((s, it) => s + (Number(it.qty || 0)), 0), [items]);

  if (!brand) return null;

  return (
    <div className="cartBox">
      <button className="cartBtn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        Carrito {count > 0 ? `(${count})` : ""}
      </button>

      {open && (
        <div className="panel">
          {(items || []).length === 0 ? (
            <div className="empty">Tu carrito está vacío.</div>
          ) : (
            <>
              <ul className="list">
                {items.map((it, i) => (
                  <li key={i} className="row">
                    <div className="name">{it.name}</div>
                    <input
                      className="qty"
                      type="number"
                      min={0}
                      value={it.qty ?? 1}
                      onChange={(e) => updateQty(i, e.target.value)}
                      aria-label={`Cantidad para ${it.name}`}
                    />
                    <div className="price">${Number(it.unit_price || 0).toLocaleString("es-AR")}</div>
                  </li>
                ))}
              </ul>
              <div className="footer">
                <div className="total">Total: ${Number(total()).toLocaleString("es-AR")}</div>
                <Link href={`/checkout/${brand.slug}`} className="btn pay">Ir a pagar</Link>
              </div>
            </>
          )}
        </div>
      )}

      <style jsx>{`
        .cartBox { position: relative; }
        .cartBtn { padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#161616; color:#fff; }
        .panel { position:absolute; right:0; top:42px; z-index:30; width:320px; max-width:85vw; background:#0a0a0a; border:1px solid #1a1a1a; border-radius:12px; padding:10px; }
        .empty { padding:10px; border:1px dashed #2a2a2a; border-radius:10px; text-align:center; }
        .list { display:grid; gap:8px; margin:8px 0; }
        .row { display:grid; grid-template-columns: 1fr 70px 100px; gap:8px; align-items:center; }
        .qty { width:100%; padding:8px; border-radius:8px; border:1px solid #2a2a2a; background:#0f0f0f; color:#fff; }
        .price { text-align:right; }
        .footer { display:flex; gap:8px; align-items:center; justify-content:space-between; margin-top:8px; }
        .total { font-weight:700; }
        .btn.pay { padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#1a1a1a; color:#fff; }
      `}</style>
    </div>
  );
}
