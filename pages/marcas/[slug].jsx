import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Cargamos el carrito embebido de forma dinámica.
// Si tu proyecto ya tiene "@/components/CartSidebar", se usa.
// Si no existe, no rompe el build (renderiza null).
const CartSidebar = dynamic(
  () =>
    import("@/components/CartSidebar")
      .then((m) => m.default || m)
      .catch(() => () => null),
  { ssr: false, loading: () => null }
);

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
      </Head>

      <div className="wrap">
        {/* HEADER PERFIL + CARRITO */}
        <section className="brandHeader card">
          <div className="left">
            <div className="logo">
              {brand.logo_url ? (
                <Image
                  src={brand.logo_url}
                  alt={brand.name}
                  width={96}
                  height={96}
                />
              ) : (
                <div className="placeholder" />
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
                    className="ig"
                  >
                    <span aria-hidden>📷</span> Instagram
                  </Link>
                ) : null}
              </div>

              {/* Filtros básicos */}
              <div className="filters">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar producto…"
                />
              </div>
            </div>
          </div>

          {/* Carrito embebido a la derecha del perfil */}
          <aside className="right">
            <CartSidebar embedded brandId={brand.id} />
          </aside>
        </section>

        {/* GRID DE PRODUCTOS */}
        <section className="grid">
          {products.length === 0 ? (
            <div className="empty">No hay productos para mostrar.</div>
          ) : (
            products.map((p) => <ProductCard key={p.id} product={p} />)
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
        .brandHeader {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 16px;
          padding: 16px;
        }
        .left {
          display: grid;
          grid-template-columns: 96px 1fr;
          gap: 16px;
          align-items: center;
        }
        .logo .placeholder {
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
        .ig {
          display: inline-flex;
          gap: 6px;
          align-items: center;
          padding: 6px 10px;
          border: 1px solid var(--border, #1f2430);
          border-radius: 10px;
        }
        .filters {
          display: flex;
          gap: 8px;
        }
        .filters input {
          flex: 1;
          background: #0b0d11;
          border: 1px solid var(--border, #1f2430);
          border-radius: 10px;
          padding: 8px 10px;
          color: #e8ecf8;
        }

        .right {
          min-height: 100%;
        }
        /* Si CartSidebar no existe, el aside queda vacío; no pasa nada. */

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
          .brandHeader {
            grid-template-columns: 1fr;
          }
          .right {
            order: 2;
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

/* ---------- Targeta simple de producto: cuadrada y limpia ---------- */
function ProductCard({ product }) {
  const img = (product.images && product.images[0]) || product.image_url || "";

  return (
    <article className="card product">
      <div className="imgWrap">
        {img ? (
          // Sugerido 1:1. Next/Image recorta manteniendo calidad
          <Image
            src={img}
            alt={product.name}
            width={900}
            height={900}
            style={{ objectFit: "cover" }}
            priority={false}
          />
        ) : (
          <div className="placeholder" />
        )}
      </div>

      <div className="body">
        <h3 className="name">{product.name}</h3>
        <div className="metaLine">
          <span className="cat">{product.category || "—"}</span>
          <span className="price">
            {formatCurrency(product.price ?? 0)}
          </span>
        </div>
        <div className="stock">
          {Number(product.stock) > 0 ? `Stock: ${product.stock}` : "Sin stock"}
        </div>

        {/* Botón de agregar — mantené tu handler actual si ya lo tenés */}
        <button
          className="btn"
          onClick={() => {
            // Si ya tenés un contexto/carrito, llamalo acá:
            // addToCart(product)
            const ev = new CustomEvent("brand:add-to-cart", {
              detail: { product },
            });
            window.dispatchEvent(ev);
          }}
          disabled={Number(product.stock) <= 0}
        >
          {Number(product.stock) > 0 ? "Agregar" : "Sin stock"}
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
        .imgWrap :global(img) {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .placeholder {
          width: 100%;
          height: 100%;
          background: #0f141c;
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
        .btn {
          margin-top: 6px;
          height: 36px;
          border-radius: 10px;
          background: #00f0b5;
          color: #0b0d11;
          font-weight: 700;
          border: none;
          cursor: pointer;
        }
        .btn[disabled] {
          background: #222b36;
          color: #7a859b;
          cursor: not-allowed;
        }
      `}</style>
    </article>
  );
}

function formatCurrency(n) {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(Number(n) || 0);
  } catch {
    return `$${Number(n) || 0}`;
  }
}

/* ---------- SSR: SOLO productos y marcas activas ---------- */
export async function getServerSideProps(ctx) {
  const { slug } = ctx.params || {};

  // 1) Marca
  const { data: brand, error: e1 } = await supabase
    .from("brands")
    .select(
      "id, name, slug, description, instagram_url, logo_url, color, active"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (e1 || !brand) return { notFound: true };
  if (brand.active === false) return { notFound: true }; // bloqueá marcas inactivas

  // 2) Productos activos de esa marca (orden a gusto)
  const { data: products, error: e2 } = await supabase
    .from("products")
    .select(
      "id, name, price, stock, category, image_url, images, active, brand_id"
    )
    .eq("brand_id", brand.id)
    .eq("active", true)
    .order("id", { ascending: false });

  if (e2) {
    // Si la policy RLS te bloquea, devolvemos lista vacía para no romper
    return { props: { brand, products: [] } };
  }

  return {
    props: {
      brand,
      products: products || [],
    },
  };
}
