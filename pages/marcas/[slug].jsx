import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import CartSidebar from "@/components/CartSidebar";
import { addToBrandCart } from "@/utils/brandCart";

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

export default function BrandView({ brand, products }) {
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products;
    return products.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(s) ||
        (p.category || "").toLowerCase().includes(s)
    );
  }, [q, products]);

  return (
    <>
      <Head>
        <title>
          {brand?.name ? `${brand.name} — CABURE.STORE` : "CABURE.STORE"}
        </title>
        {brand?.logo_url ? (
          <meta property="og:image" content={brand.logo_url} />
        ) : null}
      </Head>

      <div className="wrap">
        {/* HEADER de marca (igual estilo, solo agrego carrito a la derecha) */}
        <section className="brandCard">
          <div className="left">
            <div className="logoBox">
              {brand?.logo_url ? (
                <Image
                  src={brand.logo_url}
                  alt={brand.name}
                  width={120}
                  height={120}
                  className="logo"
                  priority
                />
              ) : (
                <div className="logo ph" />
              )}
            </div>

            <div className="text">
              <h1 className="title">{brand?.name || "Marca"}</h1>
              {brand?.description ? (
                <p className="desc">{brand.description}</p>
              ) : null}
              <div className="links">
                {brand?.instagram_url ? (
                  <Link
                    href={brand.instagram_url}
                    target="_blank"
                    rel="noreferrer"
                    className="pill"
                    aria-label="Instagram"
                  >
                    <span style={{ marginRight: 6 }}>📷</span> Instagram
                  </Link>
                ) : null}
              </div>

              <div className="filters">
                <button className="chip chip--on">Todas</button>
                {/* Si luego quieres categorías, aquí van más chips */}
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar producto…"
                />
              </div>
            </div>
          </div>

          {/* Carrito ACÁ, a la derecha del header */}
          <div className="right">
            {brand?.slug ? <CartSidebar brandSlug={brand.slug} compact /> : null}
          </div>
        </section>

        {/* GRID de productos 4 por fila, imágenes cuadradas */}
        <section className="grid">
          {list.length === 0 ? (
            <div className="empty">No hay productos para mostrar.</div>
          ) : (
            list.map((p) => (
              <article className="card" key={p.id}>
                <div className="imgWrap">
                  <Image
                    src={
                      (Array.isArray(p.images) && p.images[0]) ||
                      p.image_url ||
                      "/noimg.png"
                    }
                    alt={p.name}
                    width={900}
                    height={900}
                    style={{ objectFit: "cover" }}
                  />
                </div>

                <div className="body">
                  <h3 className="name">{p.name}</h3>
                  <div className="meta">
                    <span className="cat">{p.category || "—"}</span>
                    <span className="price">{currency(p.price || 0)}</span>
                  </div>
                  <div className="stock">
                    {Number(p.stock) > 0 ? `Stock: ${p.stock}` : "Sin stock"}
                  </div>
                  <button
                    className="btn"
                    onClick={() => addToBrandCart(brand.slug, p, 1)}
                    disabled={!(Number(p.stock) > 0)}
                  >
                    {Number(p.stock) > 0 ? "Agregar" : "Sin stock"}
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      </div>

      <style jsx>{`
        .wrap {
          max-width: 1200px;
          margin: 24px auto;
          padding: 0 16px;
        }
        .brandCard {
          background: #0f1115;
          border: 1px solid #1f2430;
          border-radius: 16px;
          padding: 18px;
          margin-bottom: 18px;
          display: grid;
          grid-template-columns: 1fr 360px;
          gap: 18px;
          align-items: start;
        }
        .left {
          display: grid;
          grid-template-columns: 140px 1fr;
          gap: 16px;
          align-items: start;
        }
        .logoBox {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .logo {
          width: 120px;
          height: 120px;
          border-radius: 12px;
          background: #0b0d11;
          border: 1px solid #1f2430;
          object-fit: contain;
        }
        .logo.ph {
          width: 120px;
          height: 120px;
          border-radius: 12px;
          background: #0b0d11;
          border: 1px dashed #1f2430;
        }
        .text .title {
          margin: 0 0 4px;
          font-size: 28px;
          line-height: 1.1;
        }
        .desc {
          margin: 0 0 10px;
          color: #a8b3cf;
          max-width: 70ch;
          font-size: 15px;
        }
        .links {
          display: flex;
          gap: 10px;
          margin-bottom: 8px;
        }
        .pill {
          height: 32px;
          padding: 0 12px;
          border-radius: 100px;
          background: #0b0d11;
          border: 1px solid #1f2430;
          display: inline-flex;
          align-items: center;
        }
        .filters {
          display: flex;
          gap: 10px;
          align-items: center;
          margin-top: 4px;
        }
        .chip {
          height: 32px;
          padding: 0 12px;
          border-radius: 999px;
          background: #0b0d11;
          border: 1px solid #1f2430;
        }
        .chip--on {
          background: #00f0b5;
          color: #0b0d11;
          border-color: #00f0b5;
          font-weight: 700;
        }
        .filters input {
          flex: 1;
          height: 32px;
          border-radius: 10px;
          background: #0b0d11;
          border: 1px solid #1f2430;
          padding: 0 10px;
          color: #e8ecf8;
        }
        .right {
          min-width: 0;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }
        .empty {
          grid-column: 1 / -1;
          border: 1px dashed #1f2430;
          border-radius: 12px;
          padding: 24px;
          text-align: center;
          color: #a8b3cf;
        }

        .card {
          background: #0f1115;
          border: 1px solid #1f2430;
          border-radius: 14px;
          display: grid;
          grid-template-rows: auto 1fr;
          overflow: hidden;
        }
        .imgWrap {
          aspect-ratio: 1 / 1; /* cuadrada */
          width: 100%;
          background: #0b0d11;
          border-bottom: 1px solid #1f2430;
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
        .meta {
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

        @media (max-width: 1050px) {
          .brandCard {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 800px) {
          .left {
            grid-template-columns: 100px 1fr;
          }
          .logo {
            width: 100px;
            height: 100px;
          }
          .grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 600px) {
          .grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </>
  );
}

/** SSR: trae la marca (activa) y los productos activos */
export async function getServerSideProps(ctx) {
  const { slug } = ctx.params || {};

  // Marca
  const { data: brand, error: e1 } = await supabase
    .from("brands")
    .select(
      "id, name, slug, description, instagram_url, logo_url, color, active"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (e1) {
    console.error("SSR brands error:", e1);
  }
  if (!brand || brand.active === false) {
    // No pública o no existe => 404 real.
    return { notFound: true };
  }

  // Productos activos (de esta marca)
  const { data: products, error: e2 } = await supabase
    .from("products")
    .select("id, name, price, stock, category, image_url, images, active")
    .eq("brand_id", brand.id)
    .eq("active", true)
    .order("id", { ascending: false });

  if (e2) {
    console.error("SSR products error:", e2);
  }

  return {
    props: {
      brand,
      products: products || [],
    },
  };
}
