// pages/marcas/[slug].jsx
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import CartSidebar from "@/components/CartSidebar";
import ProductCard from "@/components/ProductCard";

export default function BrandPage() {
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState(null);
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");

  // slug desde la URL (pages router)
  const slug = useMemo(() => {
    if (typeof window === "undefined") return null;
    const parts = window.location.pathname.split("/");
    return parts[parts.length - 1] || null;
  }, []);

  // Cargar marca + productos visibles
  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      try {
        const { data: b, error: e1 } = await supabase
          .from("brands")
          .select("id, name, slug, description, instagram_url, logo_url, active")
          .eq("slug", slug)
          .maybeSingle();
        if (e1) throw e1;
        setBrand(b);

        if (b?.id) {
          const { data: ps, error: e2 } = await supabase
            .from("products")
            .select("id, name, price, stock, active, category, subcategory, images")
            .eq("brand_id", b.id)
            .eq("active", true)
            .gt("stock", 0)
            .order("created_at", { ascending: false });
          if (e2) throw e2;
          setProducts(Array.isArray(ps) ? ps : []);
        } else {
          setProducts([]);
        }
      } catch (err) {
        console.error(err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  // filtro por búsqueda
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (p) =>
        p.name?.toLowerCase()?.includes(term) ||
        p.category?.toLowerCase()?.includes(term) ||
        p.subcategory?.toLowerCase()?.includes(term)
    );
  }, [products, q]);

  // Agregar al carrito (por marca)
  function onAddToCart(item) {
    if (!brand?.id) return;
    const key = `cabure:cart:${brand.id}`;
    let current = [];
    try {
      current = JSON.parse(localStorage.getItem(key) || "[]");
    } catch {}
    const idx = current.findIndex((x) => x.id === item.id);
    if (idx >= 0) {
      current[idx].qty = Number(current[idx].qty || 1) + 1;
    } else {
      current.push({ ...item, qty: 1 });
    }
    localStorage.setItem(key, JSON.stringify(current));
  }

  return (
    <>
      <Head>
        <title>{brand?.name ? `${brand.name} — CABURE.STORE` : "Marca — CABURE.STORE"}</title>
      </Head>

      <header
        className="card"
        style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr 360px",
          gap: 16,
          alignItems: "stretch",
          padding: 16,
          marginBottom: 16,
        }}
      >
        {/* Logo cuadrado, ocupando toda la caja */}
        <div
          style={{
            width: "100%",
            aspectRatio: "1 / 1",
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid var(--border)",
            background: "var(--muted)",
          }}
        >
          {brand?.logo_url ? (
            <img
              src={brand.logo_url}
              alt={brand?.name || "Marca"}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "grid",
                placeItems: "center",
                opacity: 0.6,
                fontSize: 12,
              }}
            >
              Sin logo
            </div>
          )}
        </div>

        {/* Nombre / descripción / instagram */}
        <div style={{ display: "grid", alignContent: "start", gap: 8 }}>
          <h1 style={{ margin: 0 }}>{brand?.name || "Marca"}</h1>
          {brand?.description && (
            <p style={{ margin: 0, opacity: 0.9 }}>{brand.description}</p>
          )}
          {brand?.instagram_url && (
            <a
              href={brand.instagram_url}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost"
              style={{ width: "fit-content" }}
            >
              Instagram
            </a>
          )}
        </div>

        {/* Carrito por marca */}
        <div>
          {brand?.id && <CartSidebar brandId={brand.id} />}
        </div>
      </header>

      {/* Barra de búsqueda arriba del catálogo */}
      <section className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div className="row" style={{ alignItems: "center", gap: 12 }}>
          <button className="btn btn-ghost" onClick={() => setQ("")}>
            Todos
          </button>
          <input
            placeholder="Buscar producto…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 360 }}
          />
          <div style={{ flex: 1 }} />
          <Link className="btn btn-ghost" href="/">
            Volver
          </Link>
        </div>
      </section>

      {/* Catálogo */}
      {loading ? (
        <div className="status-loading" style={{ height: 120 }} />
      ) : filtered.length === 0 ? (
        <div
          className="card"
          style={{
            padding: 24,
            textAlign: "center",
            opacity: 0.8,
            border: "1px dashed var(--border)",
          }}
        >
          No hay productos para mostrar.
        </div>
      ) : (
        <section
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          }}
        >
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} onAdd={onAddToCart} />
          ))}
        </section>
      )}

      <style jsx global>{`
        /* utilidades mínimas para que se vea lindo */
        :root {
          --border: #2a2a2a;
          --muted: #111417;
        }
        .card {
          background: #0b0e11;
          border: 1px solid var(--border);
          border-radius: 16px;
        }
        .row {
          display: flex;
        }
        .btn {
          padding: 8px 12px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: #0f1418;
          color: #e6fff7;
          cursor: pointer;
        }
        .btn-ghost {
          background: transparent;
        }
        .btn-primary {
          background: #17f1b5;
          color: #00130e;
          border-color: #17f1b5;
          font-weight: 700;
        }
        .btn-disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .divider {
          height: 1px;
          background: var(--border);
          margin: 12px 0;
        }
        .ellipsis {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        input {
          background: #0f1418;
          color: #e6fff7;
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 8px 10px;
        }
        @media (max-width: 1200px) {
          section[style*="grid-template-columns: repeat(4"] {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 900px) {
          section[style*="grid-template-columns: repeat(3"] {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 640px) {
          section[style*="grid-template-columns: repeat(2"] {
            grid-template-columns: repeat(1, minmax(0, 1fr)) !important;
          }
          header.card {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}
