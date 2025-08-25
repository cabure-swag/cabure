// pages/marcas/[slug].jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import CartSidebar from "@/components/CartSidebar"; // Asegúrate que exista
// Si tienes un contexto de carrito, impórtalo; si no, el botón "Agregar" puede ser no-op seguro
// import { useCart } from "@/components/CartContext";

function currency(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

export default function BrandPage() {
  const router = useRouter();
  const { slug } = router.query;

  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState(null);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("Todas");

  // const { addItem } = useCart?.() ?? { addItem: () => {} };

  // Carga marca + productos (sin filtros SQL) y filtra en cliente
  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      try {
        // 1) Marca
        const { data: b, error: e1 } = await supabase
          .from("brands")
          .select("id, name, slug, description, instagram_url, logo_url, color")
          .eq("slug", slug)
          .maybeSingle();
        if (e1) throw e1;
        setBrand(b || null);

        // 2) Productos de la marca, SIN filtrar (para evitar problemas de tipos con stock)
        if (b?.id) {
          const { data: ps, error: e2 } = await supabase
            .from("products")
            .select("id, name, price, stock, active, category, subcategory, images, brand_id")
            .eq("brand_id", b.id)
            .order("id", { ascending: false }); // ajusta si tienes created_at
          if (e2) throw e2;

          // 3) Filtro en cliente: activos + stock numérico > 0
          const visible = (ps || []).filter(
            (p) => Boolean(p.active) && Number(p.stock || 0) > 0
          );

          setProducts(visible);
        } else {
          setProducts([]);
        }
      } catch (err) {
        console.error("[brand page] fetch error:", err);
        setBrand(null);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  // Categorías únicas (solo de los visibles)
  const categories = useMemo(() => {
    const set = new Set();
    (products || []).forEach((p) => {
      const c = (p.category || "").trim();
      if (c) set.add(c);
    });
    return ["Todas", ...Array.from(set)];
  }, [products]);

  // Aplicar búsqueda + categoría
  const filtered = useMemo(() => {
    let data = products || [];
    if (activeCat && activeCat !== "Todas") {
      data = data.filter((p) => (p.category || "").trim() === activeCat);
    }
    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter((p) => p.name?.toLowerCase().includes(q));
    }
    return data;
  }, [products, activeCat, search]);

  const handleAdd = useCallback((product) => {
    // Si usas contexto de carrito:
    // addItem({ productId: product.id, brandId: brand?.id, price: product.price, qty: 1, name: product.name, image: (product.images?.[0] || null) });
    // Por ahora, simple feedback:
    console.log("Agregar al carrito:", product.id, product.name);
  }, []);

  return (
    <>
      <Head>
        <title>{brand?.name ? `${brand.name} — CABURE.STORE` : "CABURE.STORE"}</title>
      </Head>

      <div className="container" style={{ paddingBottom: 48 }}>
        {/* HEADER DE MARCA */}
        <section
          className="card"
          style={{
            display: "grid",
            gridTemplateColumns: "140px 1fr 360px",
            gap: 16,
            alignItems: "center",
            padding: 16,
          }}
        >
          {/* Logo grande, que ocupe el cuadro izquierdo */}
          <div
            style={{
              width: 140,
              height: 140,
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
              // Nota: si Next/Image complica por dominios, usa <img>
              <img
                src={brand.logo_url}
                alt={brand?.name || "logo"}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <div style={{ color: "#999", fontSize: 12 }}>Sin logo</div>
            )}
          </div>

          {/* Datos principales */}
          <div>
            <h1 style={{ margin: 0 }}>{brand?.name || "Marca"}</h1>
            {brand?.description ? (
              <p style={{ marginTop: 8, marginBottom: 12, color: "#bbb" }}>
                {brand.description}
              </p>
            ) : (
              <p style={{ marginTop: 8, marginBottom: 12, color: "#555" }}>
                {/* placeholder si no hay descripción */}
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
                  <span style={{ marginRight: 6 }}>📸</span> Instagram
                </a>
              )}
              {brand?.slug && (
                <Link href={`/marcas/${brand.slug}`} className="btn btn-ghost">
                  Perfil público
                </Link>
              )}
            </div>
          </div>

          {/* Carrito arriba a la derecha */}
          <div>
            <CartSidebar brandId={brand?.id} />
          </div>
        </section>

        {/* CONTROLES DEL CATÁLOGO (encima del grid) */}
        <section className="row" style={{ gap: 12, marginTop: 16, alignItems: "center" }}>
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

        {/* GRID DEL CATÁLOGO */}
        <section
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          {loading ? (
            <>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card skeleton" style={{ height: 380 }} />
              ))}
            </>
          ) : filtered.length === 0 ? (
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
            filtered.map((p) => (
              <ProductCard key={p.id} product={p} onAdd={() => handleAdd(p)} />
            ))
          )}
        </section>
      </div>

      {/* estilos mínimos para chips y grid */}
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

/** Tarjeta de producto cuadrada con carrusel/visor simple */
function ProductCard({ product, onAdd }) {
  const imgs = Array.isArray(product.images) ? product.images : [];
  const [idx, setIdx] = useState(0);

  const prev = useCallback(() => setIdx((i) => (i - 1 + imgs.length) % Math.max(imgs.length, 1)), [imgs.length]);
  const next = useCallback(() => setIdx((i) => (i + 1) % Math.max(imgs.length, 1)), [imgs.length]);

  return (
    <article className="card" style={{ padding: 12 }}>
      <div
        style={{
          width: "100%",
          aspectRatio: "1 / 1", // cuadradas
          borderRadius: 12,
          overflow: "hidden",
          position: "relative",
          background: "var(--panel)",
          border: "1px dashed var(--border)",
        }}
      >
        {imgs.length > 0 ? (
          // Usa img para evitar dom de Image domains
          <img
            src={imgs[idx]}
            alt={product.name}
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

      <h3 style={{ margin: "8px 0 0 0", fontSize: "1rem" }}>{product.name}</h3>
      <div style={{ color: "#9aa", fontSize: 12, marginTop: 2 }}>
        {product.category || "—"}
      </div>
      <div className="row" style={{ alignItems: "center", marginTop: 8 }}>
        <strong>{currency(product.price)}</strong>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={onAdd}>
          Agregar
        </button>
      </div>
    </article>
  );
}
