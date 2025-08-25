// pages/marcas/[slug].jsx
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

// Panel de carrito simple embebido (para no romper si faltan imports externos)
function CartPanel() {
  const [open, setOpen] = useState(true);
  return (
    <aside className="card" style={{ padding: 12 }}>
      <div className="row" style={{ alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Carrito</h3>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={() => setOpen((v) => !v)}>
          {open ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      {open && (
        <>
          <div
            style={{
              marginTop: 8,
              padding: 12,
              borderRadius: 10,
              background: "var(--panel)",
              border: "1px dashed var(--border)",
              color: "#9aa",
              fontSize: 14,
            }}
          >
            Tu carrito está vacío.
          </div>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button className="btn btn-ghost">Vaciar</button>
            <button className="btn btn-primary">Continuar</button>
            <div style={{ flex: 1 }} />
            <strong>$0</strong>
          </div>
        </>
      )}
    </aside>
  );
}

function currency(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

export default function BrandPage() {
  const router = useRouter();
  const { slug } = router.query;

  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState(null);
  const [productsRaw, setProductsRaw] = useState([]);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("Todas");

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // Marca
        const { data: b, error: e1 } = await supabase
          .from("brands")
          .select("id, name, slug, description, instagram_url, logo_url, color")
          .eq("slug", slug)
          .maybeSingle();
        if (e1) throw e1;

        if (!cancelled) setBrand(b || null);

        // Productos (sin filtrar en SQL para evitar problemas de tipos)
        if (b?.id) {
          const { data: ps, error: e2 } = await supabase
            .from("products")
            .select(
              "id, name, price, stock, active, category, subcategory, images, brand_id"
            )
            .eq("brand_id", b.id)
            .order("id", { ascending: false });
          if (e2) throw e2;
          if (!cancelled) setProductsRaw(ps || []);
        } else {
          if (!cancelled) setProductsRaw([]);
        }
      } catch (err) {
        console.error("[/marcas/[slug]] fetch error:", err);
        if (!cancelled) {
          setBrand(null);
          setProductsRaw([]);
        }
      } finally {
        !cancelled && setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Filtrado seguro en cliente
  const products = useMemo(() => {
    const base = Array.isArray(productsRaw) ? productsRaw : [];
    let data = base.filter(
      (p) => Boolean(p?.active) && Number(p?.stock || 0) > 0
    );
    if (activeCat && activeCat !== "Todas") {
      data = data.filter(
        (p) => (p?.category || "").trim() === (activeCat || "").trim()
      );
    }
    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter((p) => p?.name?.toLowerCase().includes(q));
    }
    return data;
  }, [productsRaw, activeCat, search]);

  // Categorías únicas (de los visibles)
  const categories = useMemo(() => {
    const s = new Set();
    (Array.isArray(productsRaw) ? productsRaw : []).forEach((p) => {
      const c = (p?.category || "").trim();
      if (c) s.add(c);
    });
    return ["Todas", ...Array.from(s)];
  }, [productsRaw]);

  const handleAdd = useCallback((product) => {
    // acá integrás con tu contexto de carrito si lo deseas
    // por ahora dejamos no-op para no romper
    console.log("ADD ->", product?.id, product?.name);
  }, []);

  return (
    <>
      <Head>
        <title>
          {brand?.name ? `${brand.name} — CABURE.STORE` : "CABURE.STORE"}
        </title>
      </Head>

      <div className="container" style={{ paddingBottom: 48 }}>
        {/* HEADER (mismo estilo base) */}
        <section
          className="card"
          style={{
            display: "grid",
            gridTemplateColumns: "160px 1fr 360px",
            gap: 16,
            alignItems: "center",
            padding: 16,
          }}
        >
          {/* Logo grande a la izquierda, usando todo el cuadrado */}
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: 16,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--panel)",
              border: "1px dashed var(--border)",
            }}
          >
            {brand?.logo_url ? (
              <img
                src={brand.logo_url}
                alt={brand?.name || "logo"}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <div style={{ color: "#999", fontSize: 12 }}>Sin logo</div>
            )}
          </div>

          {/* Centro: título y descripción, Instagram */}
          <div>
            <h1 style={{ margin: 0 }}>{brand?.name || "Marca"}</h1>
            {brand?.description && (
              <p style={{ margin: "6px 0 12px 0", color: "#bbb" }}>
                {brand.description}
              </p>
            )}
            <div className="row" style={{ gap: 8 }}>
              {brand?.instagram_url && (
                <a
                  href={brand.instagram_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost"
                  aria-label="Instagram"
                >
                  <span style={{ marginRight: 6 }}>📸</span>
                  Instagram
                </a>
              )}
              {brand?.slug && (
                <Link href={`/marcas/${brand.slug}`} className="btn btn-ghost">
                  Perfil público
                </Link>
              )}
            </div>
          </div>

          {/* Derecha: carrito fijo */}
          <CartPanel />
        </section>

        {/* CONTROLES encima del catálogo (chips + buscador) */}
        <section className="row" style={{ gap: 12, marginTop: 16 }}>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`chip ${activeCat === cat ? "chip--active" : ""}`}
                onClick={() => setActiveCat(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto…"
            className="input"
            style={{ maxWidth: 320 }}
            aria-label="Buscar producto"
          />
        </section>

        {/* GRID DEL CATÁLOGO (4 por fila) */}
        <section
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card skeleton" style={{ height: 380 }} />
            ))
          ) : products.length === 0 ? (
            <div
              className="card"
              style={{
                gridColumn: "1 / -1",
                padding: 24,
                textAlign: "center",
                border: "1px dashed var(--border)",
              }}
            >
              No hay productos para mostrar.
            </div>
          ) : (
            products.map((p) => (
              <ProductCard key={p.id} product={p} onAdd={() => handleAdd(p)} />
            ))
          )}
        </section>
      </div>

      <style jsx>{`
        .chip {
          background: var(--panel);
          color: var(--text);
          border: 1px solid var(--border);
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 0.9rem;
        }
        .chip--active {
          background: var(--brand);
          color: #000;
          border-color: var(--brand);
        }
        .input {
          width: 100%;
          background: var(--panel);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 10px 12px;
          border-radius: 10px;
          outline: none;
        }
        .skeleton {
          opacity: 0.5;
        }
      `}</style>
    </>
  );
}

