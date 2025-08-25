import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";

// -----------------------------
// Helpers simples
// -----------------------------
function classNames(...a) { return a.filter(Boolean).join(" "); }
function currency(n) { return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0); }
const INSTAGRAM_SVG = (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.9.2 2.3.4.6.2 1 .4 1.5.9.5.4.7.9.9 1.5.2.4.3 1 .4 2.3.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.9-.4 2.3-.2.6-.4 1-.9 1.5-.4.5-.9.7-1.5.9-.4.2-1 .3-2.3.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.9-.2-2.3-.4-.6-.2-1-.4-1.5-.9-.5-.4-.7-.9-.9-1.5-.2-.4-.3-1-.4-2.3C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.9.4-2.3.2-.6.4-1 .9-1.5.4-.5.9-.7 1.5-.9.4-.2 1-.3 2.3-.4C8.4 2.2 8.8 2.2 12 2.2m0-2.2C8.7 0 8.2 0 6.9.1 5.6.2 4.7.3 3.9.6 3 .9 2.2 1.3 1.5 2 .8 2.7.4 3.5.1 4.4-.2 5.2-.2 6.1-.3 7.4-.4 8.7-.4 9.2-.4 12s0 3.3.1 4.6c.1 1.3.2 2.2.4 3 .3.9.7 1.7 1.4 2.4.7.7 1.5 1.1 2.4 1.4.8.2 1.7.3 3 .4 1.3.1 1.8.1 4.6.1s3.3 0 4.6-.1c1.3-.1 2.2-.2 3-.4.9-.3 1.7-.7 2.4-1.4.7-.7 1.1-1.5 1.4-2.4.2-.8.3-1.7.4-3 .1-1.3.1-1.8.1-4.6s0-3.3-.1-4.6c-.1-1.3-.2-2.2-.4-3-.3-.9-.7-1.7-1.4-2.4C22.7.4 21.9 0 21  -0.3c-.8-.2-1.7-.3-3-.4C16.7 0 16.2 0 12 0Z"/>
    <path fill="currentColor" d="M12 5.8A6.2 6.2 0 1 0 18.2 12 6.19 6.19 0 0 0 12 5.8Zm0 10.2A4 4 0 1 1 16 12a4 4 0 0 1-4 4Zm6.4-10.9a1.45 1.45 0 1 0 1.45 1.45A1.45 1.45 0 0 0 18.4 5.1Z"/>
  </svg>
);

// -----------------------------
// Carrusel chico para la tarjeta
// -----------------------------
function MiniCarousel({ images = [], onOpen }) {
  const [idx, setIdx] = useState(0);
  const hasImgs = images && images.length > 0;
  const safe = hasImgs ? images : [{ url: "/placeholder-1x1.png" }];

  function prev(e) { e.stopPropagation(); setIdx(i => (i - 1 + safe.length) % safe.length); }
  function next(e) { e.stopPropagation(); setIdx(i => (i + 1) % safe.length); }

  return (
    <div className="mini-carousel" onClick={onOpen} role="button" aria-label="Abrir galería">
      <Image
        src={safe[idx].url}
        alt="Producto"
        width={600}
        height={600}
        style={{ objectFit: "cover", width: "100%", height: "100%", borderRadius: 12 }}
      />
      {safe.length > 1 && (
        <>
          <button className="nav left" onClick={prev} aria-label="Foto anterior">‹</button>
          <button className="nav right" onClick={next} aria-label="Foto siguiente">›</button>
        </>
      )}
      <style jsx>{`
        .mini-carousel { position: relative; width: 100%; aspect-ratio: 1/1; overflow: hidden; }
        .nav {
          position: absolute; top: 50%; transform: translateY(-50%);
          background: rgba(0,0,0,.55); color: #fff; border: 0; width: 28px; height: 28px;
          border-radius: 999px; display: grid; place-items: center; cursor: pointer;
        }
        .nav.left { left: 8px; }
        .nav.right { right: 8px; }
      `}</style>
    </div>
  );
}

