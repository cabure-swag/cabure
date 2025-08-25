// pages/marcas/[slug].jsx
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/** Carrito simple embebido para no romper si falta tu Cart real */
function CartPanelBare() {
  const [open, setOpen] = useState(true);
  return (
    <aside className="card" style={{ padding: 12 }}>
      <div className="row" style={{ alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Carrito</h3>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={() => setOpen((v) => !v)}>
          {open ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      {open && (
        <>
          <div
            style={{
              marginTop: 8,
              padding: 12,
              borderRadius: 10,
              background: "var(--panel)",
              border: "1px dashed var(--border)",
              color: "#9aa",
              fontSize: 14,
            }}
          >
            Tu carrito está vacío.
          </div>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button className="btn btn-ghost">Vaciar</button>
            <button className="btn btn-primary">Continuar</button>
            <div style={{ flex: 1 }} />
            <strong>$0</strong>
          </div>
        </>
      )}
    </aside>
  );
}

function currency(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

export default function BrandPage() {
  const router = useRouter();
  const { slug } = router.query;

  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState(null);
  const [productsRaw, setProductsRaw] = useState([]);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("Todas");

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // 1) MARCA: seleccionar TODO y mapear campos (para evitar mismatch de nombres)
        const { data: b, error: e1 } = await supabase
          .from("brands")
          .select("*")
          .eq("slug", slug)
          .maybeSingle();
        if (e1) throw e1;

        // Si RLS no permite leer o no existe, b será null.
        if (!cancelled) setBrand(b || null);

        // 2) PRODUCTOS: traer todos los de la marca (policy ya filtra active/stock si querés)
        if (b?.id) {
          const { data: ps, error: e2 } = await supabase
            .from("products")
            .select("*")
            .eq("brand_id", b.id)
            .order("id", { ascending: false });
          if (e2) throw e2;
          if (!cancelled) setProductsRaw(Array.isArray(ps) ? ps : []);
        } else {
          if (!cancelled) setProductsRaw([]);
        }
      } catch (err) {
        console.error("[/marcas/[slug]] error:", err);
        if (!cancelled) {
          setBrand(null);
          setProductsRaw([]);
        }
      } finally {
        !cancelled && setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Normalizo campos de marca para UI (logo/instagram pueden tener nombres distintos)
  const brandUI = useMemo(() => {
    if (!brand) return null;
    const logo =
      brand.logo_url || brand.logo || brand.image || brand.avatar_url || null;
    const instagram =
      brand.instagram_url || brand.instagram || brand.ig || null;
    return {
      id: brand.id,
      name: brand.name || brand.title || "Marca",
      description: brand.description || brand.bio || "",
      slug: brand.slug,
      logo,
      instagram,
      color: brand.color || null,
    };
  }, [brand]);

  // Filtro en cliente por si stock es texto. (Aun si la policy ya filtra)
  const products = useMemo(() => {
    const base = Array.isArray(productsRaw) ? productsRaw : [];
    let data = base.filter((p) => {
      const active = Boolean(p?.active);
      const stockNum = Number((p?.stock ?? 0));
      return active && stockNum > 0;
    });
    if (activeCat && activeCat !== "Todas") {
      data = data.filter(
        (p) => (p?.category || "").trim() === (activeCat || "").trim()
      );
    }
    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter((p) => p?.name?.toLowerCase().includes(q));
    }
    return data;
  }, [productsRaw, activeCat, search]);

  // Categorías para chips
  const categories = useMemo(() => {
    const s = new Set();
    (Array.isArray(productsRaw) ? productsRaw : []).forEach((p) => {
      const c = (p?.category || "").trim();
      if (c) s.add(c);
    });
    return ["Todas", ...Array.from(s)];
  }, [productsRaw]);

  return (
    <>
      <Head>
        <title>{brandUI?.name ? `${brandUI.name} — CABURE.STORE` : "CABURE.STORE"}</title>
      </Head>

      <div className="container" style={{ paddingBottom: 56 }}>
        {/* HEADER (logo izq, datos centro, carrito der) */}
        <section
          className="card"
          style={{
            display: "grid",
            gridTemplateColumns: "160px 1fr 360px",
            gap: 16,
            alignItems: "center",
            padding: 16,
          }}
        >
          {/* LOGO (ocupa todo el cuadrado) */}
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: 16,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--panel)",
              border: "1px dashed var(--border)",
            }}
          >
            {brandUI?.logo ? (
              <img
                src={brandUI.logo}
                alt={brandUI?.name || "logo"}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <div style={{ color: "#999", fontSize: 12 }}>Sin logo</div>
            )}
          </div>

          {/* DATOS */}
          <div>
            <h1 style={{ margin: 0 }}>{brandUI?.name || "Marca"}</h1>
            {brandUI?.description && (
              <p style={{ margin: "6px 0 12px 0", color: "#bbb" }}>
                {brandUI.description}
              </p>
            )}
            <div className="row" style={{ gap: 8 }}>
              {brandUI?.instagram && (
                <a
                  href={brandUI.instagram}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost"
                  aria-label="Instagram"
                >
                  <span style={{ marginRight: 6 }}>📸</span>
                  Instagram
                </a>
              )}
              {brandUI?.slug && (
                <Link href={`/marcas/${brandUI.slug}`} className="btn btn-ghost">
                  Perfil público
                </Link>
              )}
            </div>
          </div>

          {/* CARRITO */}
          <CartPanelBare />
        </section>

        {/* CONTROLES SOBRE EL CATÁLOGO */}
        <section className="row" style={{ gap: 12, marginTop: 16 }}>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`chip ${cat === activeCat ? "chip--active" : ""}`}
                onClick={() => setActiveCat(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto…"
            className="input"
            style={{ maxWidth: 320 }}
            aria-label="Buscar producto"
          />
        </section>

        {/* CATÁLOGO (4 por fila) */}
        <section
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card skeleton" style={{ height: 380 }} />
            ))
          ) : products.length === 0 ? (
            <div
              className="card"
              style={{
                gridColumn: "1 / -1",
                padding: 24,
                textAlign: "center",
                border: "1px dashed var(--border)",
              }}
            >
              No hay productos para mostrar.
            </div>
          ) : (
            products.map((p) => <ProductCard key={p.id} product={p} />)
          )}
        </section>
      </div>

      <style jsx>{`
        .chip {
          background: var(--panel);
          color: var(--text);
          border: 1px solid var(--border);
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 0.9rem;
        }
        .chip--active {
          background: var(--brand);
          color: #000;
          border-color: var(--brand);
        }
        .input {
          width: 100%;
          background: var(--panel);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 10px 12px;
          border-radius: 10px;
          outline: none;
        }
        .skeleton {
          opacity: 0.5;
        }
      `}</style>
    </>
  );
}

function ProductCard({ product }) {
  const imgs = Array.isArray(product?.images) ? product.images : [];
  const img = imgs?.[0] || null;

  return (
    <article className="card" style={{ padding: 12 }}>
      <div
        style={{
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 12,
          overflow: "hidden",
          position: "relative",
          background: "var(--panel)",
          border: "1px dashed var(--border)",
        }}
      >
        {img ? (
          <img
            src={img}
            alt={product?.name || "producto"}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#888",
              fontSize: 12,
            }}
          >
            Sin imagen
          </div>
        )}
      </div>

      <h3 style={{ margin: "8px 0 0 0", fontSize: "1rem" }}>
        {product?.name || "Producto"}
      </h3>
      <div style={{ color: "#9aa", fontSize: 12, marginTop: 2 }}>
        {(product?.category || "").trim() || "—"}
      </div>

      <div className="row" style={{ alignItems: "center", marginTop: 8 }}>
        <strong>{currency(product?.price)}</strong>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary">Agregar</button>
      </div>
    </article>
  );
}
