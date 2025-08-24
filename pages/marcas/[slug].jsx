// pages/marcas/[slug].jsx
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

// ⚠️ IMPORTS RELATIVOS (sin "@")
import CartSidebar from "../../components/CartSidebar";
import { addToBrandCart } from "../../utils/brandCart";
import { supabase } from "../../lib/supabaseClient";

function currency(n) {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(Number(n || 0));
  } catch {
    return `$${n || 0}`;
  }
}

export default function BrandPage({ brand, products: initial }) {
  const [q, setQ] = useState("");

  const products = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return initial;
    return initial.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(query) ||
        (p.category || "").toLowerCase().includes(query)
    );
  }, [q, initial]);

  return (
    <>
      <Head>
        <title>{brand.name} — CABURE.STORE</title>
        <meta name="robots" content="index,follow" />
        <meta property="og:title" content={`${brand.name} — CABURE.STORE`} />
        <meta property="og:description" content={brand.description || "Catálogo"} />
        <meta property="og:type" content="website" />
        {brand.logo_url ? <meta property="og:image" content={brand.logo_url} /> : null}
        <link rel="canonical" href={`https://cabure.store/marcas/${brand.slug}`} />
      </Head>

      <div className="wrap">
        {/* ENCABEZADO: PERFIL IZQUIERDA + CARRITO DERECHA */}
        <section className="card headerGrid">
          <div className="colLeft">
            <div className="brandRow">
              <div className="logo">
                {brand.logo_url ? (
                  <Image
                    src={brand.logo_url}
                    alt={brand.name}
                    width={96}
                    height={96}
                    style={{ objectFit: "contain" }}
                  />
                ) : (
                  <div className="logoPh" />
                )}
              </div>
              <div className="meta">
                <h1 className="title">{brand.name}</h1>
                {brand.description ? (
                  <p className="desc">{brand.description}</p>
                ) : null}
                <div className="links">
                  {brand.instagram_url ? (
                    <Link
                      href={brand.instagram_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btnGhost"
                      aria-label="Instagram de la marca"
                    >
                      <span style={{ marginRight: 6 }}>📷</span> Instagram
                    </Link>
                  ) : null}
                </div>
                <div className="filters">
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar producto…"
                    aria-label="Buscar producto"
                  />
                </div>
              </div>
            </div>
          </div>

          <aside className="colRight">
            {/* Carrito por marca, fijo a la derecha */}
            <CartSidebar brandSlug={brand.slug} />
          </aside>
        </section>

        {/* GRID DE PRODUCTOS (4 por fila en desktop) */}
        <section className="grid">
          {products.length === 0 ? (
            <div className="empty">No hay productos para mostrar.</div>
          ) : (
            products.map((p) => <ProductCard key={p.id} product={p} brandSlug={brand.slug} />)
          )}
        </section>
      </div>

      <style jsx>{`
        .wrap {
          max-width: 1100px;
          margin: 24px auto;
          padding: 0 16px;
        }
        .card {
          background: var(--surface, #0f1115);
          border: 1px solid var(--border, #1f2430);
          border-radius: 14px;
        }
        .headerGrid {
          display: grid;
          grid-template-columns: 1fr 360px;
          gap: 16px;
          padding: 16px;
          align-items: start;
        }
        .brandRow {
          display: grid;
          grid-template-columns: 96px 1fr;
          gap: 16px;
          align-items: center;
        }
        .logoPh {
          width: 96px;
          height: 96px;
          border-radius: 12px;
          background: #111820;
          border: 1px dashed var(--border, #1f2430);
        }
        .title {
          margin: 0 0 6px;
          font-size: 24px;
          line-height: 1.15;
        }
        .desc {
          margin: 0 0 8px;
          color: #a8b3cf;
          font-size: 14px;
        }
        .links {
          display: flex;
          gap: 10px;
          margin: 4px 0 10px;
        }
        .btnGhost {
          display: inline-flex;
          gap: 6px;
          align-items: center;
          padding: 6px 10px;
          border: 1px solid var(--border, #1f2430);
          border-radius: 10px;
          color: inherit;
        }
        .filters input {
          width: 100%;
          background: #0b0d11;
          border: 1px solid var(--border, #1f2430);
          border-radius: 10px;
          padding: 8px 10px;
          color: #e8ecf8;
        }
        .grid {
          margin-top: 16px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }
        .empty {
          grid-column: 1 / -1;
          padding: 24px;
          text-align: center;
          color: #a8b3cf;
          border: 1px dashed var(--border, #1f2430);
          border-radius: 12px;
        }
        @media (max-width: 1024px) {
          .headerGrid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 900px) {
          .grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 680px) {
          .grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </>
  );
}

function ProductCard({ product, brandSlug }) {
  const img =
    (Array.isArray(product.images) && product.images[0]) ||
    product.image_url ||
    "/noimg.png";

  const outOfStock = !(Number(product.stock) > 0);

  return (
    <article className="card product">
      <div className="imgWrap">
        <Image
          src={img}
          alt={product.name}
          width={900}
          height={900}
          style={{ objectFit: "cover" }}
          priority={false}
        />
      </div>

      <div className="body">
        <h3 className="name">{product.name}</h3>
        <div className="metaLine">
          <span className="cat">{product.category || "—"}</span>
          <span className="price">{currency(product.price ?? 0)}</span>
        </div>
        <div className="stock">
          {Number(product.stock) > 0 ? `Stock: ${product.stock}` : "Sin stock"}
        </div>
        <button
          className="btnAdd"
          onClick={() => addToBrandCart(brandSlug, product, 1)}
          disabled={outOfStock}
          aria-label="Agregar al carrito"
        >
          {outOfStock ? "Sin stock" : "Agregar"}
        </button>
      </div>

      <style jsx>{`
        .product {
          display: grid;
          grid-template-rows: auto 1fr;
          overflow: hidden;
        }
        .imgWrap {
          aspect-ratio: 1 / 1; /* cuadrada */
          width: 100%;
          background: #0b0d11;
          border-bottom: 1px solid var(--border, #1f2430);
        }
        .body {
          padding: 12px;
          display: grid;
          gap: 6px;
        }
        .name {
          margin: 0;
          font-size: 15px;
          line-height: 1.3;
        }
        .metaLine {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          color: #a8b3cf;
          font-size: 13px;
        }
        .price {
          color: #e8ecf8;
          font-weight: 600;
        }
        .stock {
          font-size: 12px;
          color: #a8b3cf;
        }
        .btnAdd {
          margin-top: 6px;
          height: 36px;
          border-radius: 10px;
          background: #00f0b5;
          color: #0b0d11;
          font-weight: 700;
          border: none;
          cursor: pointer;
        }
        .btnAdd[disabled] {
          background: #222b36;
          color: #7a859b;
          cursor: not-allowed;
        }
      `}</style>
    </article>
  );
}

/* ---------- SSR: SOLO productos y marcas activas ---------- */
export async function getServerSideProps(ctx) {
  const { slug } = ctx.params || {};

  // 1) Marca (solo si está activa)
  const { data: brand, error: e1 } = await supabase
    .from("brands")
    .select(
      "id, name, slug, description, instagram_url, logo_url, color, active"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (e1 || !brand) return { notFound: true };
  if (brand.active === false) return { notFound: true };

  // 2) Productos activos de esa marca
  const { data: products, error: e2 } = await supabase
    .from("products")
    .select("id, name, price, stock, category, image_url, images, active")
    .eq("brand_id", brand.id)
    .eq("active", true)
    .order("id", { ascending: false });

  if (e2) {
    // Si una policy bloquea, devolvemos lista vacía sin romper
    return { props: { brand, products: [] } };
  }

  return {
    props: {
      brand,
      products: products || [],
    },
  };
}