// -----------------------------
// Modal visor grande
// -----------------------------
function ModalViewer({ open, images = [], onClose }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => { if (open) setIdx(0); }, [open]);
  if (!open) return null;
  const safe = images?.length ? images : [{ url: "/placeholder-1x1.png" }];

  return (
    <div className="modal" onClick={onClose} role="dialog" aria-modal="true">
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="imgwrap">
          <Image
            src={safe[idx].url}
            alt="Imagen de producto"
            fill
            sizes="80vw"
            style={{ objectFit: "contain" }}
          />
        </div>
        {safe.length > 1 && (
          <div className="controls">
            <button onClick={() => setIdx(i => (i - 1 + safe.length) % safe.length)} aria-label="Anterior">‹</button>
            <span>{idx + 1} / {safe.length}</span>
            <button onClick={() => setIdx(i => (i + 1) % safe.length)} aria-label="Siguiente">›</button>
          </div>
        )}
        <button className="close" onClick={onClose} aria-label="Cerrar">✕</button>
      </div>
      <style jsx>{`
        .modal { position: fixed; inset: 0; background: rgba(0,0,0,.75); display: grid; place-items: center; z-index: 90; }
        .dialog { position: relative; width: min(900px, 92vw); background: #0b0b0b; border: 1px solid #222; border-radius: 16px; padding: 16px; }
        .imgwrap { position: relative; width: 100%; height: min(70vh, 80vw); background: #000; border-radius: 12px; overflow: hidden; }
        .controls { display:flex; align-items:center; justify-content:center; gap:12px; padding:10px; }
        .controls button { background:#111; border:1px solid #333; color:#fff; border-radius:8px; padding:6px 10px; }
        .close { position:absolute; top:10px; right:10px; background:#111; border:1px solid #333; color:#fff; border-radius:8px; padding:6px 10px; }
      `}</style>
    </div>
  );
}

// -----------------------------
// Carrito por marca (inline, sin navegar)
// -----------------------------
function useBrandCart(brandSlug) {
  const key = `cabure_cart_${brandSlug}`;
  const [cart, setCart] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      setCart(raw ? JSON.parse(raw) : []);
    } catch {}
  }, [key]);

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(cart)); } catch {}
  }, [key, cart]);

  function add(p, qty = 1) {
    setCart(prev => {
      const idx = prev.findIndex(x => x.product_id === p.id);
      const next = [...prev];
      if (idx >= 0) {
        next[idx] = { ...next[idx], qty: Math.min((next[idx].qty || 0) + qty, Math.max(p.stock || 0, 1)) };
      } else {
        next.push({ product_id: p.id, name: p.name, unit_price: p.price || 0, qty: Math.min(qty, Math.max(p.stock || 0, 1)) });
      }
      return next;
    });
  }
  function setQty(product_id, qty) {
    setCart(prev => prev.map(i => i.product_id === product_id ? { ...i, qty: Math.max(1, qty|0) } : i));
  }
  function remove(product_id) { setCart(prev => prev.filter(i => i.product_id !== product_id)); }
  function clear() { setCart([]); }

  const total = useMemo(() => cart.reduce((a, b) => a + (b.qty * (b.unit_price || 0)), 0), [cart]);

  return { cart, add, setQty, remove, clear, total };
}

function CartSidebar({ brand, brandSlug, cartApi, onCheckout }) {
  const { cart, setQty, remove, total, clear } = cartApi;
  return (
    <aside className="cart">
      <h3 style={{ margin: 0, fontWeight: 600 }}>Carrito</h3>
      <p style={{ opacity: .7, marginTop: 6 }}>{brand?.name || "Marca"}</p>

      <div className="list">
        {cart.length === 0 && <div className="empty">Aún no agregaste productos.</div>}
        {cart.map(item => (
          <div key={item.product_id} className="rowi">
            <div className="info">
              <div className="name">{item.name}</div>
              <div className="price">{currency(item.unit_price)}</div>
            </div>
            <div className="qty">
              <input
                type="number"
                min={1}
                value={item.qty}
                onChange={e => setQty(item.product_id, parseInt(e.target.value || "1", 10))}
                aria-label={`Cantidad para ${item.name}`}
              />
              <button className="link" onClick={() => remove(item.product_id)}>Quitar</button>
            </div>
          </div>
        ))}
      </div>

      <div className="total">
        <span>Total</span>
        <b>{currency(total)}</b>
      </div>

      <div className="actions">
        <button className="btn ghost" onClick={clear}>Vaciar</button>
        <button className="btn primary" onClick={onCheckout}>Continuar</button>
      </div>

      <style jsx>{`
        .cart { position: sticky; top: 80px; background:#0c0c0c; border:1px solid #1f1f1f; border-radius:16px; padding:16px; }
        .list { display:grid; gap:10px; margin:12px 0; }
        .empty { padding:12px; border:1px dashed #2a2a2a; border-radius:12px; text-align:center; opacity:.8; }
        .rowi { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .info .name { font-weight:600; }
        .info .price { opacity:.8; font-size:.92rem; }
        .qty { display:flex; align-items:center; gap:8px; }
        .qty input { width:64px; background:#111; color:#fff; border:1px solid #333; border-radius:8px; padding:6px 8px; }
        .link { background:none; border:none; color:#bbb; text-decoration:underline; cursor:pointer; }
        .total { display:flex; align-items:center; justify-content:space-between; padding-top:8px; border-top:1px solid #1f1f1f; margin-top:6px; }
        .actions { display:flex; gap:10px; margin-top:12px; }
        .btn { padding:10px 12px; border-radius:10px; border:1px solid #2a2a2a; background:#141414; color:#fff; cursor:pointer; }
        .btn.ghost { background:transparent; }
        .btn.primary { background:#1e1e1e; border-color:#3a3a3a; }
      `}</style>
    </aside>
  );
}

