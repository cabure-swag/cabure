// pages/marcas/[slug].jsx
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { addToCart } from "@/utils/cart";
import CartSidebar from "@/components/CartSidebar";

export default function BrandPage() {
  const router = useRouter();
  const { slug } = router.query;

  const [brand, setBrand] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);

      // Traer marca
      const { data: b } = await supabase
        .from("brands")
        .select("id, name, slug, description, logo_url, color, instagram_url, active, deleted_at")
        .eq("slug", slug)
        .maybeSingle();

      setBrand(b || null);

      // Traer productos activos (soft delete)
      const { data: ps } = await supabase
        .from("products")
        .select("id, name, price, image_url, images, category, subcategory, active, deleted_at")
        .eq("brand_id", b?.id || "00000000-0000-0000-0000-000000000000")
        .eq("active", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      // Normalizar imágenes: preferir images[]; fallback image_url
      const normalized = (ps || []).map((p) => {
        const imgs =
          p.images && Array.isArray(p.images) && p.images.length
            ? p.images
            : p.image_url
            ? [p.image_url]
            : [];
        return { ...p, images: imgs };
      });

      setProducts(normalized);
      setLoading(false);
    })();
  }, [slug]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) =>
      [p.name, p.category, p.subcategory].filter(Boolean).some((t) => String(t).toLowerCase().includes(term))
    );
  }, [q, products]);

  function handleAdd(p) {
    if (!brand?.slug) return;
    addToCart(brand.slug, p, 1);
    // opcional: toast liviano con alert
    // alert("Agregado al carrito");
  }

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
            {brand?.logo_url ? (
              // si querés Next/Image, mantené fill y sizes; si falla, usá <img />
              <Image src={brand.logo_url} alt={brand?.name || "Logo"} fill sizes="300px" style={{ objectFit:"cover", borderRadius:12 }} />
            ) : (
              <div className="logoPh">Logo</div>
            )}
          </div>
        </div>
        <div className="profile__center">
          <h1 style={{ margin: 0 }}>{brand?.name || "Marca"}</h1>
          {brand?.description && <p style={{ opacity: .85 }}>{brand.description}</p>}
          <div className="row" style={{ gap: 8 }}>
            {brand?.instagram_url && (
              <a href={brand.instagram_url} target="_blank" rel="noreferrer" className="chip" aria-label="Instagram">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.9.2 2.4.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.5.3 1.2.4 2.4.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.9-.4 2.4-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.5.2-1.2.3-2.4.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.9-.2-2.4-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.5-.3-1.2-.4-2.4C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.9.4-2.4.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.5-.2 1.2-.3 2.4-.4C8.4 2.2 8.8 2.2 12 2.2m0-2.2C8.7 0 8.3 0 7 0 5.6.1 4.7.2 4 .5 3.2.8 2.6 1.2 2 1.8.9 2.9.3 4.4.1 6c-.2.9-.2 2-.2 6s0 5.1.2 6c.2 1.6.8 3.1 1.9 4.2 1.1 1.1 2.6 1.7 4.2 1.9.9.2 2 .2 6 .2s5.1 0 6-.2c1.6-.2 3.1-.8 4.2-1.9 1.1-1.1 1.7-2.6 1.9-4.2.2-.9.2-2 .2-6s0-5.1-.2-6C23.7 4.4 23.1 2.9 22 1.8 20.9.7 19.4.1 17.8-.1 16.9-.3 15.8-.3 12-.3z"/><path d="M12 5.8A6.2 6.2 0 1 0 12 18.2 6.2 6.2 0 1 0 12 5.8m0-2.1a8.3 8.3 0 1 1 0 16.6 8.3 8.3 0 0 1 0-16.6zM18.4 4.6a1.5 1.5 0 1 0 0 3.1 1.5 1.5 0 0 0 0-3.1z"/></svg>
                <span>Instagram</span>
              </a>
            )}
          </div>
        </div>
        <div className="profile__right">
          {/* Carrito a la derecha */}
          {brand?.slug && <CartSidebar brandSlug={brand.slug} />}
        </div>
      </header>

      {/* Buscador arriba del catálogo */}
      <section className="filters">
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
            <article key={p.id} className="card">
              <div className="imgWrap">
                {p.images && p.images[0] ? (
                  <img src={p.images[0]} alt={p.name} />
                ) : (
                  <div className="imgPh">Sin imagen</div>
                )}
              </div>
              <div className="meta">
                <h3 className="title">{p.name}</h3>
                {p.subcategory && <div className="sub">{p.subcategory}</div>}
                <div className="price">${Number(p.price || 0).toLocaleString("es-AR")}</div>
                <button className="btn" onClick={() => handleAdd(p)} aria-label={`Agregar ${p.name} al carrito`}>
                  Agregar al carrito
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      <style jsx>{`
        .container { padding: 16px; }
        .row { display:flex; align-items:center; }
        .profile {
          display: grid;
          grid-template-columns: 320px 1fr 360px;
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 1100px) {
          .profile { grid-template-columns: 260px 1fr; }
          .profile__right { grid-column: 1 / -1; }
        }
        @media (max-width: 720px) {
          .profile { grid-template-columns: 1fr; }
        }
        .logoWrap { position:relative; width:100%; aspect-ratio: 1 / 1; border-radius:12px; overflow:hidden; border:1px solid #1a1a1a; background:#0a0a0a; }
        .logoPh { display:flex; align-items:center; justify-content:center; width:100%; height:100%; color:#777; }
        .chip { display:inline-flex; gap:6px; align-items:center; padding:6px 10px; border-radius:999px; background:#111; border:1px solid #222; color:#fff; text-decoration:none; }
        .filters { margin: 14px 0; }
        .inp { padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#0f0f0f; color:#fff; width:100%; }

        .grid { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:12px; }
        @media (max-width: 1100px) { .grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 780px) { .grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 520px) { .grid { grid-template-columns: 1fr; } }

        .card { border:1px solid #1a1a1a; background:#0a0a0a; border-radius:14px; overflow:hidden; display:flex; flex-direction:column; }
        .imgWrap { width:100%; aspect-ratio: 1 / 1; background:#0f0f0f; display:block; }
        .imgWrap img { width:100%; height:100%; object-fit:cover; display:block; }
        .imgPh { width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#666; }
        .meta { padding:10px; display:flex; flex-direction:column; gap:6px; }
        .title { margin:0; font-size:16px; }
        .sub { font-size:12px; opacity:.8; }
        .price { font-weight:700; }
        .btn { padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#161616; color:#fff; cursor:pointer; }
        .ph { width:100%; height:0; padding-bottom:100%; border-radius:0; background:linear-gradient(90deg,#0f0f0f,#151515,#0f0f0f); animation:pulse 1.4s infinite; }
        .ph-line { height:12px; padding:0; border-radius:8px; margin-top:8px; }
        .ph-line.small { width:60%; }
        @keyframes pulse { 0%{opacity:.6} 50%{opacity:1} 100%{opacity:.6} }
      `}</style>
    </div>
  );
}
