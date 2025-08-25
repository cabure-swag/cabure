// components/CartSidebar.jsx
import { useEffect, useMemo, useState } from "react";

function money(n) {
  const v = Number(n || 0);
  return `$${v.toLocaleString("es-AR")}`;
}

/**
 * Carrito por MARCA (se guarda en localStorage con clave cabure:cart:<brandId>)
 * items: [{ id, name, price, qty, image }]
 */
export default function CartSidebar({ brandId }) {
  const storageKey = useMemo(() => `cabure:cart:${brandId}`, [brandId]);
  const [open, setOpen] = useState(true);
  const [items, setItems] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {}
  }, [items, storageKey]);

  const subtotal = useMemo(
    () => items.reduce((acc, it) => acc + Number(it.price || 0) * Number(it.qty || 0), 0),
    [items]
  );

  function setQty(id, qty) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, qty: Math.max(1, qty | 0) } : it))
    );
  }

  function remove(id) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function clear() {
    setItems([]);
  }

  return (
    <aside className="card" style={{ padding: 16, minWidth: 340 }}>
      <div className="row" style={{ alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Carrito</h3>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={() => setOpen((o) => !o)}>
          {open ? "Ocultar" : "Ver"}
        </button>
      </div>

      {open && (
        <>
          <div className="divider" />
          {items.length === 0 ? (
            <p style={{ opacity: 0.7 }}>Tu carrito está vacío.</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {items.map((it) => (
                <div key={it.id} className="row" style={{ gap: 12, alignItems: "center" }}>
                  <img
                    src={it.image}
                    alt={it.name}
                    width={56}
                    height={56}
                    style={{ objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div className="ellipsis" title={it.name} style={{ fontWeight: 600 }}>
                      {it.name}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>{money(it.price)}</div>
                  </div>
                  <div style={{ marginLeft: "auto" }} />
                  <input
                    type="number"
                    min={1}
                    value={it.qty}
                    onChange={(e) => setQty(it.id, Number(e.target.value || 1))}
                    style={{ width: 64 }}
                  />
                  <button className="btn btn-ghost" onClick={() => remove(it.id)}>
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="divider" />
          <div className="row" style={{ alignItems: "center" }}>
            <div style={{ fontWeight: 700 }}>Subtotal</div>
            <div style={{ flex: 1 }} />
            <div style={{ fontWeight: 700 }}>{money(subtotal)}</div>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={clear}>
              Vaciar
            </button>
            <button
              className="btn btn-primary"
              onClick={() => alert("Continuar → (próximo paso: envío y método de pago)")}
            >
              Continuar
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
