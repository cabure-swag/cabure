// components/CartSidebar.jsx
import React, { useEffect, useMemo, useState } from "react";

function currency(n) {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(Number(n || 0));
  } catch {
    return `$${n || 0}`;
  }
}

export default function CartSidebar({ brandSlug, className = "" }) {
  const storageKey = useMemo(() => `cart:${brandSlug}`, [brandSlug]);
  const [open, setOpen] = useState(true);
  const [items, setItems] = useState([]);

  // Cargar carrito desde localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // no-op
    }
  }, [storageKey]);

  // Guardar carrito cuando cambie
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // no-op
    }
  }, [items, storageKey]);

  // Escuchar cambios desde otras pestañas
  useEffect(() => {
    function onStorage(e) {
      if (e.key === storageKey) {
        try {
          setItems(JSON.parse(e.newValue || "[]"));
        } catch {
          setItems([]);
        }
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey]);

  const subtotal = useMemo(
    () =>
      items.reduce((acc, it) => acc + Number(it.price || 0) * Number(it.qty || 0), 0),
    [items]
  );

  function inc(idx) {
    setItems((arr) => {
      const copy = [...arr];
      const it = { ...copy[idx] };
      const next = Number(it.qty || 0) + 1;
      const max = Number(it.stock ?? Infinity);
      it.qty = Math.min(next, max);
      copy[idx] = it;
      return copy;
    });
  }

  function dec(idx) {
    setItems((arr) => {
      const copy = [...arr];
      const it = { ...copy[idx] };
      const next = Number(it.qty || 0) - 1;
      it.qty = Math.max(next, 1);
      copy[idx] = it;
      return copy;
    });
  }

  function removeIdx(idx) {
    setItems((arr) => arr.filter((_, i) => i !== idx));
  }

  function clear() {
    if (!items.length) return;
    if (!confirm("¿Vaciar carrito?")) return;
    setItems([]);
  }

  function checkout() {
    // Acá solo navegamos a la página de checkout de la marca si existe
    // o emitimos un evento para que la página actual resuelva el flujo.
    const ev = new CustomEvent("brand:checkout", { detail: { brandSlug, items } });
    window.dispatchEvent(ev);
    // Si ya tenés /checkout/[brandSlug], podés redirigir:
    try {
      const url = `/checkout/${encodeURIComponent(brandSlug)}`;
      if (window.location.pathname !== url) window.location.href = url;
    } catch {}
  }

  return (
    <aside
      className={`card`}
      style={{
        padding: 16,
        width: 360,
        border: "1px solid var(--border, #333)",
        borderRadius: 12,
        background: "var(--panel, #0f1115)",
        position: "sticky",
        top: 16,
        alignSelf: "flex-start",
        ...(/string/.test(typeof className) ? {} : {}),
      }}
    >
      <div className="row" style={{ alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontWeight: 700 }}>Carrito</h3>
        <div style={{ flex: 1 }} />
        <button
          className="btn btn-ghost"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Ocultar" : "Mostrar"}
        >
          {open ? "Ocultar" : "Mostrar"}
        </button>
      </div>

      {!open ? null : (
        <>
          {!items.length ? (
            <p style={{ opacity: 0.7, marginTop: 8 }}>Tu carrito está vacío.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {items.map((it, idx) => (
                <li
                  key={it.product_id ?? idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "64px 1fr auto",
                    gap: 12,
                    padding: "10px 0",
                    borderTop: "1px dashed var(--border, #333)",
                  }}
                >
                  <img
                    src={it.image || "/placeholder.png"}
                    alt={it.name || "Producto"}
                    width={64}
                    height={64}
                    style={{
                      width: 64,
                      height: 64,
                      objectFit: "cover",
                      borderRadius: 8,
                      background: "#1a1d24",
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, lineHeight: 1.2 }}>
                      {it.name || "Sin nombre"}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      {currency(it.price)} · Stock: {it.stock ?? "—"}
                    </div>
                    <div
                      className="row"
                      style={{ gap: 8, alignItems: "center", marginTop: 6 }}
                    >
                      <button className="btn btn-ghost" onClick={() => dec(idx)}>
                        −
                      </button>
                      <span style={{ minWidth: 20, textAlign: "center" }}>
                        {it.qty}
                      </span>
                      <button className="btn btn-ghost" onClick={() => inc(idx)}>
                        +
                      </button>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700 }}>{currency(it.price * it.qty)}</div>
                    <button
                      className="btn btn-ghost"
                      style={{ marginTop: 6 }}
                      onClick={() => removeIdx(idx)}
                    >
                      Quitar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: "1px solid var(--border, #333)",
            }}
          >
            <div className="row" style={{ marginBottom: 8 }}>
              <span style={{ opacity: 0.8 }}>Subtotal</span>
              <div style={{ flex: 1 }} />
              <strong>{currency(subtotal)}</strong>
            </div>

            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-ghost" onClick={clear}>
                Vaciar
              </button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={checkout}>
                Continuar
              </button>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