function ProductCard({ product, onAdd }) {
  const imgs = Array.isArray(product?.images) ? product.images : [];
  const [idx, setIdx] = useState(0);

  const prev = () => setIdx((i) => (imgs.length ? (i - 1 + imgs.length) % imgs.length : 0));
  const next = () => setIdx((i) => (imgs.length ? (i + 1) % imgs.length : 0));

  return (
    <article className="card" style={{ padding: 12 }}>
      <div
        style={{
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 12,
          overflow: "hidden",
          position: "relative",
          background: "var(--panel)",
          border: "1px dashed var(--border)",
        }}
      >
        {imgs.length ? (
          <img
            src={imgs[idx]}
            alt={product?.name || "producto"}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#888",
              fontSize: 12,
            }}
          >
            Sin imagen
          </div>
        )}

        {imgs.length > 1 && (
          <>
            <button
              onClick={prev}
              className="btn btn-ghost"
              style={{ position: "absolute", left: 8, top: "calc(50% - 18px)" }}
              aria-label="Anterior"
            >
              ◀
            </button>
            <button
              onClick={next}
              className="btn btn-ghost"
              style={{ position: "absolute", right: 8, top: "calc(50% - 18px)" }}
              aria-label="Siguiente"
            >
              ▶
            </button>
          </>
        )}
      </div>

      <h3 style={{ margin: "8px 0 0 0", fontSize: "1rem" }}>{product?.name || "Producto"}</h3>
      <div style={{ color: "#9aa", fontSize: 12, marginTop: 2 }}>
        {(product?.category || "").trim() || "—"}
      </div>

      <div className="row" style={{ alignItems: "center", marginTop: 8 }}>
        <strong>{currency(product?.price)}</strong>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={onAdd}>
          Agregar
        </button>
      </div>
    </article>
  );
}
