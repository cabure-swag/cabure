import { useEffect, useMemo, useState } from "react";
import { readBrandCart, writeBrandCart, clearBrandCart } from "@/utils/brandCart";

export default function CartSidebar({ brandSlug, compact = false }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!brandSlug) return;
    setItems(readBrandCart(brandSlug));
    const onStorage = (e) => {
      if (e.key === `cabure:cart:${brandSlug}`) {
        setItems(readBrandCart(brandSlug));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [brandSlug]);

  const subtotal = useMemo(
    () => items.reduce((acc, it) => acc + Number(it.price || 0) * Number(it.qty || 1), 0),
    [items]
  );

  const setQty = (id, v) => {
    const n = Math.max(1, Number(v || 1));
    const next = items.map((it) => (it.id === id ? { ...it, qty: n } : it));
    setItems(next);
    writeBrandCart(brandSlug, next);
  };

  const remove = (id) => {
    const next = items.filter((it) => it.id !== id);
    setItems(next);
    writeBrandCart(brandSlug, next);
  };

  const clear = () => {
    clearBrandCart(brandSlug);
    setItems([]);
  };

  return (
    <aside className={`cart ${compact ? "cart--compact" : ""}`}>
      <div className="head">
        <h3>Carrito</h3>
        <div className="spacer" />
        <button className="btn sm" onClick={() => document.body.classList.toggle("cart-hide")}>
          {compact ? "Ocultar" : "Cerrar"}
        </button>
      </div>

      <div className="list">
        {items.length === 0 ? (
          <div className="empty">Tu carrito está vacío.</div>
        ) : (
          items.map((it) => (
            <div className="row" key={it.id}>
              <div className="name">{it.name}</div>
              <input
                className="qty"
                type="number"
                min={1}
                value={Number(it.qty || 1)}
                onChange={(e) => setQty(it.id, e.target.value)}
              />
              <div className="price">${Number(it.price || 0) * Number(it.qty || 1)}</div>
              <button className="x" aria-label="Eliminar" onClick={() => remove(it.id)}>
                ×
              </button>
            </div>
          ))
        )}
      </div>

      <div className="foot">
        <div className="subtotal">
          <span>Subtotal</span>
          <strong>${subtotal}</strong>
        </div>
        <div className="actions">
          <button className="btn ghost" onClick={clear} disabled={items.length === 0}>
            Vaciar
          </button>
          <button
            className="btn"
            disabled={items.length === 0}
            onClick={() => (window.location.href = `/checkout/${brandSlug}`)}
          >
            Continuar
          </button>
        </div>
      </div>

      <style jsx>{`
        .cart {
          background: #0b0d11;
          border: 1px solid #1f2430;
          border-radius: 12px;
          padding: 12px;
        }
        .head {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .head h3 {
          margin: 0;
          font-size: 16px;
        }
        .spacer {
          flex: 1;
        }
        .list {
          margin: 10px 0;
          display: grid;
          gap: 8px;
          max-height: 300px;
          overflow: auto;
        }
        .row {
          display: grid;
          grid-template-columns: 1fr 60px 90px 26px;
          gap: 6px;
          align-items: center;
          border: 1px solid #1f2430;
          border-radius: 8px;
          padding: 6px 8px;
          background: #0f1115;
        }
        .name {
          font-size: 13px;
        }
        .qty {
          width: 100%;
          height: 30px;
          background: #0b0d11;
          color: #e8ecf8;
          border: 1px solid #1f2430;
          border-radius: 8px;
          padding: 0 6px;
        }
        .price {
          text-align: right;
        }
        .x {
          background: transparent;
          border: none;
          color: #a8b3cf;
          cursor: pointer;
          font-size: 18px;
        }
        .empty {
          color: #a8b3cf;
          text-align: center;
          border: 1px dashed #1f2430;
          border-radius: 8px;
          padding: 14px;
        }
        .foot {
          border-top: 1px solid #1f2430;
          padding-top: 10px;
          display: grid;
          gap: 10px;
        }
        .subtotal {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .actions {
          display: flex;
          gap: 8px;
        }
        .btn {
          height: 36px;
          border-radius: 10px;
          background: #00f0b5;
          color: #0b0d11;
          font-weight: 700;
          border: none;
          padding: 0 12px;
          cursor: pointer;
        }
        .btn.ghost {
          background: #0b0d11;
          color: #e8ecf8;
          border: 1px solid #1f2430;
        }
        .btn.sm {
          height: 30px;
          border-radius: 8px;
          padding: 0 10px;
        }
        .btn[disabled] {
          background: #222b36;
          color: #7a859b;
          cursor: not-allowed;
        }
      `}</style>
    </aside>
  );
}
