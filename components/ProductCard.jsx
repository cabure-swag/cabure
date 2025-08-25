// components/ProductCard.jsx
import { useMemo, useState } from "react";

function money(n) {
  const v = Number(n || 0);
  return `$${v.toLocaleString("es-AR")}`;
}

export default function ProductCard({ product, onAdd }) {
  // Normalizo imágenes (máx 5)
  const images = useMemo(() => {
    const arr = Array.isArray(product.images) ? product.images : [];
    return arr.filter(Boolean).slice(0, 5);
  }, [product.images]);

  const [idx, setIdx] = useState(0);
  const hasImages = images.length > 0;
  const img = hasImages ? images[idx] : "/placeholder-1x1.png";

  function prev() {
    setIdx((i) => (i - 1 + images.length) % images.length);
  }
  function next() {
    setIdx((i) => (i + 1) % images.length);
  }

  const disabled = !(product.active && product.stock > 0);

  return (
    <article className="card" style={{ padding: 12 }}>
      <div
        style={{
          width: "100%",
          aspectRatio: "1 / 1", // cuadrado
          position: "relative",
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid var(--border)",
          background: "var(--muted)",
        }}
      >
        <img
          src={img}
          alt={product.name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        {hasImages && images.length > 1 && (
          <>
            <button
              className="btn btn-ghost"
              onClick={prev}
              style={{ position: "absolute", top: "45%", left: 8 }}
              aria-label="Anterior"
            >
              ◀
            </button>
            <button
              className="btn btn-ghost"
              onClick={next}
              style={{ position: "absolute", top: "45%", right: 8 }}
              aria-label="Siguiente"
            >
              ▶
            </button>
          </>
        )}
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 4 }}>
        <div className="ellipsis" title={product.name} style={{ fontWeight: 700 }}>
          {product.name}
        </div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          {product.subcategory || product.category || "\u00A0"}
        </div>
        <div style={{ fontWeight: 700 }}>{money(product.price)}</div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Stock: {Math.max(0, Number(product.stock || 0))}
        </div>

        <button
          disabled={disabled}
          className={disabled ? "btn btn-disabled" : "btn btn-primary"}
          onClick={() =>
            onAdd({
              id: product.id,
              name: product.name,
              price: product.price,
              image: img,
            })
          }
        >
          {disabled ? "Sin stock" : "Agregar"}
        </button>
      </div>
    </article>
  );
}
