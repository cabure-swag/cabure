import React, { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
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

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoadingBrand(true);
      const { data: b, error } = await supabase
        .from("brands")
        .select("id,name,slug,description,logo_url,color,instagram_url,bank_alias,bank_cbu,mp_access_token")
        .eq("slug", slug)
        .is("deleted_at", null)
        .maybeSingle();

      setLoadingBrand(false);
      if (error || !b) return;

      setBrand(b);
    })();
  }, [slug]);

  useEffect(() => {
    if (!brand?.id) return;
    (async () => {
      setLoadingProducts(true);
      const { data, error } = await supabase
        .from("products")
        .select("id,brand_id,name,price,image_url,images,category,subcategory,active,stock")
        .eq("brand_id", brand.id)
        .eq("active", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      setLoadingProducts(false);
      if (error) return;
      setProductsRaw(data || []);
    })();
  }, [brand?.id]);

  const categories = useMemo(() => {
    const setC = new Set();
    (productsRaw || []).forEach((p) => {
      const c = (p?.category || "").trim();
      if (c) setC.add(c);
    });
    return ["Todas", ...Array.from(setC)];
  }, [productsRaw]);

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

  function primaryImage(p) {
    const imgs = Array.isArray(p?.images) ? p.images : [];
    return imgs[0] || p.image_url || "/placeholder.png";
  }

  return (
    <div className="container">
      <Head>
        <title>{brand?.name ? `${brand.name} — CABURE.STORE` : "Marca — CABURE.STORE"}</title>
        {brand?.description && <meta name="description" content={brand.description} />}
        {brand?.slug && <link rel="canonical" href={`https://cabure.store/marcas/${brand.slug}`} />}
        {/* OG */}
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
              <Image src={brand.logo_url} alt={`${brand.name} logo`} fill sizes="320px" style={{ objectFit: "cover" }} />
            ) : (
              <div className="noLogo">Sin logo</div>
            )}
          </div>
        </div>

        <div className="right">
          {loadingBrand ? (
            <div className="skeleton" style={{ height: 80 }} />
          ) : !brand ? (
            <div className="empty">Marca no encontrada.</div>
          ) : (
            <>
              <div className="row" style={{ alignItems: "start", gap: 12 }}>
                <h1 className="brandTitle" style={{ margin: 0 }}>{brand.name}</h1>
                {brand.instagram_url && (
                  <a href={brand.instagram_url} target="_blank" rel="noreferrer" aria-label="Instagram" className="ig">
                    {/* ícono IG simple */}
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
        <div className="chips">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`chip ${cat === activeCat ? "chip--active" : ""}`}
              onClick={() => setActiveCat(cat)}
              aria-pressed={cat === activeCat}
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
      <section className="grid">
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
              <Image
                src={primaryImage(p)}
                alt={p.name}
                fill
                sizes="(max-width: 800px) 50vw, (max-width: 1200px) 25vw, 300px"
                style={{ objectFit: "cover" }}
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
        .brandHeader { display:grid; grid-template-columns: 340px 1fr; gap:16px; align-items:start; }
        @media (max-width: 900px){ .brandHeader { grid-template-columns: 1fr; } }

        .logoWrap { position:relative; width:100%; aspect-ratio:1/1; border-radius:16px; overflow:hidden; border:1px solid #222; background:#0a0a0a; }
        .noLogo { display:flex; align-items:center; justify-content:center; height:100%; color:#999; }
        .brandTitle { font-size:1.8rem; }
        .brandDesc { opacity:.85; margin-top:8px; }

        .ig { display:inline-flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius:10px; border:1px solid #2a2a2a; color:#fff; }
        .ig:hover { background:#151515; }

        .filters { display:flex; gap:12px; align-items:center; margin-top:16px; flex-wrap:wrap; }
        .chips { display:flex; gap:8px; flex-wrap:wrap; }
        .chip { padding:8px 12px; border-radius:999px; border:1px solid #2a2a2a; background:#0f0f0f; color:#fff; }
        .chip--active { background:#171717; border-color:#3a3a3a; }
        .search { flex:1; min-width:220px; padding:10px 12px; border-radius:10px; border:1px solid #2a2a2a; background:#0f0f0f; color:#fff; }

        .grid { display:grid; grid-template-columns: repeat(4, 1fr); gap:16px; margin-top:16px; }
        @media (max-width: 1200px){ .grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 900px){ .grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 540px){ .grid { grid-template-columns: 1fr; } }

        .card { border:1px solid #1a1a1a; border-radius:14px; background:#0a0a0a; overflow:hidden; }
        .imgWrap { position:relative; width:100%; aspect-ratio:1/1; background:#0f0f0f; }
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

function addToCart(brand, product) {
  try {
    const key = `cart_${brand.id}`;
    const raw = localStorage.getItem(key);
    const cart = raw ? JSON.parse(raw) : { items: [] };

    const idx = cart.items.findIndex((it) => it.product_id === product.id);
    if (idx === -1) {
      cart.items.push({
        product_id: product.id,
        name: product.name,
        unit_price: product.price || 0,
        qty: 1,
        image: Array.isArray(product.images) && product.images[0] ? product.images[0] : (product.image_url || null),
        stock: typeof product.stock === "number" ? product.stock : null,
      });
    } else {
      const nextQty = (cart.items[idx].qty || 0) + 1;
      const max = typeof product.stock === "number" ? product.stock : 99;
      cart.items[idx].qty = Math.min(nextQty, max);
    }
    localStorage.setItem(key, JSON.stringify(cart));
  } catch {}
}
