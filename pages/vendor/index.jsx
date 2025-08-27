// pages/vendor/index.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import { supabase } from "@/lib/supabaseClient";
import { withRoleGuard } from "@/utils/roleGuards"; // si no lo tenés, podés omitir y usar chequeo simple de session

function toPublicURL(input) {
  if (!input) return null;
  const v = String(input).trim();
  if (!v) return null;
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!base) return null;
  const clean = v.replace(/^\/+/, "");
  if (clean.startsWith("product-images/") || clean.startsWith("brand-logos/")) {
    return `${base}/storage/v1/object/public/${clean}`;
  }
  return `${base}/storage/v1/object/public/product-images/${clean}`;
}

function normalizeImages(images, fallback) {
  const out = [];
  try {
    if (Array.isArray(images)) out.push(...images.filter(Boolean));
    else if (typeof images === "string") {
      const s = images.trim();
      if (s.startsWith("[")) {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) out.push(...arr.filter(Boolean));
      } else if (s) out.push(s);
    }
  } catch {}
  if (out.length === 0 && fallback) out.push(fallback);
  return out;
}

function VendorPage() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  const [brands, setBrands] = useState([]);
  const [activeBrandId, setActiveBrandId] = useState(null);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // --- auth load ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("user_id,email,role").eq("user_id", session.user.id).maybeSingle();
      setProfile(data || null);
    })();
  }, [session?.user?.id]);

  // --- cargar marcas donde soy vendor o admin ---
  useEffect(() => {
    if (!session?.user?.id) return;

    (async () => {
      // Si sos admin, ves todas las brands; si sos vendor, solo asignadas
      const isAdmin = profile?.role === "admin";
      if (isAdmin) {
        const { data } = await supabase
          .from("brands")
          .select("id,name,slug,active,deleted_at")
          .is("deleted_at", null)
          .order("name", { ascending: true });
        setBrands(data || []);
        if (!activeBrandId && data?.[0]?.id) setActiveBrandId(data[0].id);
      } else {
        const { data } = await supabase
          .from("brand_users")
          .select("brand_id, brands(id,name,slug,active,deleted_at)")
          .eq("user_id", session.user.id);
        const mapped = (data || [])
          .map((x) => x.brands)
          .filter(Boolean)
          .filter((b) => b.deleted_at == null);
        setBrands(mapped);
        if (!activeBrandId && mapped?.[0]?.id) setActiveBrandId(mapped[0].id);
      }
    })();
  }, [session?.user?.id, profile?.role, activeBrandId]);

  // --- cargar productos de brand seleccionada ---
  useEffect(() => {
    if (!activeBrandId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("id,brand_id,name,price,image_url,images,category,subcategory,active,stock,deleted_at,created_at")
        .eq("brand_id", activeBrandId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      setLoading(false);
      if (!error) {
        setProducts(
          (data || []).map((p) => ({
            ...p,
            _imagesRaw: normalizeImages(p.images, p.image_url), // paths (no públicos)
          }))
        );
      }
    })();
  }, [activeBrandId]);

  async function updateProductField(productId, patch) {
    const { data, error } = await supabase.from("products").update(patch).eq("id", productId).select("id").maybeSingle();
    if (error) throw error;
    // refrescar en memoria
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, ...patch } : p)));
  }

  // --- manejo de imágenes ---
  function canAddMore(imagesArr) {
    const count = Array.isArray(imagesArr) ? imagesArr.length : 0;
    return count < 5;
  }

  async function handleUploadImage(p, file) {
    if (!file || !p?.id || !activeBrandId) return;
    const ext = file.name.split(".").pop();
    const path = `product-images/${activeBrandId}/${p.id}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage.from("product-images").upload(path.replace("product-images/",""), file, {
      upsert: false,
      cacheControl: "3600",
    });
    if (upErr) {
      alert("No se pudo subir la imagen.");
      return;
    }

    // Agregar a images (ARRAY)
    const nextArr = [...(p._imagesRaw || [])];
    nextArr.push(path);
    if (nextArr.length > 5) nextArr.splice(5); // limitar a 5

    const { error: updErr } = await supabase
      .from("products")
      .update({ images: nextArr })
      .eq("id", p.id);
    if (updErr) {
      alert("No se pudo actualizar las imágenes.");
      return;
    }

    setProducts((prev) =>
      prev.map((it) => (it.id === p.id ? { ...it, _imagesRaw: nextArr } : it))
    );
  }

  async function handleRemoveImage(p, imgPath) {
    if (!p?.id || !imgPath) return;
    const nextArr = (p._imagesRaw || []).filter((x) => x !== imgPath);
    const { error } = await supabase.from("products").update({ images: nextArr }).eq("id", p.id);
    if (error) {
      alert("No se pudo eliminar la imagen.");
      return;
    }
    setProducts((prev) =>
      prev.map((it) => (it.id === p.id ? { ...it, _imagesRaw: nextArr } : it))
    );
  }

  // --- ui helpers ---
  function Uploader({ product }) {
    const ref = useRef(null);
    return (
      <>
        <button
          className="btn"
          onClick={() => ref.current?.click()}
          disabled={!canAddMore(product._imagesRaw)}
          aria-label="Subir imagen"
        >
          Subir imagen
        </button>
        <input
          ref={ref}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            handleUploadImage(product, f);
            e.target.value = "";
          }}
        />
      </>
    );
  }

  return (
    <div className="container">
      <Head><title>Vendor — CABURE.STORE</title></Head>
      <h1 style={{ marginBottom: 12 }}>Vendedor</h1>

      {/* selector de marca */}
      <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 12 }}>
        <label htmlFor="brandSel">Marca</label>
        <select
          id="brandSel"
          value={activeBrandId || ""}
          onChange={(e) => setActiveBrandId(e.target.value || null)}
          className="sel"
        >
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      <section className="card" style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Catálogo</h2>

        {loading && <div className="skeleton" style={{ height: 80 }} />}

        {!loading && products.length === 0 && (
          <div className="empty">No hay productos aún.</div>
        )}

        {!loading && products.length > 0 && (
          <div className="grid">
            {products.map((p) => (
              <div key={p.id} className="pCard">
                <div className="thumb">
                  <img
                    src={toPublicURL((p._imagesRaw && p._imagesRaw[0]) || p.image_url) || "/placeholder.png"}
                    alt={p.name}
                  />
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <label className="lab">Nombre</label>
                  <input
                    className="inp"
                    defaultValue={p.name || ""}
                    onBlur={async (e) => {
                      const v = e.target.value.trim();
                      if (v !== p.name) await updateProductField(p.id, { name: v });
                    }}
                  />
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <label className="lab">Precio</label>
                  <input
                    className="inp"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={p.price ?? 0}
                    onBlur={async (e) => {
                      const val = Number(e.target.value || 0);
                      if (val !== p.price) await updateProductField(p.id, { price: val });
                    }}
                  />
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <label className="lab">Stock</label>
                  <input
                    className="inp"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={p.stock ?? 1}
                    onBlur={async (e) => {
                      const val = Math.max(0, parseInt(e.target.value || "0", 10));
                      if (val !== p.stock) await updateProductField(p.id, { stock: val });
                    }}
                  />
                </div>
                <div className="row" style={{ gap: 6, alignItems: "center" }}>
                  <label className="lab">Activo</label>
                  <input
                    type="checkbox"
                    defaultChecked={!!p.active}
                    onChange={async (e) => {
                      const val = !!e.target.checked;
                      if (val !== p.active) await updateProductField(p.id, { active: val });
                    }}
                  />
                </div>

                {/* Gestión de imágenes */}
                <div className="imgsBlock">
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <strong>Imágenes ({Math.min((p._imagesRaw || []).length, 5)}/5)</strong>
                    <Uploader product={p} />
                  </div>
                  <div className="thumbs">
                    {(p._imagesRaw || []).slice(0, 5).map((img) => (
                      <div key={img} className="mini">
                        <img src={toPublicURL(img)} alt="product img" />
                        <button
                          className="del"
                          title="Eliminar"
                          aria-label="Eliminar imagen"
                          onClick={() => handleRemoveImage(p, img)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <style jsx>{`
        .container { padding: 16px; }
        .row { display:flex; }
        .sel, .inp {
          padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a;
          background:#0f0f0f; color:#fff;
        }
        .lab { width:90px; font-size:.9rem; opacity:.85; }
        .card { border:1px solid #1a1a1a; border-radius:14px; background:#0a0a0a; }

        .grid {
          display:grid; gap:16px;
          grid-template-columns: repeat(3, 1fr);
        }
        @media (max-width: 1100px){ .grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px){ .grid { grid-template-columns: 1fr; } }

        .pCard { border:1px solid #1a1a1a; border-radius:12px; background:#0f0f0f; padding:12px; display:grid; gap:8px; }
        .thumb { width:100%; aspect-ratio:1/1; background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; overflow:hidden; }
        .thumb img { width:100%; height:100%; object-fit:cover; display:block; }

        .imgsBlock { margin-top:8px; border-top:1px dashed #222; padding-top:8px; display:grid; gap:8px; }
        .thumbs { display:flex; gap:8px; flex-wrap:wrap; }
        .mini { position:relative; width:88px; height:88px; border:1px solid #222; border-radius:10px; overflow:hidden; background:#0a0a0a; }
        .mini img { width:100%; height:100%; object-fit:cover; display:block; }
        .del {
          position:absolute; top:4px; right:4px; width:22px; height:22px; border-radius:999px;
          background:#111; color:#fff; border:1px solid #333; cursor:pointer;
        }

        .btn {
          padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#161616; color:#fff; cursor:pointer;
        }
        .empty { padding:12px; border:1px dashed #2a2a2a; border-radius:12px; text-align:center; opacity:.9; }
        .skeleton { background:linear-gradient(90deg,#0f0f0f,#151515,#0f0f0f); animation:pulse 1.5s infinite; border-radius:10px; }
        @keyframes pulse { 0%{opacity:.6} 50%{opacity:1} 100%{opacity:.6} }
      `}</style>
    </div>
  );
}

// Si no tenés withRoleGuard, export default VendorPage;
export default VendorPage;
// export default withRoleGuard(VendorPage, ["vendor","admin"]);
