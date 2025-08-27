// components/CartSidebar.jsx
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { loadCart, setQty, removeFromCart, cartTotal } from "@/utils/cart";

export default function CartSidebar({ brandSlug }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    setItems(loadCart(brandSlug).items);
  }, [brandSlug]);

  function changeQty(id, delta) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const next = setQty(brandSlug, id, (it.qty || 1) + delta);
    setItems(next);
  }

  function onRemove(id) {
    const next = removeFromCart(brandSlug, id);
    setItems(next);
  }

  const total = cartTotal(items);

  return (
    <aside className="cart">
      <div className="cart__head">
        <h3 style={{ margin: 0 }}>Tu carrito</h3>
      </div>

      {items.length === 0 ? (
        <div className="empty">Todavía no agregaste productos.</div>
      ) : (
        <>
          <ul className="cart__list">
            {items.map((it) => (
              <li key={it.id} className="cart__item">
                <div className="cart__info">
                  <div className="name">{it.name}</div>
                  <div className="price">${Number(it.price).toLocaleString("es-AR")}</div>
                </div>
                <div className="cart__qty">
                  <button className="btn ghost" onClick={() => changeQty(it.id, -1)} aria-label="Restar">-</button>
                  <span className="q">{it.qty}</span>
                  <button className="btn ghost" onClick={() => changeQty(it.id, +1)} aria-label="Sumar">+</button>
                </div>
                <button className="btn danger" onClick={() => onRemove(it.id)} aria-label="Quitar">Quitar</button>
              </li>
            ))}
          </ul>

          <div className="cart__foot">
            <div className="total">
              Total: <b>${total.toLocaleString("es-AR")}</b>
            </div>
            <Link href={`/checkout/${brandSlug}`} className="btn primary" aria-label="Finalizar compra">
              Finalizar compra
            </Link>
          </div>
        </>
      )}

      <style jsx>{`
        .cart { position: sticky; top: 84px; border:1px solid #1a1a1a; background:#0a0a0a; border-radius:14px; padding:12px; }
        .cart__head { padding-bottom:8px; border-bottom:1px solid #161616; margin-bottom:8px; }
        .empty { padding:14px; text-align:center; border:1px dashed #2a2a2a; border-radius:12px; }
        .cart__list { display:flex; flex-direction:column; gap:8px; margin:0; padding:0; list-style:none; }
        .cart__item { border:1px solid #1a1a1a; border-radius:12px; padding:8px; display:grid; grid-template-columns: 1fr auto auto; gap:8px; align-items:center; }
        .cart__info .name { font-weight:600; }
        .cart__qty { display:flex; align-items:center; gap:6px; }
        .cart__foot { border-top:1px solid #161616; margin-top:10px; padding-top:10px; display:flex; align-items:center; justify-content:space-between; }
        .btn { padding:6px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#161616; color:#fff; cursor:pointer; text-decoration:none; }
        .btn.ghost { background:#0f0f0f; }
        .btn.danger { background:#2a1616; border-color:#3a2323; }
        .btn.primary { background:#1a1f2f; border-color:#2a375a; }
      `}</style>
    </aside>
  );
}
