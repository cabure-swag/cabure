import { useRouter } from "next/router";
import Head from "next/head";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import CartSidebar from "@/components/CartSidebar";
import { addToBrandCart } from "@/utils/brandCart";

// Util: arma galería a partir de products.images (array) o image_url única
function buildGallery(p) {
  if (Array.isArray(p.images) && p.images.length > 0) return p.images;
  if (p.image_url) return [p.image_url];
  return ["/noimg.png"];
}

function ProductCard({ product, brandSlug, onAdded }) {
  const gallery = buildGallery(product);
  const [idx, setIdx] = useState(0);
  const canPrev = idx > 0;
  const canNext = idx < gallery.length - 1;

  const prev = () => canPrev && setIdx((i) => i - 1);
  const next = () => canNext && setIdx((i) => i + 1);

  return (
    <article className="p-card">
      <div className="p-img">
        <button className="nav left" onClick={prev} disabled={!canPrev} aria-label="Anterior">
          ‹
        </button>
        <div className="frame">
          <Image
            src={gallery[idx]}
            alt={product.name || "Producto"}
            fill
            sizes="(max-width: 900px) 50vw, 300px"
            style={{ objectFit: "cover" }}
          />
        </div>
        <button className="nav right" onClick={next} disabled={!canNext} aria-label="Siguiente">
          ›
        </button>
      </div>

      <div className="p-body">
        <div className="p-title">{product.name}</div>
        <div className="p-meta">
          <span className="tag">{product.category || "General"}</span>
          <span className="stock">Stock: {Number(product.stock || 0)}</span>
        </div>
        <div className="p-price">${Number(product.price || 0)}</div>
        <button
          className="btn"
          disabled={!product.active || Number(product.stock || 0) <= 0}
          onClick={() => {
            addToBrandCart(brandSlug, product, 1);
            onAdded?.();
          }}
        >
          Agregar
        </button>
      </div>

      <style jsx>{`
        .p-card {
          background: #0b0d11;
          border: 1px solid #1f2430;
          border-radius: 14px;
          overflow: hidden;
          display: grid;
          grid-template-rows: 1fr auto;
        }
        .p-img {
          position: relative;
          height: 0;
          padding-bottom: 100%; /* cuadrado */
          background: #0f1115;
        }
        .frame {
          position: absolute;
          inset: 0;
          border-bottom: 1px solid #1f2430;
        }
        .nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 1px solid #263046;
          background: #0b0d11;
          color: #e8ecf8;
          display: grid;
          place-items: center;
          cursor: pointer;
        }
        .nav[disabled] {
          opacity: 0.35;
          cursor: not-allowed;
        }
        .left {
          left: 8px;
        }
        .right {
          right: 8px;
        }
        .p-body {
          padding: 10px 12px 12px;
          display: grid;
          gap: 6px;
        }
        .p-title {
          font-weight: 600;
          font-size: 14px;
          line-height: 1.2;
        }
        .p-meta {
          display: flex;
          gap: 10px;
          font-size: 12px;
          color: #a8b3cf;
        }
        .tag {
          border: 1px solid #263046;
          padding: 2px 6px;
          border-radius: 999px;
        }
        .stock {
          opacity: 0.8;
        }
        .p-price {
          font-weight: 700;
        }
        .btn {
          height: 36px;
          border-radius: 10px;
          background: #00f0b5;
          color: #0b0d11;
          font-weight: 700;
          border: none;
          padding: 0 12px;
          cursor: pointer;
        }
        .btn[disabled] {
          background: #1e2636;
          color: #7a859b;
          cursor: not-allowed;
        }
      `}</style>
    </article>
  );
}

