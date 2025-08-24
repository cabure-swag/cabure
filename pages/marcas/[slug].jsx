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
        {/* HERO: foto izq + texto medio + carrito der (todo en una sola tarjeta) */}
        <section className="hero">
          {/* Carrito arriba a la derecha, “flotando” dentro del hero */}
          <div className="cartDock">
            <CartSidebar brandSlug={brand.slug} compact />
          </div>

          <div className="heroGrid">
            {/* Foto de perfil grande */}
            <div className="photoBox">
              {brand.logo_url ? (
                <Image
                  src={brand.logo_url}
                  alt={brand.name}
                  width={220}
                  height={220}
                  className="photo"
                  priority
                />
              ) : (
                <div className="photo ph" />
              )}
            </div>

            {/* Título + descripción + buscador */}
            <div className="textBox">
              <h1 className="title">{brand.name}</h1>
              {brand.description ? (
                <p className="desc">{brand.description}</p>
              ) : null}

              <div className="searchRow">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar producto…"
                  aria-label="Buscar producto"
                />
              </div>
            </div>

            {/* Fila de iconos abajo a la derecha */}
            <div className="socialBox">
              <div className="socialRow">
                {brand.instagram_url ? (
                  <Link
                    href={brand.instagram_url}
                    target="_blank"
                    rel="noreferrer"
                    className="iconBtn"
                    aria-label="Instagram de la marca"
                    title="Instagram"
                  >
                    <span>📷</span>
                  </Link>
                ) : null}

                {brand.website_url ? (
                  <Link
                    href={brand.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="iconBtn"
                    aria-label="Sitio web"
                    title="Sitio web"
                  >
                    <span>🌐</span>
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
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
          max-width: 1200px;
          margin: 24px auto;
          padding: 0 16px;
        }
        .hero {
          position: relative;
          background: var(--surface, #0f1115);
          border: 1px solid var(--border, #1f2430);
          border-radius: 16px;
          padding: 22px;
          margin-bottom: 18px;
          overflow: hidden;
        }
        /* Dock del carrito dentro del hero */
        .cartDock {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 330px;
          max-width: 38vw;
        }
        /* Grid principal del hero:
           [foto] [texto] [columna vacía para alinear sociales con carrito] */
        .heroGrid {
          display: grid;
          grid-template-columns: 240px 1fr 330px;
          grid-template-rows: auto 1fr auto;
          gap: 18px 20px;
          align-items: start;
          min-height: 220px;
        }
        .photoBox {
          grid-column: 1 / 2;
          grid-row: 1 / 4;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .photo {
          width: 220px;
          height: 220px;
          object-fit: contain;
          border-radius: 14px;
          background: #0b0d11;
          border: 1px solid var(--border, #1f2430);
        }
        .photo.ph {
          width: 220px;
          height: 220px;
          border-radius: 14px;
          background: #0b0d11;
          border: 1px dashed var(--border, #1f2430);
        }
        .textBox {
          grid-column: 2 / 3;
          grid-row: 1 / 3;
          display: grid;
          gap: 8px;
        }
        .title {
          margin: 0;
          font-size: 34px;
          line-height: 1.1;
        }
        .desc {
          margin: 0 0 4px;
          color: #a8b3cf;
          font-size: 15px;
          max-width: 68ch;
        }
        .searchRow input {
          width: 100%;
          background: #0b0d11;
          border: 1px solid var(--border, #1f2430);
          border-radius: 10px;
          padding: 10px 12px;
          color: #e8ecf8;
        }
        .socialBox {
          grid-column: 3 / 4;
          grid-row: 3 / 4;
          display: flex;
          justify-content: flex-end;
          align-items: flex-end;
        }
        .socialRow {
          display: inline-flex;
          gap: 10px;
        }
        .iconBtn {
          width: 40px;
          height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          border: 1px solid var(--border, #1f2430);
          background: #0b0d11;
          color: inherit;
          font-size: 18px;
        }

        /* GRID de productos */
        .grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }
        .empty {
          grid-column: 1 / -1;
          padding: 26px;
          text-align: center;
          color: #a8b3cf;
          border: 1px dashed var(--border, #1f2430);
          border-radius: 12px;
        }

        /* Responsivo */
        @media (max-width: 1100px) {
          .heroGrid {
            grid-template-columns: 240px 1fr;
          }
          .cartDock {
            position: static;
            width: 100%;
            max-width: 100%;
            margin-bottom: 12px;
          }
          .socialBox {
            grid-column: 2 / 3;
          }
        }
        @media (max-width: 900px) {
          .grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 680px) {
          .heroGrid {
            grid-template-columns: 1fr;
            grid-template-rows: auto auto auto;
          }
          .photoBox {
            grid-column: 1 / 2;
            grid-row: 2 / 3;
          }
          .textBox {
            grid-column: 1 / 2;
            grid-row: 1 / 2;
          }
          .socialBox {
            grid-column: 1 / 2;
            grid-row: 3 / 4;
            justify-content: flex-start;
          }
          .grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .photo,
          .photo.ph {
            width: 180px;
            height: 180px;
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
          background: var(--surface, #0f1115);
          border: 1px solid var(--border, #1f2430);
          border-radius: 14px;
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

/* ---------- SSR: SOLO marcas activas + productos activos ---------- */
export async function getServerSideProps(ctx) {
  const { slug } = ctx.params || {};

  // 1) Marca (activa)
  const { data: brand, error: e1 } = await supabase
    .from("brands")
    .select(
      "id, name, slug, description, instagram_url, website_url, logo_url, color, active"
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

  return {
    props: {
      brand,
      products: e2 ? [] : products || [],
    },
  };
}
