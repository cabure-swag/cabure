// pages/marcas/[slug].jsx
import React, { useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { BrandCartProvider, useBrandCart } from "@/lib/brandCart";
import BrandCart from "@/components/BrandCart";

// ---------- Tarjeta de Producto (usa el carrito sin redirigir) ----------
function ProductCard({ p }) {
  const { add } = useBrandCart();
  const [idx, setIdx] = useState(0);
  const imgs = p.images?.length ? p.images : (p.image_url ? [p.image_url] : []);
  const img = imgs[idx] || "/noimg.png";

  const next = () => setIdx((i) => (i + 1) % (imgs.length || 1));
  const prev = () => setIdx((i) => (i - 1 + (imgs.length || 1)) % (imgs.length || 1));

  const outOfStock = (p.stock ?? 0) <= 0 || p.active === false;

  return (
    <article
      className="card"
      style={{
        border: "1px solid var(--border, #2b2b2b)",
        borderRadius: 14,
        background: "var(--card, #121212)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "relative",
          aspectRatio: "1 / 1", // cuadrada como pediste
          background: "#0e0e0e",
        }}
      >
        <img
          src={img}
          alt={p.name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        {imgs.length > 1 && (
          <>
            <button
              className="btn btn-ghost"
              onClick={prev}
              aria-label="Imagen anterior"
              style={{
                position: "absolute",
                left: 8,
                top: "50%",
                transform: "translateY(-50%)",
                borderRadius: "50%",
                width: 34,
                height: 34,
              }}
            >
              ‹
            </button>
            <button
              className="btn btn-ghost"
              onClick={next}
              aria-label="Siguiente imagen"
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                borderRadius: "50%",
                width: 34,
                height: 34,
              }}
            >
              ›
            </button>
          </>
        )}
      </div>

      <div style={{ padding: 12 }}>
        <div style={{ fontWeight: 700 }}>{p.name}</div>
        {p.category && (
          <div style={{ opacity: 0.7, fontSize: 13, marginTop: 2 }}>{p.category}</div>
        )}
        <div style={{ marginTop: 8, fontWeight: 700 }}>
          ${Number(p.price).toLocaleString("es-AR")}
        </div>
        <div style={{ opacity: 0.7, fontSize: 13, marginTop: 2 }}>
          Stock: {p.stock ?? 0}
        </div>

        <button
          className="btn btn-primary"
          onClick={() => add(p, 1)}
          disabled={outOfStock}
          style={{ marginTop: 10, width: "100%" }}
          aria-label="Agregar al carrito"
        >
          {outOfStock ? "Sin stock" : "Agregar"}
        </button>
      </div>
    </article>
  );
}

// ------------------- Página Marca -------------------
export default function BrandPage({ brand, products }) {
  const brandSlug = brand?.slug;

  // categorías: siempre mostrar “Todas” + las de esta marca (aunque sea una sola)
  const categories = useMemo(() => {
    const set = new Set();
    (products || []).forEach((p) => p.category && set.add(p.category));
    return ["Todas", ...Array.from(set)];
  }, [products]);

  const [cat, setCat] = useState("Todas");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return (products || [])
      .filter((p) => p.active !== false) // ocultar desactivados
      .filter((p) => (cat === "Todas" ? true : p.category === cat))
      .filter((p) =>
        q.trim()
          ? (p.name || "").toLowerCase().includes(q.trim().toLowerCase())
          : true
      );
  }, [products, cat, q]);

  return (
    <BrandCartProvider brandSlug={brandSlug}>
      <Head>
        <title>{brand?.name ? `${brand.name} — CABURE.STORE` : "Marca — CABURE.STORE"}</title>
      </Head>

      <header className="container" style={{ marginTop: 12 }}>
        <div
          className="card"
          style={{
            border: "1px solid var(--border, #2b2b2b)",
            borderRadius: 14,
            padding: 16,
            background: "var(--card, #121212)",
          }}
        >
          <div className="row" style={{ gap: 14, alignItems: "center" }}>
            <img
              src={brand.logo_url || "/noimg.png"}
              alt={brand.name}
              width={84}
              height={84}
              style={{ objectFit: "contain", background: "#0e0e0e", borderRadius: 12 }}
            />
            <div style={{ flex: 1 }}>
              <h1 style={{ margin: 0 }}>{brand.name}</h1>
              {brand.description && (
                <p style={{ margin: "6px 0 0 0", opacity: 0.8 }}>{brand.description}</p>
              )}
              {brand.instagram_url && (
                <div style={{ marginTop: 6 }}>
                  <Link href={brand.instagram_url} target="_blank" className="btn btn-ghost" aria-label="Instagram de la marca">
                    <span style={{ marginRight: 6 }}>📷</span> Instagram
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Filtros */}
          <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {categories.map((c) => (
              <button
                key={c}
                className={`btn ${cat === c ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setCat(c)}
              >
                {c}
              </button>
            ))}
            <input
              placeholder="Buscar producto…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{
                marginLeft: "auto",
                minWidth: 220,
                background: "transparent",
                border: "1px solid var(--border, #2b2b2b)",
                borderRadius: 10,
                padding: "8px 10px",
                color: "inherit",
              }}
            />
          </div>
        </div>
      </header>

      {/* Layout con carrito a la derecha */}
      <main
        className="container"
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "1fr 360px",
          alignItems: "start",
          marginTop: 16,
        }}
      >
        {/* Grilla de productos */}
        <section
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))", // 4 por fila
          }}
        >
          {filtered.length === 0 ? (
            <p style={{ opacity: 0.8 }}>No hay productos para mostrar.</p>
          ) : (
            filtered.map((p) => <ProductCard key={p.id} p={p} />)
          )}
        </section>

        {/* Carrito por marca */}
        <BrandCart />
      </main>

      <footer className="container" style={{ opacity: 0.6, fontSize: 12, margin: "24px 0" }}>
        © {new Date().getFullYear()} CABURE.STORE
      </footer>
    </BrandCartProvider>
  );
}

// --------- Data Fetch ----------
export async function getServerSideProps(ctx) {
  const { slug } = ctx.params || {};
  // brand
  const { data: brand, error: e1 } = await supabase
    .from("brands")
    .select("id, name, slug, description, instagram_url, logo_url, color, active")
    .eq("slug", slug)
    .maybeSingle();

  if (e1 || !brand || brand.active === false) {
    return { notFound: true };
  }

  // products (activos o con stock > 0)
  const { data: products, error: e2 } = await supabase
    .from("products")
    .select("id, name, price, stock, category, image_url, images, active")
    .eq("brand_id", brand.id)
    .order("id", { ascending: false });

  return {
    props: {
      brand,
      products: products || [],
    },
  };
}