export default function BrandPage() {
  const router = useRouter();
  const { slug } = router.query;

  const [brand, setBrand] = useState(null);
  const [loadingBrand, setLoadingBrand] = useState(true);

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  // 1) cargar marca por slug
  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoadingBrand(true);
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, slug, description, instagram_url, logo_url, color, active")
        .eq("slug", slug)
        .maybeSingle();
      if (!error) setBrand(data);
      setLoadingBrand(false);
    })();
  }, [slug]);

  // 2) cargar productos activos, con stock > 0
  useEffect(() => {
    if (!brand?.id) return;
    (async () => {
      setLoadingProducts(true);
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, stock, active, category, image_url, images")
        .eq("brand_id", brand.id)
        .eq("active", true)
        .gt("stock", 0)
        .order("name", { ascending: true });
      if (!error) setProducts(data || []);
      setLoadingProducts(false);
    })();
  }, [brand?.id]);

  // 3) categorías disponibles (derivadas de lo que hay)
  const categories = useMemo(() => {
    const set = new Set();
    for (const p of products) if (p.category) set.add(p.category);
    return Array.from(set).sort();
  }, [products]);

  // 4) filtrado/busqueda
  const filtered = useMemo(() => {
    const term = (search || "").toLowerCase().trim();
    return products.filter((p) => {
      const okCat = category === "all" ? true : (p.category || "") === category;
      const okTerm = term ? (p.name || "").toLowerCase().includes(term) : true;
      return okCat && okTerm;
    });
  }, [products, search, category]);

  // 5) estilos de color por marca (opcional)
  const accent = brand?.color || "#00f0b5";

  return (
    <>
      <Head>
        <title>{brand?.name ? `${brand.name} — CABURE.STORE` : "Marca — CABURE.STORE"}</title>
      </Head>

      <main className="wrap">
        {/* HEADER PERFIL + CARRITO */}
        <section className="header">
          <div className="logo">
            <div className="img">
              <Image
                src={brand?.logo_url || "/noimg.png"}
                alt={brand?.name || "Marca"}
                fill
                sizes="120px"
                style={{ objectFit: "contain" }}
              />
            </div>
          </div>

          <div className="meta">
            <h1>{brand?.name || "Marca"}</h1>
            {brand?.description ? (
              <p className="desc">{brand.description}</p>
            ) : (
              <p className="desc muted">Sin descripción.</p>
            )}
            {!!brand?.instagram_url && (
              <a
                href={brand.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="ig"
                style={{ borderColor: accent, color: accent }}
              >
                <span style={{ fontSize: 18, marginRight: 6 }}>📷</span>
                Instagram
              </a>
            )}
          </div>

          <div className="cart">
            {/* carrito a la derecha del header */}
            <CartSidebar brandSlug={brand?.slug} compact />
          </div>
        </section>

        {/* TOOLBAR arriba del catálogo */}
        <section className="toolbar">
          <div className="pills">
            <button
              className={`pill ${category === "all" ? "on" : ""}`}
              onClick={() => setCategory("all")}
            >
              Todas
            </button>
            {categories.map((c) => (
              <button
                key={c}
                className={`pill ${category === c ? "on" : ""}`}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>

          <input
            className="search"
            placeholder="Buscar producto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </section>

        {/* CATÁLOGO */}
        <section className="grid">
          {loadingProducts ? (
            <div className="hint">Cargando catálogo…</div>
          ) : filtered.length === 0 ? (
            <div className="hint">No hay productos para mostrar.</div>
          ) : (
            filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                brandSlug={brand?.slug}
                onAdded={() => {}}
              />
            ))
          )}
        </section>
      </main>

      <style jsx>{`
        .wrap {
          max-width: 1200px;
          padding: 18px 16px 60px;
          margin: 0 auto;
        }
        /* Header en 3 columnas: logo | info | carrito */
        .header {
          display: grid;
          grid-template-columns: 120px 1fr 360px;
          gap: 16px;
          background: #0b0d11;
          border: 1px solid #1f2430;
          border-radius: 16px;
          padding: 14px;
          margin-bottom: 18px;
        }
        .logo .img {
          position: relative;
          width: 100%;
          height: 0;
          padding-bottom: 100%;
          background: #0f1115;
          border: 1px solid #1f2430;
          border-radius: 12px;
        }
        .meta h1 {
          margin: 2px 0 6px 0;
          font-size: 22px;
        }
        .desc {
          margin: 0 0 10px 0;
          line-height: 1.4;
          color: #c7d2e1;
        }
        .desc.muted {
          color: #99a8c2;
        }
        .ig {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border: 1px solid;
          padding: 6px 10px;
          border-radius: 999px;
          font-weight: 600;
        }
        .cart {
          min-width: 0;
        }

        /* Toolbar encima del grid */
        .toolbar {
          display: grid;
          grid-template-columns: 1fr 240px;
          gap: 12px;
          align-items: center;
          margin: 8px 0 14px;
        }
        .pills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .pill {
          height: 34px;
          border-radius: 999px;
          border: 1px solid #263046;
          background: #0b0d11;
          color: #e8ecf8;
          padding: 0 12px;
          cursor: pointer;
        }
        .pill.on {
          background: #00f0b5;
          color: #0b0d11;
          border-color: #00f0b5;
          font-weight: 700;
        }
        .search {
          height: 36px;
          border-radius: 10px;
          border: 1px solid #263046;
          background: #0b0d11;
          color: #e8ecf8;
          padding: 0 10px;
        }

        /* Grid del catálogo ~4 por fila en desktop */
        .grid {
          display: grid;
          gap: 14px;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        }
        .hint {
          color: #a8b3cf;
          border: 1px dashed #263046;
          border-radius: 12px;
          padding: 18px;
          text-align: center;
        }

        @media (max-width: 1024px) {
          .header {
            grid-template-columns: 120px 1fr;
          }
          .cart {
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </>
  );
}
