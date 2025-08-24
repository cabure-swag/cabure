// pages/marcas/[slug].jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import ImageBox from "@/components/ImageBox";

const money = (n) => {
  const v = Number(n || 0);
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
};

// Pluralización muy simple en español para mostrar chips (no afecta la DB)
function pluralEs(word = "") {
  const s = (word || "").trim().toLowerCase();
  if (!s) return "";
  if (s.endsWith("z")) return s.slice(0, -1) + "ces";
  if (/[aeiou]$/.test(s)) return s + "s";
  return s + "es";
}

export default function BrandCatalog() {
  const router = useRouter();
  const { slug } = router.query;

  const [brand, setBrand] = useState(null);
  const [products, setProducts] = useState(null);

  // Filtro y búsqueda
  const [filter, setFilter] = useState("Todas");
  const [q, setQ] = useState("");

  // Índices de mini-galería por producto
  const [imgIdx, setImgIdx] = useState({}); // { [productId]: number }

  // “Agregado ✓”
  const [addedId, setAddedId] = useState(null);

  // Modal de galería (visor grande)
  const [modal, setModal] = useState({
    open: false,
    product: null, // objeto producto
    index: 0,      // índice dentro de su galería
  });

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

  // Categorías dinámicas (a partir de los productos de la marca)
  // Mostramos “Todas” + categorías en plural, pero filtramos por el valor original.
  const { categories, catLabels } = useMemo(() => {
    const set = new Set();
    (products || []).forEach((p) => {
      const c = (p.category || "").trim();
      if (c) set.add(c);
    });
    const arr = Array.from(set);
    const labels = new Map(arr.map((c) => [c, pluralEs(c)]));
    return { categories: ["Todas", ...arr], catLabels: labels };
  }, [products]);

  // Lista visible
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

  // Helpers de galería
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

  // Carrito por marca (localStorage)
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

  // Abrir visor modal con una imagen específica
  const openModal = (p, startIndex = 0) => {
    const gal = getGallery(p);
    if (!gal.length) return;
    const norm = ((startIndex % gal.length) + gal.length) % gal.length;
    setModal({ open: true, product: p, index: norm });
  };
  const closeModal = useCallback(() => setModal({ open: false, product: null, index: 0 }), []);
  const modalPrev = () => {
    const gal = getGallery(modal.product || {});
    if (!gal.length) return;
    setModal((m) => ({ ...m, index: ((m.index - 1) % gal.length + gal.length) % gal.length }));
  };
  const modalNext = () => {
    const gal = getGallery(modal.product || {});
    if (!gal.length) return;
    setModal((m) => ({ ...m, index: (m.index + 1) % gal.length }));
  };

  // Navegación por teclado dentro del modal
  useEffect(() => {
    if (!modal.open) return;
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); closeModal(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); modalPrev(); }
      if (e.key === "ArrowRight") { e.preventDefault(); modalNext(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal.open]); // eslint-disable-line react-hooks/exhaustive-deps

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
                <ImageBox src={brand.logo_url || null} alt={brand.name} ratio="1:1" objectFit="contain" />
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

            {/* Filtros y búsqueda */}
            <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <div className="chips" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {categories.map((c) => {
                  const label = c === "Todas" ? "Todas" : (catLabels.get(c) || c);
                  return (
                    <button
                      key={c}
                      className={`chip ${filter === c ? "active" : ""}`}
                      onClick={() => setFilter(c)}
                      aria-pressed={filter === c}
                    >
                      {label.charAt(0).toUpperCase() + label.slice(1)}
                    </button>
                  );
                })}
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

          {/* Grilla 4 por fila */}
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
                      <div className="galleryWrap" onClick={() => openModal(p, activeDot)} role="button" tabIndex={0}>
                        <ImageBox src={current} alt={p.name} ratio="1:1" />
                        {showArrows && (
                          <>
                            <button
                              className="navBtn navLeft"
                              aria-label="Imagen anterior"
                              onClick={(e) => { e.stopPropagation(); goLeft(p); }}
                              title="Anterior"
                            >
                              ◀
                            </button>
                            <button
                              className="navBtn navRight"
                              aria-label="Siguiente imagen"
                              onClick={(e) => { e.stopPropagation(); goRight(p); }}
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
                          {p.subcategory || p.category || "—" /* aquí mostramos singular si así viene */}
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

          {/* Modal visor */}
          {modal.open && modal.product && (
            <div className="modalBackdrop" onClick={closeModal} role="dialog" aria-modal="true">
              <div className="modalContent" onClick={(e) => e.stopPropagation()}>
                <button className="modalClose" aria-label="Cerrar" onClick={closeModal}>✕</button>
                <div className="modalInner">
                  <button className="modalArrow left" onClick={modalPrev} aria-label="Anterior">◀</button>
                  <div className="modalImage">
                    <img
                      src={getGallery(modal.product)[modal.index]}
                      alt={modal.product.name}
                      style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain", borderRadius: 8 }}
                    />
                  </div>
                  <button className="modalArrow right" onClick={modalNext} aria-label="Siguiente">▶</button>
                </div>
                <div className="modalDots">
                  {getGallery(modal.product).map((_, i) => (
                    <span
                      key={i}
                      className={`dot ${i === modal.index ? "dotOn" : ""}`}
                      onClick={() => setModal((m) => ({ ...m, index: i }))}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* estilos (único bloque) */}
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

            .galleryWrap { position: relative; cursor: zoom-in; }
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
              pointer-events: none;
            }
            .dot {
              width: 6px;
              height: 6px;
              border-radius: 999px;
              background: rgba(255,255,255,0.35);
            }
            .dotOn { background: rgba(255,255,255,0.9); }

            /* Modal */
            .modalBackdrop {
              position: fixed;
              inset: 0;
              background: rgba(0,0,0,0.75);
              display: grid;
              place-items: center;
              padding: 16px;
              z-index: 1000;
            }
            .modalContent {
              position: relative;
              width: 100%;
              max-width: 1000px;
              background: #0f0f10;
              border: 1px solid var(--border, #222);
              border-radius: 16px;
              padding: 16px;
            }
            .modalClose {
              position: absolute;
              top: 10px;
              right: 10px;
              width: 32px;
              height: 32px;
              border-radius: 999px;
              border: 1px solid #333;
              background: #18181a;
              color: #fff;
              cursor: pointer;
            }
            .modalInner {
              display: grid;
              grid-template-columns: auto 1fr auto;
              gap: 8px;
              align-items: center;
            }
            .modalArrow {
              background: rgba(255,255,255,0.08);
              border: 1px solid rgba(255,255,255,0.15);
              color: #fff;
              width: 40px;
              height: 40px;
              border-radius: 999px;
              cursor: pointer;
            }
            .modalArrow.left { justify-self: start; }
            .modalArrow.right { justify-self: end; }
            .modalImage {
              display: grid;
              place-items: center;
              padding: 8px;
            }
            .modalDots {
              display: flex;
              justify-content: center;
              gap: 6px;
              margin-top: 10px;
            }
            .modalDots .dot {
              width: 8px;
              height: 8px;
              border-radius: 999px;
              background: #3a3a3a;
              cursor: pointer;
            }
            .modalDots .dotOn { background: #fff; }
          `}</style>
        </>
      )}
    </div>
  );
}
