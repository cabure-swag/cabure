// pages/marcas/[slug].jsx
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";

const CATS = ["Todas", "Remera", "Pantalon", "Buzo", "Campera", "Gorra", "Otros"];

export default function BrandCatalog() {
  const router = useRouter();
  const { slug } = router.query;

  const [brand, setBrand] = useState(null); // null: loading; {}: ok; false: no encontrada
  const [products, setProducts] = useState(null);
  const [cat, setCat] = useState("Todas");
  const [q, setQ] = useState("");

  // Cargar marca
  useEffect(() => {
    if (!slug) return;
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id,name,slug,description,logo_url,color,instagram_url,active,deleted_at")
        .eq("slug", slug)
        .maybeSingle();

      if (!alive) return;
      if (error || !data || !data.active || data.deleted_at) {
        setBrand(false); // no encontrada o no pública
      } else {
        setBrand(data);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  // Cargar productos activos de la brand
  useEffect(() => {
    if (!brand?.id) return;
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,price,image_url,category,subcategory,active,deleted_at")
        .eq("brand_id", brand.id)
        .order("created_at", { ascending: false });

      if (!alive) return;
      if (error) {
        setProducts([]);
      } else {
        setProducts(data ?? []);
      }
    })();
    return () => {
      alive = false;
    };
  }, [brand?.id]);

  const filtered = useMemo(() => {
    if (!products) return null;
    let list = products.filter((p) => p.active && !p.deleted_at);
    if (cat && cat !== "Todas") {
      list = list.filter((p) => (p.subcategory || p.category || "").toLowerCase() === cat.toLowerCase());
    }
    if (q.trim()) {
      const term = q.trim().toLowerCase();
      list = list.filter((p) => p.name?.toLowerCase().includes(term));
    }
    return list;
  }, [products, cat, q]);

  return (
    <div className="container">
      <Head>
        <title>{brand?.name ? `${brand.name} — CABURE.STORE` : "Marca — CABURE.STORE"}</title>
        <meta name="description" content={brand?.description || "Catálogo por marca."} />
        <meta property="og:title" content={brand?.name || "Marca"} />
        <meta property="og:description" content={brand?.description || ""} />
        <meta property="og:image" content={brand?.logo_url || "/cabure-logo.png"} />
      </Head>

      {brand === null ? (
        <div className="skel" style={{ height: 160, borderRadius: 16 }} />
      ) : brand === false ? (
        <div className="card" style={{ padding: 24 }}>
          La marca no existe o no está pública.
        </div>
      ) : (
        <>
          {/* Header de marca */}
          <section className="card" style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 16,
                  background: "#0E1012",
                  border: "1px solid rgba(255,255,255,.08)",
                  overflow: "hidden",
                  position: "relative",
                  flex: "0 0 auto",
                }}
              >
                {brand.logo_url ? (
                  <Image
                    src={brand.logo_url}
                    alt={`${brand.name} logo`}
                    fill
                    sizes="72px"
                    style={{ objectFit: "cover" }}
                  />
                ) : null}
              </div>
              <div style={{ minWidth: 0 }}>
                <h1 style={{ margin: 0 }}>{brand.name}</h1>
                <p style={{ margin: "6px 0 0", color: "var(--text-dim)" }}>{brand.description || "—"}</p>
              </div>
              <div style={{ flex: 1 }} />
              {brand.instagram_url ? (
                <a
                  href={brand.instagram_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn ghost"
                  aria-label="Instagram"
                >
                  Instagram
                </a>
              ) : null}
            </div>

            {/* Filtros */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {CATS.map((c) => (
                <button
                  key={c}
                  className={c === cat ? "chip chip-active" : "chip"}
                  onClick={() => setCat(c)}
                  aria-pressed={c === cat}
                >
                  {c}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <input
                aria-label="Buscar producto por nombre"
                placeholder="Buscar..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="input"
                style={{ minWidth: 180 }}
              />
            </div>
          </section>

          {/* Productos */}
          {products === null ? (
            <div className="skel" style={{ height: 200, borderRadius: 16 }} />
          ) : filtered.length === 0 ? (
            <div className="card" style={{ padding: 24 }}>No hay productos para mostrar.</div>
          ) : (
            <div className="grid grid-3">
              {filtered.map((p) => (
                <article key={p.id} className="card" style={{ padding: 12 }}>
                  <div
                    style={{
                      borderRadius: 12,
                      background: "#0E1012",
                      border: "1px solid rgba(255,255,255,.08)",
                      height: 180,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {p.image_url ? (
                      <Image
                        src={p.image_url}
                        alt={p.name}
                        fill
                        sizes="360px"
                        style={{ objectFit: "cover" }}
                      />
                    ) : null}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <strong>{p.name}</strong>
                    <div style={{ color: "var(--text-dim)", fontSize: ".92rem" }}>
                      {p.subcategory || p.category || "Otros"}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      {typeof p.price === "number" ? `$ ${p.price.toLocaleString("es-AR")}` : "Consultar"}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Accesos */}
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <Link href="/checkout/[brandSlug]" as={`/checkout/${brand.slug}`} className="btn">
              Comprar
            </Link>
            <Link href="/" className="btn ghost">Volver</Link>
          </div>
        </>
      )}
    </div>
  );
}
