// pages/marcas/[slug].jsx
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import CartSidebar from "@/components/CartSidebar";

export default function BrandPage() {
  const router = useRouter();
  const { slug } = router.query;

  const [brand, setBrand] = useState(null);
  const [loadingBrand, setLoadingBrand] = useState(true);

  const [productsRaw, setProductsRaw] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Filtros (arriba del catálogo)
  const [activeCat, setActiveCat] = useState("Todas");
  const [q, setQ] = useState("");

  // --- helpers ---
  function normalizeImages(images, image_url) {
    try {
      if (Array.isArray(images)) return images.filter(Boolean);
      if (typeof images === "string" && images.trim().startsWith("[")) {
        const arr = JSON.parse(images);
        return Array.isArray(arr) ? arr.filter(Boolean) : [];
      }
    } catch {}
    return image_url ? [image_url] : [];
  }
  function primaryImage(p) {
    const imgs = normalizeImages(p?.images, p?.image_url);
    return imgs[0] || "/placeholder.png";
  }

  // --- fetch brand ---
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    (async () => {
      setLoadingBrand(true);
      const { data: b, error } = await supabase
        .from("brands")
        .select("id,name,slug,description,logo_url,color,instagram_url,bank_alias,bank_cbu,mp_access_token,deleted_at,active")
        .eq("slug", slug)
        .is("deleted_at", null)
        .maybeSingle();

      if (!cancelled) {
        setLoadingBrand(false);
        if (!error && b) setBrand(b);
        else setBrand(null);
      }
    })();

    return () => { cancelled = true; };
  }, [slug]);

  // --- fetch products (solo activos y no borrados) ---
  useEffect(() => {
    if (!brand?.id) return;
    let cancelled = false;

    (async () => {
      setLoadingProducts(true);
      const { data, error } = await supabase
        .from("products")
        .select("id,brand_id,name,price,image_url,images,category,subcategory,active,stock,deleted_at,created_at")
        .eq("brand_id", brand.id)
        .eq("active", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (!cancelled) {
        setLoadingProducts(false);
        if (!error) setProductsRaw(data || []);
      }
    })();

    return () => { cancelled = true; };
  }, [brand?.id]);

  // categorías dinámicas (sin “Todas”)
  const categories = useMemo(() => {
    const setC = new Set();
    (productsRaw || []).forEach((p) => {
      const c = (p?.category || "").trim();
      if (c) setC.add(c);
    });
    return ["Todas", ...Array.from(setC)];
  }, [productsRaw]);

  // aplicar filtros + búsqueda
  const products = useMemo(() => {
    let arr = productsRaw || [];
    if (activeCat !== "Todas") {
      arr = arr.filter((p) => (p.category || "").trim() === activeCat);
    }
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      arr = arr.filter((p) => (p.name || "").toLowerCase().includes(t));
    }
    return arr;
  }, [productsRaw, activeCat, q]);

  return (
    <div className="container">
      <Head>
        <title>{brand?.name ? `${brand.name} — CABURE.STORE` : "Marca — CABURE.STORE"}</title>
        {brand?.description && <meta name="description" content={brand.description} />}
        {brand?.slug && <link rel="canonical" href={`https://cabure.store/marcas/${brand.slug}`} />}
        <meta property="og:title" content={brand?.name || "CABURE.STORE"} />
        <meta property="og:site_name" content="CABURE.STORE" />
        <meta property="og:type" content="website" />
        {brand?.logo_url && <meta property="og:image" content={brand.logo_url} />}
      </Head>

      {/* Header de perfil */}
      <section className="brandHeader">
        <div className="left">
          <div className="logoWrap">
            {brand?.logo_url ? (
              // Usamos <img> para evitar bloqueos por dominios no whitelisted en next/image
              <img src={brand.logo_url} alt={`${brand.name} logo`} className="logoImg" loading="lazy" />
            ) : (
              <div className="noLogo">Sin logo</div>
            )}
          </div>
        </div>

        <div className="right">
          {loadingBrand ? (
            <div className="skeleton" style={{ height: 90 }} />
          ) : !brand ? (
            <div className="empty">Marca no encontrada.</div>
          ) : (
            <>
              <div className="row" style={{ alignItems: "start", gap: 12 }}>
                <h1 className="brandTitle" style={{ margin: 0 }}>{brand.name}</h1>
                {brand.instagram_url && (
                  <a
                    href={brand.instagram_url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Instagram"
                    className="ig"
                    title="Instagram"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M7 2C4.243 2 2 4.243 2 7v10c0 2.757 2.243 5 5 5h10c2.757 0 5-2.243 5-5V7c0-2.757-2.243-5-5-5H7zm10 2a3 3 0 013 3v10a3 3 0 01-3 3H7a3 3 0 01-3-3V7a3 3 0 013-3h10zm-5 3a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6zm4.5-2.75a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5z"/>
                    </svg>
                  </a>
                )}
                <div style={{ flex: 1 }} />
                {/* Carrito a la derecha del perfil */}
                <CartSidebar brand={brand} />
              </div>
              {brand.description && <p className="brandDesc">{brand.description}</p>}
            </>
          )}
        </div>
      </section>

      {/* Filtros + búsqueda (ARRIBA del catálogo) */}
      <section className="filters">
        <div className="chips" role="tablist" aria-label="Filtrar por categoría">
          {categories.map((cat) => (
            <button
              key={cat}
              role="tab"
              className={`chip ${cat === activeCat ? "chip--active" : ""}`}
              onClick={() => setActiveCat(cat)}
              aria-selected={cat === activeCat}
            >
              {cat}
            </button>
          ))}
        </div>
        <input
          className="search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar producto…"
          aria-label="Buscar producto"
        />
      </section>

      {/* Catálogo */}
      <section className="grid" aria-live="polite">
        {loadingProducts && (
          <>
            <div className="skeleton card" />
            <div className="skeleton card" />
            <div className="skeleton card" />
            <div className="skeleton card" />
          </>
        )}

        {!loadingProducts && products.length === 0 && (
          <div className="empty" style={{ gridColumn: "1 / -1" }}>
            No hay productos para mostrar.
          </div>
        )}

        {products.map((p) => (
          <article key={p.id} className="card">
            <div className="imgWrap">
              <img
                src={primaryImage(p)}
                alt={p.name}
                className="prodImg"
                loading="lazy"
              />
            </div>
            <div className="body">
              <div className="name">{p.name}</div>
              {p.subcategory && <div className="sub">{p.subcategory}</div>}
              <div className="row" style={{ alignItems: "center", gap: 8 }}>
                <div className="price">${Number(p.price || 0).toLocaleString("es-AR")}</div>
                <div style={{ flex: 1 }} />
                <button className="btn" onClick={() => addToCart(brand, p)}>Agregar</button>
              </div>
            </div>
          </article>
        ))}
      </section>

      <style jsx>{`
        .container { padding: 16px; }
        .row { display: flex; }

        .brandHeader {
          display:grid;
          grid-template-columns: 340px 1fr;
          gap:16px;
          align-items:start;
        }
        @media (max-width: 900px){ .brandHeader { grid-template-columns: 1fr; } }

        .logoWrap {
          position:relative;
          width:100%;
          aspect-ratio:1/1; /* cuadrado completo */
          border-radius:16px;
          overflow:hidden;
          border:1px solid #222;
          background:#0a0a0a;
        }
        .logoImg {
          width:100%;
          height:100%;
          object-fit:cover;
          display:block;
        }
        .noLogo { display:flex; align-items:center; justify-content:center; height:100%; color:#999; }

        .brandTitle { font-size:1.8rem; }
        .brandDesc { opacity:.85; margin-top:8px; }

        .ig {
          display:inline-flex; align-items:center; justify-content:center;
          width:36px; height:36px; border-radius:10px;
          border:1px solid #2a2a2a; color:#fff;
        }
        .ig:hover { background:#151515; }

        .filters { display:flex; gap:12px; align-items:center; margin-top:16px; flex-wrap:wrap; }
        .chips { display:flex; gap:8px; flex-wrap:wrap; }
        .chip { padding:8px 12px; border-radius:999px; border:1px solid #2a2a2a; background:#0f0f0f; color:#fff; cursor:pointer; }
        .chip--active { background:#171717; border-color:#3a3a3a; }
        .search { flex:1; min-width:220px; padding:10px 12px; border-radius:10px; border:1px solid #2a2a2a; background:#0f0f0f; color:#fff; }

        .grid { display:grid; grid-template-columns: repeat(4, 1fr); gap:16px; margin-top:16px; }
        @media (max-width: 1200px){ .grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 900px){ .grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 540px){ .grid { grid-template-columns: 1fr; } }

        .card { border:1px solid #1a1a1a; border-radius:14px; background:#0a0a0a; overflow:hidden; }
        .imgWrap { position:relative; width:100%; aspect-ratio:1/1; background:#0f0f0f; }
        .prodImg { width:100%; height:100%; object-fit:cover; display:block; }

        .body { padding:12px; display:grid; gap:6px; }
        .name { font-weight:600; }
        .sub { font-size:.9rem; opacity:.85; }
        .price { font-weight:700; }

        .btn { padding:10px 12px; border-radius:10px; border:1px solid #2a2a2a; background:#161616; color:#fff; cursor:pointer; }

        .empty { padding:14px; border:1px dashed #2a2a2a; border-radius:12px; text-align:center; opacity:.9; }

        .skeleton { background:linear-gradient(90deg,#0f0f0f,#151515,#0f0f0f); animation:pulse 1.5s infinite; border-radius:16px; height:320px; }
        @keyframes pulse { 0%{opacity:.6} 50%{opacity:1} 100%{opacity:.6} }
      `}</style>
    </div>
  );
}

