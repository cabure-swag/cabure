// pages/marcas/[slug].jsx
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

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

export default function BrandPage({ brand, products: initial, debugMsg }) {
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

  const emptyState =
    !brand?.id
      ? "No pudimos cargar la marca. Revisá que el slug exista y la marca esté pública."
      : products.length === 0
      ? "No hay productos para mostrar."
      : null;

  return (
    <>
      <Head>
        <title>{brand?.name ? `${brand.name} — CABURE.STORE` : "Marca — CABURE.STORE"}</title>
        {brand?.logo_url ? <meta property="og:image" content={brand.logo_url} /> : null}
      </Head>

      <div className="wrap">
        <section className="hero">
          <div className="cartDock">
            {brand?.slug ? <CartSidebar brandSlug={brand.slug} compact /> : null}
          </div>

          <div className="heroGrid">
            <div className="photoBox">
              {brand?.logo_url ? (
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

            <div className="textBox">
              <h1 className="title">{brand?.name || "Marca"}</h1>
              {brand?.description ? <p className="desc">{brand.description}</p> : null}

              <div className="searchRow">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar producto…"
                  aria-label="Buscar producto"
                />
              </div>
            </div>

            <div className="socialBox">
              <div className="socialRow">
                {brand?.instagram_url ? (
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
                {brand?.website_url ? (
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

        <section className="grid">
          {emptyState ? (
            <div className="empty">
              {emptyState}
              {debugMsg ? <div style={{ marginTop: 6, opacity: 0.7 }}>{debugMsg}</div> : null}
            </div>
          ) : (
            products.map((p) => <ProductCard key={p.id} product={p} brandSlug={brand.slug} />)
          )}
        </section>
      </div>

      <style jsx>{`
        .wrap{max-width:1200px;margin:24px auto;padding:0 16px}
        .hero{position:relative;background:#0f1115;border:1px solid #1f2430;border-radius:16px;padding:22px;margin-bottom:18px;overflow:hidden}
        .cartDock{position:absolute;top:16px;right:16px;width:330px;max-width:38vw}
        .heroGrid{display:grid;grid-template-columns:240px 1fr 330px;grid-template-rows:auto 1fr auto;gap:18px 20px;align-items:start;min-height:220px}
        .photoBox{grid-column:1/2;grid-row:1/4;display:flex;align-items:center;justify-content:center}
        .photo{width:220px;height:220px;object-fit:contain;border-radius:14px;background:#0b0d11;border:1px solid #1f2430}
        .photo.ph{width:220px;height:220px;border-radius:14px;background:#0b0d11;border:1px dashed #1f2430}
        .textBox{grid-column:2/3;grid-row:1/3;display:grid;gap:8px}
        .title{margin:0;font-size:34px;line-height:1.1}
        .desc{margin:0 0 4px;color:#a8b3cf;font-size:15px;max-width:68ch}
        .searchRow input{width:100%;background:#0b0d11;border:1px solid #1f2430;border-radius:10px;padding:10px 12px;color:#e8ecf8}
        .socialBox{grid-column:3/4;grid-row:3/4;display:flex;justify-content:flex-end;align-items:flex-end}
        .socialRow{display:inline-flex;gap:10px}
        .iconBtn{width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;border-radius:10px;border:1px solid #1f2430;background:#0b0d11;color:inherit;font-size:18px}
        .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
        .empty{grid-column:1/-1;padding:26px;text-align:center;color:#a8b3cf;border:1px dashed #1f2430;border-radius:12px}
        @media (max-width:1100px){.heroGrid{grid-template-columns:240px 1fr}.cartDock{position:static;width:100%;max-width:100%;margin-bottom:12px}.socialBox{grid-column:2/3}}
        @media (max-width:900px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
        @media (max-width:680px){
          .heroGrid{grid-template-columns:1fr;grid-template-rows:auto auto auto}
          .photoBox{grid-column:1/2;grid-row:2/3}
          .textBox{grid-column:1/2;grid-row:1/2}
          .socialBox{grid-column:1/2;grid-row:3/4;justify-content:flex-start}
          .grid{grid-template-columns:repeat(2,minmax(0,1fr))}
          .photo,.photo.ph{width:180px;height:180px}
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
        <Image src={img} alt={product.name} width={900} height={900} style={{ objectFit: "cover" }} />
      </div>

      <div className="body">
        <h3 className="name">{product.name}</h3>
        <div className="metaLine">
          <span className="cat">{product.category || "—"}</span>
          <span className="price">{currency(product.price ?? 0)}</span>
        </div>
        <div className="stock">{Number(product.stock) > 0 ? `Stock: ${product.stock}` : "Sin stock"}</div>
        <button
          className="btnAdd"
          onClick={() => addToBrandCart(brandSlug, product, 1)}
          disabled={outOfStock}
        >
          {outOfStock ? "Sin stock" : "Agregar"}
        </button>
      </div>

      <style jsx>{`
        .product{background:#0f1115;border:1px solid #1f2430;border-radius:14px;display:grid;grid-template-rows:auto 1fr;overflow:hidden}
        .imgWrap{aspect-ratio:1/1;width:100%;background:#0b0d11;border-bottom:1px solid #1f2430}
        .body{padding:12px;display:grid;gap:6px}
        .name{margin:0;font-size:15px;line-height:1.3}
        .metaLine{display:flex;justify-content:space-between;gap:8px;color:#a8b3cf;font-size:13px}
        .price{color:#e8ecf8;font-weight:600}
        .stock{font-size:12px;color:#a8b3cf}
        .btnAdd{margin-top:6px;height:36px;border-radius:10px;background:#00f0b5;color:#0b0d11;font-weight:700;border:none;cursor:pointer}
        .btnAdd[disabled]{background:#222b36;color:#7a859b;cursor:not-allowed}
      `}</style>
    </article>
  );
}

export async function getServerSideProps(ctx) {
  const { slug } = ctx.params || {};

  let debugMsg = "";

  // Marca (activa)
  const { data: brand, error: e1 } = await supabase
    .from("brands")
    .select("id, name, slug, description, instagram_url, website_url, logo_url, color, active")
    .eq("slug", slug)
    .maybeSingle();

  if (e1) {
    console.error("SSR brands error:", e1);
    debugMsg = `brands error: ${e1.message}`;
  }
  if (!brand) {
    // No devolvemos notFound para poder ver el mensaje en la página y no un 404
    return { props: { brand: null, products: [], debugMsg: debugMsg || "Marca no encontrada." } };
  }
  if (brand.active === false) {
    return { props: { brand: null, products: [], debugMsg: "La marca está en modo privado." } };
  }

  // Productos activos
  const { data: products, error: e2 } = await supabase
    .from("products")
    .select("id, name, price, stock, category, image_url, images, active")
    .eq("brand_id", brand.id)
    .eq("active", true)
    .order("id", { ascending: false });

  if (e2) {
    console.error("SSR products error:", e2);
    debugMsg = debugMsg || `products error: ${e2.message}`;
  }

  return {
    props: {
      brand,
      products: products || [],
      debugMsg,
    },
  };
}
