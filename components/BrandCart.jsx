// components/BrandCart.jsx
import React, { useState } from "react";
import { useBrandCart } from "@/lib/brandCart";
import Link from "next/link";

export default function BrandCart() {
  const { items, setQty, remove, clear, subtotal, brandSlug } = useBrandCart();
  const [open, setOpen] = useState(true); // visible por defecto

  return (
    <aside
      className="brand-cart"
      style={{
        position: "sticky",
        top: 16,
        border: "1px solid var(--border, #2b2b2b)",
        borderRadius: 12,
        padding: 16,
        background: "var(--card, #111)",
        width: 340,
        maxHeight: "calc(100vh - 32px)",
        overflow: "hidden",
      }}
    >
      <div className="row" style={{ alignItems: "center", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 18 }}>Carrito</h3>
        <div style={{ flex: 1 }} />
        <button
          className="btn btn-ghost"
          onClick={() => setOpen((v) => !v)}
          aria-label="Contraer/expandir"
        >
          {open ? "Ocultar" : "Mostrar"}
        </button>
      </div>

      {open && (
        <>
          <div
            style={{
              marginTop: 12,
              borderTop: "1px dashed var(--border, #2b2b2b)",
              paddingTop: 12,
              overflowY: "auto",
              maxHeight: 420,
            }}
          >
            {items.length === 0 ? (
              <p style={{ opacity: 0.7, margin: 0 }}>Tu carrito está vacío.</p>
            ) : (
              items.map((it) => (
                <div
                  key={it.product_id}
                  className="row"
                  style={{
                    gap: 12,
                    padding: "8px 0",
                    borderBottom: "1px dashed var(--border, #2b2b2b)",
                    alignItems: "center",
                  }}
                >
                  <img
                    src={it.image_url || "/noimg.png"}
                    alt={it.name}
                    width={54}
                    height={54}
                    style={{ objectFit: "cover", borderRadius: 8 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{it.name}</div>
                    <div style={{ opacity: 0.7, fontSize: 13 }}>
                      ${Number(it.price).toLocaleString("es-AR")}
                    </div>
                    <div className="row" style={{ gap: 8, marginTop: 6 }}>
                      <button
                        className="btn btn-ghost"
                        onClick={() => setQty(it.product_id, Math.max(1, (it.qty || 1) - 1))}
                        aria-label="Quitar una unidad"
                      >
                        −
                      </button>
                      <input
                        value={it.qty ?? 1}
                        onChange={(e) =>
                          setQty(it.product_id, Number(e.target.value || 1))
                        }
                        type="number"
                        min={1}
                        max={it.stock ?? 999}
                        style={{
                          width: 56,
                          textAlign: "center",
                          background: "transparent",
                          border: "1px solid var(--border, #2b2b2b)",
                          borderRadius: 8,
                          padding: "6px 8px",
                          color: "inherit",
                        }}
                      />
                      <button
                        className="btn btn-ghost"
                        onClick={() =>
                          setQty(it.product_id, Math.min((it.qty || 1) + 1, it.stock ?? 999))
                        }
                        aria-label="Agregar una unidad"
                      >
                        +
                      </button>
                      <button
                        className="btn btn-ghost"
                        onClick={() => remove(it.product_id)}
                        aria-label="Eliminar del carrito"
                        style={{ marginLeft: "auto" }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div style={{ opacity: 0.8 }}>Subtotal</div>
              <div style={{ fontWeight: 700 }}>
                ${subtotal.toLocaleString("es-AR")}
              </div>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={clear} disabled={items.length === 0}>
                Vaciar
              </button>
              <div style={{ flex: 1 }} />
              <Link
                href={`/checkout/${brandSlug}`}
                className="btn btn-primary"
                aria-label="Ir al checkout"
                style={{ pointerEvents: items.length ? "auto" : "none", opacity: items.length ? 1 : 0.6 }}
              >
                Continuar
              </Link>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