// --- carrito local por marca ---
function addToCart(brand, product) {
  try {
    if (!brand?.id || !product?.id) return;
    const key = `cart_${brand.id}`;
    const raw = localStorage.getItem(key);
    const cart = raw ? JSON.parse(raw) : { items: [] };

    const idx = cart.items.findIndex((it) => it.product_id === product.id);
    const img = (() => {
      try {
        if (Array.isArray(product.images) && product.images[0]) return product.images[0];
        if (typeof product.images === "string" && product.images.trim().startsWith("[")) {
          const arr = JSON.parse(product.images);
          if (Array.isArray(arr) && arr[0]) return arr[0];
        }
      } catch {}
      return product.image_url || null;
    })();

    if (idx === -1) {
      cart.items.push({
        product_id: product.id,
        name: product.name,
        unit_price: product.price || 0,
        qty: 1,
        image: img,
        stock: typeof product.stock === "number" ? product.stock : null,
      });
    } else {
      const max = typeof product.stock === "number" ? product.stock : 99;
      cart.items[idx].qty = Math.min((cart.items[idx].qty || 0) + 1, max);
    }

    localStorage.setItem(key, JSON.stringify(cart));
    // Dispará un evento opcional por si el carrito escucha
    try { window.dispatchEvent(new CustomEvent("cabure:cart-changed", { detail: { brandId: brand.id } })); } catch {}
  } catch {}
}