// -----------------------------
// Página principal
// -----------------------------
export default function BrandPage({ brand, products }) {
  const router = useRouter();
  const { slug } = router.query;

  // Carrito por marca (en la derecha)
  const cart = useBrandCart(slug);

  // Buscador + categoría
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState("Todas");

  const categories = useMemo(() => {
    const setC = new Set();
    (products || []).forEach(p => {
      const c = (p.category || "").trim();
      if (c) setC.add(c);
    });
    return ["Todas", ...Array.from(setC)];
  }, [products]);

  const filtered = useMemo(() => {
    return (products || [])
      .filter(p => !query ? true : (p.name || "").toLowerCase().includes(query.toLowerCase()))
      .filter(p => activeCat === "Todas" ? true : (p.category || "").trim() === activeCat);
  }, [products, query, activeCat]);

  // Modal de galería
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImgs, setModalImgs] = useState([]);

  async function onCheckout() {
    // Llevar a /checkout/[brandSlug] manteniendo carrito en localStorage
    router.push(`/checkout/${slug}`);
  }

  return (
    <>
      <Head>
        <title>{brand?.name ? `${brand.name} — CABURE.STORE` : "Marca — CABURE.STORE"}</title>
        <meta name="description" content={brand?.description || "Catálogo"} />
        {brand?.slug && <link rel="canonical" href={`https://cabure.store/marcas/${brand.slug}`} />}
        {/* OG básico */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={brand?.name || "CABURE.STORE"} />
        <meta property="og:description" content={brand?.description || ""} />
        {brand?.logo_url && <meta property="og:image" content={brand.logo_url} />}
      </Head>

      <div className="wrap">
        {/* Panel izquierdo: perfil de marca */}
        <section className="brand">
          <div className="logoWrap">
            <Image
              src={brand?.logo_url || "/cabure-logo.png"}
              alt={brand?.name || "Marca"}
              width={800}
              height={800}
              priority
              style={{ objectFit: "cover", width: "100%", height: "100%", borderRadius: 16 }}
            />
          </div>
          <div className="meta">
            <h1 className="title">{brand?.name || "Marca"}</h1>
            {brand?.description && <p className="desc">{brand.description}</p>}
            {brand?.instagram_url && (
              <a href={brand.instagram_url} target="_blank" rel="noopener noreferrer" className="ig">
                {INSTAGRAM_SVG}
                <span>Instagram</span>
              </a>
            )}
          </div>
        </section>

        {/* Panel derecho: carrito */}
        <div className="side">
          <CartSidebar brand={brand} brandSlug={slug} cartApi={cart} onCheckout={onCheckout} />
        </div>
      </div>

      {/* Filtros sobre el catálogo */}
      <section className="filters">
        <div className="chips">
          {categories.map(cat => (
            <button
              key={cat}
              className={classNames("chip", cat === activeCat && "active")}
              onClick={() => setActiveCat(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="search">
          <input
            placeholder="Buscar producto…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar producto"
          />
        </div>
      </section>

      {/* Catálogo */}
      <section className="grid">
        {filtered.length === 0 && (
          <div className="empty">No hay productos para mostrar.</div>
        )}

        {filtered.map(p => {
          const imgs = p.images?.length
            ? p.images
            : (p.image_url ? [{ url: p.image_url }] : []);

          const sinStock = (typeof p.stock === "number") && p.stock <= 0;

          return (
            <article key={p.id} className="card">
              <MiniCarousel
                images={imgs}
                onOpen={() => { setModalImgs(imgs); setModalOpen(true); }}
              />
              <div className="info">
                <div className="row">
                  <h3 className="name">{p.name}</h3>
                  <div className="price">{currency(p.price)}</div>
                </div>
                {typeof p.stock === "number" && (
                  <div className={classNames("stock", sinStock && "out")}>
                    {sinStock ? "Sin stock" : `Stock: ${p.stock}`}
                  </div>
                )}
                <button
                  className="btnAdd"
                  onClick={() => cart.add(p, 1)}
                  disabled={sinStock}
                  aria-label={`Agregar ${p.name} al carrito`}
                  title={sinStock ? "Sin stock" : "Agregar al carrito"}
                >
                  Agregar
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <ModalViewer open={modalOpen} images={modalImgs} onClose={() => setModalOpen(false)} />

      <style jsx>{`
        .wrap {
          display:grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 1024px) {
          .wrap { grid-template-columns: 1fr; }
          .side { order: -1; }
        }
        .brand {
          display:grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 720px) {
          .brand { grid-template-columns: 1fr; }
        }
        .logoWrap { width: 100%; aspect-ratio: 1/1; background:#0a0a0a; border:1px solid #1c1c1c; border-radius: 16px; overflow: hidden; }
        .meta .title { margin: 0 0 6px; }
        .meta .desc { opacity:.9; line-height:1.45; }
        .ig { display:inline-flex; align-items:center; gap:8px; margin-top:10px; color:#ddd; text-decoration:none; }
        .ig:hover { color:#fff; }

        .filters {
          display:flex; gap:12px; align-items:center; justify-content:space-between;
          margin: 22px 0 8px;
          flex-wrap: wrap;
        }
        .chips { display:flex; gap:8px; flex-wrap:wrap; }
        .chip {
          border:1px solid #2a2a2a; background:#111; color:#ddd; padding:8px 10px; border-radius:24px; cursor:pointer;
        }
        .chip.active { background:#1a1a1a; border-color:#3a3a3a; }

        .search input {
          background:#0f0f0f; color:#fff; border:1px solid #2a2a2a; border-radius:10px; padding:10px 12px; width:220px;
        }
        @media (max-width: 520px) {
          .search input { width:100%; }
        }

        .grid {
          display:grid; gap:14px;
          grid-template-columns: repeat(4, 1fr);
        }
        @media (max-width: 1200px) { .grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 920px) { .grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 540px) { .grid { grid-template-columns: 1fr; } }

        .card {
          background:#0c0c0c; border:1px solid #1f1f1f; border-radius:16px; overflow:hidden;
          display:flex; flex-direction:column;
        }
        .info { padding:12px; display:grid; gap:8px; }
        .row { display:flex; justify-content:space-between; gap:8px; align-items:center; }
        .name { margin:0; font-size:1rem; }
        .price { font-weight:700; }
        .stock { font-size:.9rem; opacity:.9; }
        .stock.out { color:#f87171; }
        .btnAdd {
          width:100%; padding:10px 12px; border-radius:10px; border:1px solid #2a2a2a; background:#161616; color:#fff; cursor:pointer;
        }
        .btnAdd:disabled { opacity:.5; cursor:not-allowed; }
      `}</style>
    </>
  );
}

// -----------------------------
// Data fetching (SSR)
// -----------------------------
export async function getServerSideProps(ctx) {
  const slug = ctx.params?.slug;
  if (!slug) return { notFound: true };

  // 1) Marca activa por slug
  const { data: brand, error: eBrand } = await supabase
    .from("brands")
    .select("id,slug,name,description,logo_url,color,instagram_url")
    .eq("slug", slug)
    .eq("active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (eBrand || !brand) return { notFound: true };

  // 2) Productos activos
  const { data: prods, error: eProds } = await supabase
    .from("products")
    .select("id,brand_id,name,price,stock,category,active,image_url,deleted_at,created_at")
    .eq("brand_id", brand.id)
    .eq("active", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // 3) Imágenes múltiples (opcional)
  let imagesByProduct = {};
  if (!eProds && prods?.length) {
    const ids = prods.map(p => p.id);
    const { data: imgs } = await supabase
      .from("product_images")
      .select("id,product_id,url,position")
      .in("product_id", ids)
      .order("position", { ascending: true });

    (imgs || []).forEach(it => {
      (imagesByProduct[it.product_id] ||= []).push({ id: it.id, url: it.url, position: it.position });
    });
  }

  const products = (prods || []).map(p => ({
    id: p.id,
    name: p.name,
    price: p.price,
    stock: typeof p.stock === "number" ? p.stock : null, // si no usás stock, deja null
    category: p.category || "",
    image_url: p.image_url || null,
    images: imagesByProduct[p.id]?.length
      ? imagesByProduct[p.id]
      : (p.image_url ? [{ id: "legacy", url: p.image_url, position: 0 }] : [])
  }));

  return {
    props: {
      brand,
      products
    }
  };
}
