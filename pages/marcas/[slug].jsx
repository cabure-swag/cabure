// pages/marcas/[slug].jsx
import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";

const money = (n) => Number(n || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

function BrandCatalogInner() {
  const router = useRouter();
  const { slug } = router.query || {};

  const [brand, setBrand] = useState(null);
  const [products, setProducts] = useState(null);
  const [loading, setLoading] = useState(true);

  // carrito local por marca (guardado en localStorage)
  const cartKey = useMemo(() => (brand ? `cabure:cart:${brand.id}` : null), [brand]);
  const [cart, setCart] = useState([]);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      try {
        // marca
        const { data: b, error: e1 } = await supabase
          .from("brands")
          .select("id,name,slug,description,logo_url,color,instagram_url,bank_alias,bank_cbu,mp_access_token,active,deleted_at")
          .eq("slug", slug)
          .maybeSingle();
        if (e1) throw e1;
        if (!b || !b.active || b.deleted_at) {
          setBrand(null);
          setProducts([]);
          setLoading(false);
          return;
        }
        setBrand(b);

        // productos (mostramos también sin stock pero deshabilitados)
        const { data: prods, error: e2 } = await supabase
          .from("products")
          .select("id,brand_id,name,price,image_url,category,subcategory,active,deleted_at,stock,created_at")
          .eq("brand_id", b.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });
        if (e2) throw e2;
        // por seguridad, ocultamos los inactivos al público
        setProducts((prods || []).filter(p => p.active));
      } catch (err) {
        console.error(err);
        setBrand(null);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  // cargar carrito desde localStorage al montar / cuando cambia la marca
  useEffect(() => {
    if (!cartKey) return;
    try {
      const raw = localStorage.getItem(cartKey);
      setCart(raw ? JSON.parse(raw) : []);
    } catch {
      setCart([]);
    }
  }, [cartKey]);

  // persistir carrito
  useEffect(() => {
    if (!cartKey) return;
    localStorage.setItem(cartKey, JSON.stringify(cart || []));
  }, [cartKey, cart]);

  function addToCart(p) {
    if (!p?.id) return;
    // buscar si ya está
    const found = cart.find((it) => it.product_id === p.id);
    const currentQty = found?.qty || 0;
    const nextQty = currentQty + 1;

    // no permitir superar el stock
    if (Number(p.stock) > 0 && nextQty > Number(p.stock)) {
      alert("No hay stock suficiente.");
      return;
    }

    const next = found
      ? cart.map((it) => (it.product_id === p.id ? { ...it, qty: nextQty } : it))
      : [...cart, { product_id: p.id, name: p.name, unit_price: p.price, qty: 1 }];

    setCart(next);
  }

  function changeQty(product_id, qty, max) {
    let q = parseInt(qty || "0", 10);
    if (Number.isNaN(q) || q < 0) q = 0;
    if (Number(max) > 0 && q > Number(max)) q = Number(max);
    const next = cart
      .map((it) => (it.product_id === product_id ? { ...it, qty: q } : it))
      .filter((it) => it.qty > 0);
    setCart(next);
  }

  function removeItem(product_id) {
    setCart((prev) => prev.filter((it) => it.product_id !== product_id));
  }

  const total = useMemo(() => cart.reduce((acc, it) => acc + Number(it.qty) * Number(it.unit_price), 0), [cart]);

  if (loading) {
    return (
      <div className="container">
        <Head><title>Marca — CABURE.STORE</title></Head>
        <div className="skel" style={{ height: 140, marginTop: 24 }} />
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="container">
        <Head><title>Marca — CABURE.STORE</title></Head>
        <p>No se encontró esta marca o no está pública.</p>
        <Link className="btn" href="/">Volver</Link>
      </div>
    );
  }

  return (
    <div className="container">
      <Head>
        <title>{brand.name} — CABURE.STORE</title>
        <meta name="description" content={brand.description || `Catálogo de ${brand.name}`} />
        <meta property="og:title" content={`${brand.name} — CABURE.STORE`} />
        <meta property="og:description" content={brand.description || ""} />
        {brand.logo_url ? <meta property="og:image" content={brand.logo_url} /> : null}
        <link rel="canonical" href={`https://cabure.store/marcas/${brand.slug}`} />
      </Head>

      {/* header de marca */}
      <section className="card" style={{ padding: 16, marginTop: 12, borderColor: brand.color || "#111827" }}>
        <div className="row" style={{ gap: 12, alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {brand.logo_url ? (
            <img src={brand.logo_url} alt={brand.name} width={64} height={64} style={{ borderRadius: 12, objectFit: "cover" }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: 12, background: "#111827", display: "grid", placeItems: "center" }}>
              <span style={{ opacity: 0.7 }}>Logo</span>
            </div>
          )}
          <div>
            <h1 style={{ margin: 0 }}>{brand.name}</h1>
            <div style={{ opacity: 0.8, fontSize: 14 }}>{brand.description || "Sin descripción"}</div>
            {brand.instagram_url ? (
              <a
                href={brand.instagram_url}
                target="_blank"
                rel="noreferrer"
                title="Instagram"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, opacity: 0.9 }}
              >
                {/* ícono IG simple */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M7 2C4.24 2 2 4.24 2 7v10c0 2.76 2.24 5 5 5h10c2.76 0 5-2.24 5-5V7c0-2.76-2.24-5-5-5H7zm10 2c1.66 0 3 1.34 3 3v10a3 3 0 01-3 3H7a3 3 0 01-3-3V7c0-1.66 1.34-3 3-3h10zm-5 3a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6zm5.75-.75a.75.75 0 100 1.5.75.75 0 000-1.5z"/>
                </svg>
                Instagram
              </a>
            ) : null}
          </div>

          <div style={{ flex: 1 }} />

          {/* mini carrito */}
          <div className="card" style={{ padding: 12, minWidth: 280 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Carrito</div>
            {!cart.length ? (
              <div style={{ opacity: 0.7 }}>Vacío</div>
            ) : (
              <>
                <div style={{ display: "grid", gap: 6 }}>
                  {cart.map((it) => {
                    const p = products?.find((x) => x.id === it.product_id);
                    const max = p?.stock ?? 0;
                    return (
                      <div key={it.product_id} className="row" style={{ alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{it.name}</div>
                          <div style={{ fontSize: 12, opacity: 0.8 }}>{money(it.unit_price)}</div>
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={max}
                          step={1}
                          value={it.qty}
                          className="input"
                          style={{ width: 70 }}
                          onChange={(e) => changeQty(it.product_id, e.target.value, max)}
                          aria-label={`Cantidad para ${it.name}`}
                        />
                        <button className="btn danger xsmall" onClick={() => removeItem(it.product_id)} aria-label="Quitar">X</button>
                      </div>
                    );
                  })}
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 700 }}>Total: {money(total)}</div>
                  <div style={{ flex: 1 }} />
                  <button
                    className="btn"
                    onClick={() => router.push(`/checkout/${brand.slug}`)}
                    disabled={!cart.length}
                  >
                    Ir a pagar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* grilla de productos */}
      <section style={{ marginTop: 16 }}>
        {!products ? (
          <div className="skel" style={{ height: 180 }} />
        ) : products.length === 0 ? (
          <div className="card" style={{ padding: 16 }}>No hay productos para mostrar.</div>
        ) : (
          <div className="grid grid-3" style={{ gap: 12 }}>
            {products.map((p) => {
              const disabled = Number(p.stock) <= 0;
              return (
                <article key={p.id} className="card" style={{ padding: 12 }}>
                  <div style={{ width: "100%", height: 200, borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", display: "grid", placeItems: "center", background: "#0e1012" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                    ) : (
                      <div style={{ opacity: 0.6, fontSize: 12 }}>Sin imagen</div>
                    )}
                  </div>
                  <div style={{ marginTop: 8, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ opacity: 0.8, fontSize: 13 }}>{p.subcategory || p.category || "—"}</div>
                  <div className="row" style={{ alignItems: "center", marginTop: 6 }}>
                    <div className="badge">{money(p.price)}</div>
                    <div className="badge" style={{ marginLeft: 6 }}>Stock: {p.stock ?? 0}</div>
                    <div style={{ flex: 1 }} />
                    <button
                      className="btn"
                      onClick={() => addToCart(p)}
                      disabled={disabled}
                      aria-disabled={disabled}
                      title={disabled ? "Sin stock" : "Agregar al carrito"}
                    >
                      {disabled ? "Sin stock" : "Agregar"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default dynamic(() => Promise.resolve(BrandCatalogInner), { ssr: false });
