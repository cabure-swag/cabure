// pages/marcas/[slug].jsx
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { addToCart } from "@/utils/cart";
import CartSidebar from "@/components/CartSidebar";
import Lightbox from "@/components/Lightbox";
import { pluralizeEs, normalizeImages } from "@/utils/formatters";

export default function BrandPage() {
  const router = useRouter();
  const { slug } = router.query;

  const [brand, setBrand] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState("Todas");

  // Lightbox
  const [lbOpen, setLbOpen] = useState(false);
  const [lbImages, setLbImages] = useState([]);
  const [lbIndex, setLbIndex] = useState(0);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);

      const { data: b } = await supabase
        .from("brands")
        .select("id, name, slug, description, logo_url, color, instagram_url, active, deleted_at")
        .eq("slug", slug)
        .maybeSingle();
      setBrand(b || null);

      let ps = [];
      if (b?.id) {
        const { data } = await supabase
          .from("products")
          .select("id, name, price, image_url, images, category, subcategory, active, deleted_at")
          .eq("brand_id", b.id)
          .eq("active", true)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });
        ps = data || [];
      }

      const normalized = ps.map((p) => ({ ...p, images: normalizeImages(p).slice(0, 5) }));
      setProducts(normalized);
      setLoading(false);
    })();
  }, [slug]);

  const categoriesPlural = useMemo(() => {
    const cats = new Set();
    for (const p of products) {
      const c = String(p.category || "").trim();
      if (c) cats.add(pluralizeEs(c));
    }
    return ["Todas", ...Array.from(cats)];
  }, [products]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return products.filter((p) => {
      const matchesText = !term
        ? true
        : [p.name, p.category, p.subcategory]
            .filter(Boolean)
            .some((t) => String(t).toLowerCase().includes(term));
      if (activeCat === "Todas") return matchesText;
      const plural = pluralizeEs(p.category || "");
      return matchesText && plural === activeCat;
    });
  }, [products, q, activeCat]);

  function handleAdd(p) {
    if (!brand?.slug) return;
    addToCart(brand.slug, p, 1);
  }

  function openLightbox(images = [], start = 0) {
    if (!images.length) return;
    setLbImages(images);
    setLbIndex(Math.max(0, Math.min(start, images.length - 1)));
    setLbOpen(true);
  }
  const lbPrev = () => setLbIndex((i) => (i <= 0 ? lbImages.length - 1 : i - 1));
  const lbNext = () => setLbIndex((i) => (i >= lbImages.length - 1 ? 0 : i + 1));

  return (
    <div className="container">
      <Head>
        <title>{brand?.name ? `${brand.name} — CABURE.STORE` : "Marca — CABURE.STORE"}</title>
        <meta name="description" content={brand?.description || "Catálogo"} />
        {brand?.slug && <link rel="canonical" href={`https://cabure.store/marcas/${brand.slug}`} />}
        {brand?.name && (
          <>
            <meta property="og:title" content={`${brand.name} — CABURE.STORE`} />
            <meta property="og:description" content={brand?.description || ""} />
            {brand?.logo_url && <meta property="og:image" content={brand.logo_url} />}
          </>
        )}
      </Head>

      {/* Perfil */}
      <header className="profile">
        <div className="profile__left">
          <div className="logoWrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {brand?.logo_url ? (
              <img src={brand.logo_url} alt={brand?.name || "Logo"} />
            ) : (
              <div className="logoPh">Logo</div>
            )}
          </div>
        </div>

        <div className="profile__center">
          <h1 style={{ margin: 0 }}>{brand?.name || "Marca"}</h1>
          {brand?.description && <p style={{ opacity: 0.85 }}>{brand.description}</p>}

          <div className="row" style={{ gap: 8 }}>
            {brand?.instagram_url && (
              <a
                href={brand.instagram_url}
                target="_blank"
                rel="noreferrer"
                className="chip"
                aria-label="Instagram"
                title="Instagram"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <g fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4.2" />
                    <circle cx="17.5" cy="6.5" r="1.2" />
                  </g>
                </svg>
                <span>Instagram</span>
              </a>
            )}
          </div>
        </div>

        <div className="profile__right">
          {brand?.slug && <CartSidebar brandSlug={brand.slug} />}
        </div>
      </header>

      {/* Filtros + búsqueda */}
      <section className="filters">
        <div className="chips">
          {categoriesPlural.map((cat) => (
            <button
              key={cat}
              className={`chip ${cat === activeCat ? "chip--active" : ""}`}
              onClick={() => setActiveCat(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <input
          className="inp"
          placeholder="Buscar en el catálogo…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar productos"
        />
      </section>

      {/* Catálogo */}
      <div className="grid">
        {loading ? (
          [...Array(8)].map((_, i) => (
            <div key={i} className="card">
              <div className="ph" />
              <div className="meta">
                <div className="ph ph-line" />
                <div className="ph ph-line small" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="empty">No hay productos para mostrar.</div>
        ) : (
          filtered.map((p) => (
            <ProductCard key={p.id} p={p} onAdd={() => handleAdd(p)} onZoom={openLightbox} />
          ))
        )}
      </div>

      {/* Lightbox */}
      <Lightbox
        open={lbOpen}
        images={lbImages}
        index={lbIndex}
        onClose={() => setLbOpen(false)}
        onPrev={lbPrev}
        onNext={lbNext}
      />

      <style jsx>{`
        .container { padding: 16px; }
        .row { display:flex; align-items:center; }

        .profile {
          display: grid;
          grid-template-columns: 320px 1fr 360px;
          gap: 16px;
          align-items: start;
          margin-bottom: 10px;
        }
        @media (max-width: 1100px) {
          .profile { grid-template-columns: 260px 1fr; }
          .profile__right { grid-column: 1 / -1; }
        }
        @media (max-width: 720px) {
          .profile { grid-template-columns: 1fr; }
        }

        .logoWrap {
          width: 100%;
          aspect-ratio: 1 / 1;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #1a1a1a;
          background: #0a0a0a;
        }
        .logoWrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .logoPh { display:flex; align-items:center; justify-content:center; width:100%; height:100%; color:#777; }

        .chip {
          display: inline-flex; gap: 6px; align-items:center;
          padding: 6px 10px; border-radius: 999px;
          background: #111; border: 1px solid #222; color:#fff;
          text-decoration: none; cursor: pointer;
        }
        .chip--active { background:#1a1f2f; border-color:#2a375a; }

        .filters { margin: 14px 0; display: grid; grid-template-columns: 1fr 280px; gap: 10px; }
        @media (max-width: 820px) { .filters { grid-template-columns: 1fr; } }
        .chips { display:flex; gap:8px; flex-wrap:wrap; }
        .inp { padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#0f0f0f; color:#fff; width:100%; }

        .grid { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:12px; }
        @media (max-width: 1100px) { .grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 780px)  { .grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 520px)  { .grid { grid-template-columns: 1fr; } }

        .empty {
          grid-column: 1 / -1;
          padding: 16px;
          border: 1px dashed #2a2a2a;
          border-radius: 12px;
          text-align: center;
        }

        .ph { width:100%; height:0; padding-bottom:100%; background:linear-gradient(90deg,#0f0f0f,#151515,#0f0f0f); animation:pulse 1.4s infinite; }
        .ph-line { height:12px; padding:0; border-radius:8px; margin-top:8px; }
        .ph-line.small { width:60%; }
        @keyframes pulse { 0%{opacity:.6} 50%{opacity:1} 100%{opacity:.6} }
      `}</style>
    </div>
  );
}

import React, { useState } from "react";
function ProductCard({ p, onAdd, onZoom }) {
  const [idx, setIdx] = useState(0);
  const images = (p.images || []).slice(0, 5);
  const src = images[idx] || images[0] || "";

  const prev = (e) => { e.stopPropagation(); if (!images.length) return; setIdx((i) => (i <= 0 ? images.length - 1 : i - 1)); };
  const next = (e) => { e.stopPropagation(); if (!images.length) return; setIdx((i) => (i >= images.length - 1 ? 0 : i + 1)); };

  return (
    <article className="card">
      <div className="imgWrap" onClick={() => onZoom?.(images, idx)} title="Ver en grande">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src ? <img src={src} alt={p.name} /> : <div className="imgPh">Sin imagen</div>}

        {images.length > 1 && (
          <>
            <button className="nav left" onClick={prev} aria-label="Anterior">‹</button>
            <button className="nav right" onClick={next} aria-label="Siguiente">›</button>
            <div className="dots" aria-hidden="true">
              {images.map((_, i) => (
                <span
                  key={i}
                  className={`dot ${i === idx ? "on" : ""}`}
                  onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="meta">
        <h3 className="title">{p.name}</h3>
        {(p.subcategory || p.category) && (
          <div className="sub">{p.subcategory || p.category}</div>
        )}
        <div className="price">${Number(p.price || 0).toLocaleString("es-AR")}</div>
        <button className="btn btn--primary" onClick={onAdd} aria-label={`Agregar ${p.name} al carrito`}>
          Agregar al carrito
        </button>
      </div>

      <style jsx>{`
        .card { border:1px solid #1a1a1a; background:#0a0a0a; border-radius:14px; overflow:hidden; display:flex; flex-direction:column; }
        .imgWrap { position:relative; width:100%; aspect-ratio: 1 / 1; background:#0f0f0f; cursor: zoom-in; }
        .imgWrap img { width:100%; height:100%; object-fit:cover; display:block; }
        .imgPh { width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#666; }
        .nav {
          position: absolute; top: 50%; transform: translateY(-50%);
          background: #151515aa; color: #fff;
          border: 1px solid #2a2a2a; border-radius: 50%;
          width: 34px; height: 34px; display:grid; place-items:center; cursor:pointer;
        }
        .left { left: 8px; }
        .right { right: 8px; }
        .dots { position: absolute; bottom: 8px; left: 0; right: 0; display:flex; justify-content:center; gap:6px; }
        .dot { width: 7px; height: 7px; border-radius: 50%; background: #666; cursor: pointer; }
        .dot.on { background: #fff; }

        .meta { padding:10px; display:flex; flex-direction:column; gap:6px; }
        .title { margin:0; font-size:16px; }
        .sub { font-size:12px; opacity:.8; }
        .price { font-weight:700; }
        .btn { padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#161616; color:#fff; cursor:pointer; }
        .btn--primary {
          background: #2563eb; /* azul */
          border-color: #1e3a8a;
        }
        .btn--primary:hover { filter: brightness(1.05); }
        .btn--primary:focus { outline: 2px solid #93c5fd; outline-offset: 2px; }
      `}</style>
    </article>
  );
}
