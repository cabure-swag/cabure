// pages/marcas/[slug].jsx
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";

const CATS = ["Todas", "Remera", "Pantalon", "Buzo", "Campera", "Gorra", "Otros"];

function useBrandCart(slug) {
  const key = slug ? `cabure_cart_${slug}` : null;
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      setItems(raw ? JSON.parse(raw) : []);
    } catch {
      setItems([]);
    }
  }, [key]);

  useEffect(() => {
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(items));
  }, [key, items]);

  const totals = useMemo(() => {
    const qty = items.reduce((s, it) => s + it.qty, 0);
    const amount = items.reduce((s, it) => s + (Number(it.price) || 0) * it.qty, 0);
    return { qty, amount };
  }, [items]);

  function addItem(p) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { id: p.id, name: p.name, price: p.price, image_url: p.image_url || null, qty: 1 }];
    });
  }
  function setQty(id, qty) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, qty: Math.max(1, qty) } : i)));
  }
  function removeItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }
  function clear() {
    setItems([]);
  }

  return { items, totals, addItem, setQty, removeItem, clear, storageKey: key };
}

export default function BrandCatalog() {
  const router = useRouter();
  const { slug } = router.query;
  const cart = useBrandCart(slug);

  const [brand, setBrand] = useState(null); // null: loading; {}: ok; false: no encontrada
  const [products, setProducts] = useState(null);
  const [cat, setCat] = useState("Todas");
  const [q, setQ] = useState("");

  // Cargar marca pública
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
        .select("id,name,price,image_url,category,subcategory,active,deleted_at,created_at")
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

  const checkoutHref = brand?.slug ? `/checkout/${brand.slug}` : "#";

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
              <Link href={checkoutHref} className={`btn secondary ${cart.totals.qty ? "" : "disabled"}`}>
                Ir al checkout {cart.totals.qty ? `(${cart.totals.qty})` : ""}
              </Link>
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
                    <button
                      className="btn"
                      style={{ marginTop: 8, width: "100%" }}
                      onClick={() => cart.addItem(p)}
                      aria-label={`Agregar ${p.name} al carrito`}
                    >
                      Agregar al carrito
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Mini-carrito de esta marca */}
          <section className="card" style={{ padding: 16, marginTop: 16 }}>
            <h2 style={{ marginTop: 0 }}>Carrito de {brand.name}</h2>
            {!cart.items.length ? (
              <div className="card" style={{ padding: 16 }}>Todavía no agregaste productos.</div>
            ) : (
              <>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {cart.items.map((it) => (
                    <li key={it.id} className="row" style={{ alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                      <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                      <div style={{ color: "var(--text-dim)" }}>${Number(it.price || 0).toLocaleString("es-AR")}</div>
                      <input
                        type="number"
                        min={1}
                        value={it.qty}
                        onChange={(e) => cart.setQty(it.id, Number(e.target.value || 1))}
                        className="input"
                        style={{ width: 72 }}
                        aria-label={`Cantidad de ${it.name}`}
                      />
                      <button className="btn ghost" onClick={() => cart.removeItem(it.id)}>Quitar</button>
                    </li>
                  ))}
                </ul>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
                  <button className="btn ghost" onClick={() => cart.clear()}>Vaciar</button>
                  <div style={{ textAlign: "right" }}>
                    <div>Total</div>
                    <strong>${Number(cart.totals.amount || 0).toLocaleString("es-AR")}</strong>
                  </div>
                </div>
                <div style={{ marginTop: 12, textAlign: "right" }}>
                  <Link href={checkoutHref} className="btn secondary">
                    Ir al checkout {cart.totals.qty ? `(${cart.totals.qty})` : ""}
                  </Link>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
