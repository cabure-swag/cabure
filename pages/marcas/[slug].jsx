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

      // Marca
      const { data: b } = await supabase
        .from("brands")
        .select("id, name, slug, description, logo_url, color, instagram_url, active, deleted_at, bank_alias, bank_cbu")
        .eq("slug", slug)
        .maybeSingle();
      setBrand(b || null);

      // Productos activos y no borrados
      let ps = [];
      if (b?.id) {
        const { data } = await supabase
          .from("products")
          // incluimos posibles nombres alternativos de stock
          .select("id, name, price, image_url, images, category, subcategory, active, deleted_at, stock_qty, stock")
          .eq("brand_id", b.id)
          .eq("active", true)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });
        ps = data || [];
      }

      // Normalización de imágenes y stock (robusto)
      const normalized = ps.map((p) => {
        const imgs = normalizeImages(p, 5);
        // toma el primer valor disponible entre stock_qty y stock
        const raw = p?.stock_qty ?? p?.stock ?? 1;
        // casteo seguro para .jsx (sin TypeScript)
        let stockNum = Number.parseInt(String(raw), 10);
        if (!Number.isFinite(stockNum) || Number.isNaN(stockNum)) stockNum = 1;
        stockNum = Math.max(0, stockNum);

        return { ...p, images: imgs, stock_qty: stockNum };
      });

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
    const max = Number.isFinite(p.stock_qty) ? Math.max(0, p.stock_qty) : 1;
    if (max <= 0) return; // agotado
    addToCart(brand.slug, p, 1, max);
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
        @media (max-width: 720px) { .profile { grid-template-columns: 1fr; } }

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
        .ph-line { height:12px; padding:0; border-radius:8px; margin-top:8px; background:#141414; }
        .ph-line.small { width:60%; }
        @keyframes pulse { 0%{opacity:.6} 50%{opacity:1} 100%{opacity:.6} }
      `}</style>
    </div>
  );
}

/** Tarjeta de producto con mini carrusel 1:1 y botón "Agregar" de color */
function ProductCard({ p, onAdd, onZoom }) {
  const [idx, setIdx] = useState(0);
  const images = (p.images || []).slice(0, 5);
  const current = images[idx] || "";
  const hasStock =
    Math.max(0, Number.parseInt(String(p?.stock_qty ?? 0), 10) || 0) > 0;

  const prev = (e) => { e.stopPropagation(); setIdx((i) => (i <= 0 ? images.length - 1 : i - 1)); };
  const next = (e) => { e.stopPropagation(); setIdx((i) => (i >= images.length - 1 ? 0 : i + 1)); };

  return (
    <article className="card">
      <div className="imgWrap" onClick={() => onZoom(images, idx)} role="button" aria-label="Ver imagen en grande">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {current ? <img src={current} alt={p.name || ""} /> : <div className="imgPh">Sin imagen</div>}
        {images.length > 1 && (
          <>
            <button className="nav left" onClick={prev} aria-label="Anterior">‹</button>
            <button className="nav right" onClick={next} aria-label="Siguiente">›</button>
          </>
        )}
      </div>

      <div className="meta">
        <div className="name">{p.name}</div>
        <div className="sub">
          {p.category ? String(p.category).trim() : "—"}
          {p.subcategory ? ` · ${p.subcategory}` : ""}
        </div>
        <div className="price">${Number(p.price || 0).toLocaleString("es-AR")}</div>

        <button className="btn btn-primary" onClick={onAdd} disabled={!hasStock}>
          {hasStock ? "Agregar al carrito" : "Agotado"}
        </button>
      </div>

      <style jsx>{`
        .card { border:1px solid #1d1d1d; border-radius:12px; overflow:hidden; background:#0b0b0b; }
        .imgWrap { position:relative; width:100%; aspect-ratio:1/1; background:#0f0f0f; cursor: zoom-in; }
        .imgWrap img { width:100%; height:100%; object-fit:cover; display:block; }
        .imgPh { width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#777; }
        .nav {
          position:absolute; top:50%; transform:translateY(-50%);
          width:28px; height:28px; border-radius:999px;
          background:#111; border:1px solid #333; color:#fff; cursor:pointer; opacity:.9;
        }
        .nav.left { left:6px; }
        .nav.right { right:6px; }

        .meta { padding:10px; display:flex; flex-direction:column; gap:6px; }
        .name { font-weight:600; }
        .sub { opacity:.8; font-size:.95rem; }
        .price { font-weight:700; margin-top:2px; }
        .btn { padding:8px 12px; border-radius:10px; border:1px solid #2a2a2a; background:#151515; color:#fff; cursor:pointer; }
        .btn-primary { background:#2b5cff; border-color:#2b5cff; }
        .btn-primary:hover { filter:brightness(1.12); }
        .btn:disabled { opacity:.6; cursor:not-allowed; }
      `}</style>
    </article>
  );
}
