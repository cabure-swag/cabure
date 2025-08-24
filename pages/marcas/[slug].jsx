// pages/marcas/[slug].jsx
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import ImageBox from "@/components/ImageBox";

const money = (n) => {
  const v = Number(n || 0);
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
};

export default function BrandCatalog() {
  const router = useRouter();
  const { slug } = router.query;

  const [brand, setBrand] = useState(null);
  const [products, setProducts] = useState(null);

  // filtro dinámico y búsqueda
  const [filter, setFilter] = useState("Todas");
  const [q, setQ] = useState("");

  // índice de imagen visible por producto
  const [imgIdx, setImgIdx] = useState({}); // { [productId]: number }

  // toast simple de “agregado”
  const [addedId, setAddedId] = useState(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: br } = await supabase
        .from("brands")
        .select("id,name,slug,description,logo_url,color,instagram_url,active,deleted_at")
        .eq("slug", slug)
        .is("deleted_at", null)
        .eq("active", true)
        .maybeSingle();
      setBrand(br || null);

      if (br?.id) {
        const { data: prods } = await supabase
          .from("products")
          .select("id,name,price,image_url,image_urls,category,subcategory,active,deleted_at,stock,brand_id,created_at")
          .eq("brand_id", br.id)
          .is("deleted_at", null)
          .eq("active", true)
          .gt("stock", 0)
          .order("created_at", { ascending: false });
        setProducts(prods || []);
      } else {
        setProducts([]);
      }
    })();
  }, [slug]);

  // categorías dinámicas (solo las que existen para esta marca)
  const categories = useMemo(() => {
    const set = new Set();
    (products || []).forEach((p) => {
      const c = (p.category || "").trim();
      if (c) set.add(c);
    });
    return ["Todas", ...Array.from(set)];
  }, [products]);

  // listado visible según filtro y búsqueda
  const visible = useMemo(() => {
    let list = products || [];
    if (filter && filter !== "Todas") {
      list = list.filter((p) => (p.category || "").toLowerCase() === filter.toLowerCase());
    }
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      list = list.filter((p) => (p.name || "").toLowerCase().includes(t));
    }
    return list;
  }, [products, filter, q]);

  // helpers de galería
  const getGallery = (p) => {
    const arr = Array.isArray(p.image_urls) && p.image_urls.length ? p.image_urls : (p.image_url ? [p.image_url] : []);
    return arr.slice(0, 5);
  };
  const currentImgFor = (p) => {
    const gal = getGallery(p);
    const idx = imgIdx[p.id] ?? 0;
    if (!gal.length) return null;
    const norm = ((idx % gal.length) + gal.length) % gal.length;
    return gal[norm];
  };
  const goLeft = (p) => {
    const gal = getGallery(p);
    if (!gal.length) return;
    setImgIdx((prev) => ({ ...prev, [p.id]: (prev[p.id] ?? 0) - 1 }));
  };
  const goRight = (p) => {
    const gal = getGallery(p);
    if (!gal.length) return;
    setImgIdx((prev) => ({ ...prev, [p.id]: (prev[p.id] ?? 0) + 1 }));
  };

  // carrito por marca en localStorage (no redirige)
  const addToCart = (p) => {
    if (!brand?.id) return;
    const key = `cart:${brand.id}`;
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    let cart = [];
    try { cart = raw ? JSON.parse(raw) : []; } catch { cart = []; }

    const idx = cart.findIndex((it) => it.product_id === p.id);
    if (idx >= 0) {
      const max = Math.max(1, Number(p.stock || 1));
      cart[idx].qty = Math.min(max, Number(cart[idx].qty || 0) + 1);
    } else {
      cart.push({
        product_id: p.id,
        name: p.name,
        price: Number(p.price || 0),
        image: currentImgFor(p),
        qty: 1,
        stock: Number(p.stock || 1),
      });
    }
    window.localStorage.setItem(key, JSON.stringify(cart));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cart:updated", { detail: { brandId: brand.id, count: cart.length } }));
    }
    setAddedId(p.id);
    setTimeout(() => setAddedId(null), 1200);
  };

  return (
    <div className="container">
      <Head>
        <title>{brand ? `${brand.name} — CABURE.STORE` : "Marca — CABURE.STORE"}</title>
      </Head>

      {!brand ? (
        <div className="status-empty" style={{ marginTop: 24 }}>
          <p>No se encontró la marca o no está activa.</p>
          <Link className="btn" href="/">Volver</Link>
        </div>
      ) : (
        <>
          {/* Header de marca */}
          <section className="card" style={{ padding: 16, marginTop: 12, borderColor: brand.color || "#222" }}>
            <div className="row" style={{ gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ width: 120 }}>
                <ImageBox src={brand.logo_url || null} alt={brand.name} ratio="4:3" objectFit="contain" />
              </div>
              <div style={{ flex: 1, minWidth: 240 }}>
                <h1 style={{ margin: 0 }}>{brand.name}</h1>
                {brand.description ? (
                  <p style={{ marginTop: 6, opacity: 0.9 }}>{brand.description}</p>
                ) : null}
                {brand.instagram_url ? (
                  <a
                    className="chip"
                    href={brand.instagram_url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Instagram de la marca"
                    title="Instagram"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6 }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M7 2C4.24 2 2 4.24 2 7v10c0 2.76 2.24 5 5 5h10c2.76 0 5-2.24 5-5V7c0-2.76-2.24-5-5-5H7zm10 2c1.66 0 3 1.34 3 3v10c0 1.66-1.34 3-3 3H7c-1.66 0-3-1.34-3-3V7c0-1.66 1.34-3 3-3h10zm-5 3a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6zm4.5-.75a.75.75 0 100 1.5.75.75 0 000-1.5z"/>
                    </svg>
                    Instagram
                  </a>
                ) : null}
              </div>
            </div>

            {/* filtros y búsqueda */}
            <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <div className="chips" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {categories.map((c) => (
                  <button
                    key={c}
                    className={`chip ${filter === c ? "active" : ""}`}
                    onClick={() => setFilter(c)}
                    aria-pressed={filter === c}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, minWidth: 200 }} />
              <input
                className="input"
                placeholder="Buscar producto…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Buscar producto por nombre"
                style={{ maxWidth: 280 }}
              />
            </div>
          </section>

          {/* grilla de productos 4 por fila */}
          <section style={{ marginTop: 12 }}>
            {!products ? (
              <div className="skel" style={{ height: 200 }} />
            ) : visible.length === 0 ? (
              <div className="status-empty" style={{ marginTop: 12 }}>
                <p>No hay productos para mostrar.</p>
              </div>
            ) : (
              <div className="grid grid-4" style={{ gap: 12 }}>
                {visible.map((p) => {
                  const gal = getGallery(p);
                  const current = currentImgFor(p);
                  const showArrows = gal.length > 1;
                  const activeDot = (() => {
                    if (!gal.length) return 0;
                    const idx = imgIdx[p.id] ?? 0;
                    return ((idx % gal.length) + gal.length) % gal.length;
                  })();

                  return (
                    <article key={p.id} className="card" style={{ padding: 12 }}>
                      <div className="galleryWrap">
                        <ImageBox src={current} alt={p.name} ratio="4:3" />
                        {showArrows && (
                          <>
                            <button
                              className="navBtn navLeft"
                              aria-label="Imagen anterior"
                              onClick={() => goLeft(p)}
                              title="Anterior"
                            >
                              ◀
                            </button>
                            <button
                              className="navBtn navRight"
                              aria-label="Siguiente imagen"
                              onClick={() => goRight(p)}
                              title="Siguiente"
                            >
                              ▶
                            </button>
                            <div className="dots">
                              {gal.map((_, i) => (
                                <span key={i} className={`dot ${i === activeDot ? "dotOn" : ""}`} />
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>
                          {p.subcategory || p.category || "—"}
                        </div>
                        <div className="badge" style={{ marginTop: 6 }}>{money(p.price)}</div>
                      </div>

                      <div className="row" style={{ marginTop: 10, alignItems: "center" }}>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>Stock: {p.stock ?? 0}</div>
                        <div style={{ flex: 1 }} />
                        <button className="btn" onClick={() => addToCart(p)}>
                          {addedId === p.id ? "Agregado ✓" : "Agregar"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* estilos (un solo bloque) */}
          <style jsx>{`
            .grid.grid-4 {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
            }
            @media (max-width: 1100px) {
              .grid.grid-4 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            }
            @media (max-width: 800px) {
              .grid.grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            }
            @media (max-width: 520px) {
              .grid.grid-4 { grid-template-columns: 1fr; }
            }

            .galleryWrap { position: relative; }
            .navBtn {
              position: absolute;
              top: 50%;
              transform: translateY(-50%);
              background: rgba(0,0,0,0.55);
              color: #fff;
              border: 1px solid rgba(255,255,255,0.25);
              border-radius: 999px;
              width: 32px;
              height: 32px;
              display: grid;
              place-items: center;
              cursor: pointer;
              opacity: 0.9;
            }
            .navBtn:hover { opacity: 1; }
            .navLeft { left: 8px; }
            .navRight { right: 8px; }

            .dots {
              position: absolute;
              bottom: 6px;
              left: 0;
              right: 0;
              display: flex;
              justify-content: center;
              gap: 6px;
            }
            .dot {
              width: 6px;
              height: 6px;
              border-radius: 999px;
              background: rgba(255,255,255,0.35);
            }
            .dotOn { background: rgba(255,255,255,0.9); }
          `}</style>
        </>
      )}
    </div>
  );
}
