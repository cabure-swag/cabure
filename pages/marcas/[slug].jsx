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
  const [filter, setFilter] = useState("Todas");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!slug) return;
    (async () => {
      // cargar brand activa
      const { data: br } = await supabase
        .from("brands")
        .select("id,name,slug,description,logo_url,color,instagram_url,active,deleted_at")
        .eq("slug", slug)
        .is("deleted_at", null)
        .eq("active", true)
        .maybeSingle();
      setBrand(br || null);

      // cargar productos públicos (activos, no borrados)
      if (br?.id) {
        const { data: prods } = await supabase
          .from("products")
          .select("id,name,price,image_url,category,subcategory,active,deleted_at,stock")
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

  const categories = useMemo(() => {
    const base = ["Todas", "Remera", "Pantalon", "Buzo", "Campera", "Gorra", "Otros"];
    return base;
  }, []);

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
          {/* header de marca */}
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

          {/* grilla de productos */}
          <section style={{ marginTop: 12 }}>
            {!products ? (
              <div className="skel" style={{ height: 200 }} />
            ) : visible.length === 0 ? (
              <div className="status-empty" style={{ marginTop: 12 }}>
                <p>No hay productos para mostrar.</p>
              </div>
            ) : (
              <div className="grid grid-3" style={{ gap: 12 }}>
                {visible.map((p) => (
                  <article key={p.id} className="card" style={{ padding: 12 }}>
                    <ImageBox src={p.image_url || null} alt={p.name} ratio="4:3" />
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>
                        {p.subcategory || p.category || "—"}
                      </div>
                      <div className="badge" style={{ marginTop: 6 }}>{money(p.price)}</div>
                    </div>
                    <div className="row" style={{ marginTop: 10 }}>
                      <div style={{ flex: 1 }} />
                      <Link className="btn" href={`/checkout/${brand.slug}?pid=${p.id}`}>
                        Agregar
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
