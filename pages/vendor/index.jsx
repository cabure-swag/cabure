// pages/vendor/index.jsx
import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ChatBox from "@/components/ChatBox";

const TABS = ["Chats", "Catálogo", "Pedidos"];
const MAX_IMAGES = 5;
const BUCKET = "product-images";

function currency(n) {
  const v = Number(n || 0);
  return isNaN(v) ? "$0" : v.toLocaleString("es-AR", { minimumFractionDigits: 0 });
}

function clampInt(n, min = 0, max = 999999) {
  const v = parseInt(n ?? 0, 10);
  if (isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function nowIso() { return new Date().toISOString(); }

export default function VendorPage() {
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState("Chats");

  // marcas donde soy vendedor
  const [brands, setBrands] = useState([]);
  const [brandId, setBrandId] = useState(null);
  const activeBrand = useMemo(() => brands.find(b => b.id === brandId) || null, [brands, brandId]);

  // --- CHATS (igual que antes) ---
  const [threads, setThreads] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [buyerMap, setBuyerMap] = useState({});

  // --- CATALOGO ---
  const [products, setProducts] = useState([]); // [{...product, images: [{id,url,position}]}]
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // cargar marcas asignadas
  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("brand_users")
        .select("brand_id, brands!inner(id,name,slug)")
        .eq("user_id", session.user.id);
      if (error) { console.error(error); return; }
      const bs = (data || []).map(r => r.brands).filter(Boolean);
      if (!cancelled) {
        setBrands(bs);
        if (bs.length && !brandId) setBrandId(bs[0].id);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  // --------- CHATS ----------
  useEffect(() => {
    if (!activeBrand?.id) { setThreads([]); setActiveThreadId(null); return; }
    let cancelled = false;
    (async () => {
      setLoadingThreads(true);
      try {
        const { data: ts } = await supabase
          .from("support_threads")
          .select("id,user_id,status,created_at")
          .eq("brand_id", activeBrand.id)
          .order("status", { ascending: true })
          .order("created_at", { ascending: false });
        if (!cancelled) {
          setThreads(ts || []);
          setActiveThreadId(ts?.[0]?.id || null);
        }
      } finally {
        if (!cancelled) setLoadingThreads(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeBrand?.id]);

  useEffect(() => {
    if (!threads.length) { setBuyerMap({}); return; }
    let cancelled = false;
    (async () => {
      const ids = Array.from(new Set(threads.map(t => t.user_id).filter(Boolean)));
      if (!ids.length) return;
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id,email,full_name,name")
        .in("user_id", ids);
      const map = {};
      (profiles || []).forEach(p => { map[p.user_id] = p.full_name || p.name || p.email || "Cliente"; });
      if (!cancelled) setBuyerMap(map);
    })();
    return () => { cancelled = true; };
  }, [threads]);

  useEffect(() => {
    if (!activeBrand?.id) return;
    const ch = supabase
      .channel(`threads_${activeBrand.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "support_threads", filter: `brand_id=eq.${activeBrand.id}` },
        async () => {
          const { data: ts } = await supabase
            .from("support_threads")
            .select("id,user_id,status,created_at")
            .eq("brand_id", activeBrand.id)
            .order("status", { ascending: true })
            .order("created_at", { ascending: false });
          setThreads(ts || []);
        }
      ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeBrand?.id]);

  // --------- CATALOGO ----------
  async function loadProducts() {
    if (!activeBrand?.id) { setProducts([]); return; }
    setLoadingProducts(true);
    try {
      const { data: prods, error } = await supabase
        .from("products")
        .select("id,brand_id,name,price,stock,category,subcategory,active,image_url,created_at")
        .eq("brand_id", activeBrand.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) { console.error(error); setProducts([]); return; }
      const list = prods || [];

      // Intentamos traer product_images; si no existe la tabla, seguimos con la imagen simple
      let imgsByProduct = {};
      if (list.length) {
        const ids = list.map(p => p.id);
        const { data: imgs, error: eImg } = await supabase
          .from("product_images")
          .select("id,product_id,url,position")
          .in("product_id", ids)
          .order("position", { ascending: true });
        if (!eImg && imgs) {
          imgsByProduct = imgs.reduce((acc, it) => {
            (acc[it.product_id] ||= []).push({ id: it.id, url: it.url, position: it.position });
            return acc;
          }, {});
        }
      }

      setProducts(list.map(p => ({
        ...p,
        images: (imgsByProduct[p.id] && imgsByProduct[p.id].length)
          ? imgsByProduct[p.id]
          : (p.image_url ? [{ id: "legacy", url: p.image_url, position: 0 }] : [])
      })));
    } finally {
      setLoadingProducts(false);
    }
  }

  useEffect(() => { loadProducts(); /* eslint-disable-next-line */ }, [activeBrand?.id]);

  async function createProduct(form) {
    if (!activeBrand?.id) return;
    const name = form.name.value.trim();
    const price = Number(form.price.value || 0);
    const stock = clampInt(form.stock.value || 1, 0);
    const category = form.category.value.trim() || null;
    const subcategory = form.subcategory.value.trim() || null;
    if (!name) { alert("Nombre es obligatorio"); return; }
    if (price <= 0) { alert("Precio debe ser mayor a 0"); return; }

    setCreating(true);
    try {
      const payload = {
        brand_id: activeBrand.id,
        name, price, stock,
        category, subcategory,
        active: stock > 0, // si stock 0, lo dejamos inactivo
      };
      const { data: inserted, error } = await supabase
        .from("products")
        .insert(payload)
        .select("id")
        .maybeSingle();
      if (error) throw error;

      // subir imágenes si adjuntaron
      const files = Array.from(form.images?.files || []);
      if (files.length) {
        await uploadImagesForProduct(inserted.id, files.slice(0, MAX_IMAGES));
      }

      form.reset();
      setCreating(false);
      await loadProducts();
    } catch (e) {
      console.error(e);
      setCreating(false);
      alert(e.message || "No se pudo crear el producto");
    }
  }

  async function uploadImagesForProduct(productId, files) {
    // contamos actuales para no pasar los 5
    const current = products.find(p => p.id === productId)?.images || [];
    const remaining = Math.max(0, MAX_IMAGES - current.length);
    const toUpload = files.slice(0, remaining);
    if (!toUpload.length) { alert("Máximo 5 imágenes por producto."); return; }

    let inserts = [];
    for (let i = 0; i < toUpload.length; i++) {
      const file = toUpload[i];
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${activeBrand.id}/${productId}/${Date.now()}_${i}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: true, cacheControl: "3600", contentType: file.type || "image/jpeg"
      });
      if (upErr) { console.error(upErr); continue; }
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const url = pub?.publicUrl || null;
      if (url) inserts.push({ product_id: productId, url, position: (current.length + i) });
    }

    if (inserts.length) {
      const { error } = await supabase.from("product_images").insert(inserts);
      if (error) console.error(error);
    }
  }

  async function updateProduct(p, patch) {
    const next = { ...p, ...patch };
    // si stock 0 => active false
    if (typeof next.stock === "number" && next.stock <= 0) next.active = false;

    // Optimistic UI
    setProducts(arr => arr.map(x => x.id === p.id ? next : x));

    const payload = {
      name: next.name,
      price: next.price,
      stock: next.stock,
      category: next.category,
      subcategory: next.subcategory,
      active: next.active
    };
    const { error } = await supabase.from("products").update(payload).eq("id", p.id);
    if (error) {
      console.error(error);
      alert("No se pudo guardar. Se revertirá el cambio.");
      // revertir
      await loadProducts();
    }
  }

  async function deleteProduct(p) {
    if (!confirm(`Eliminar "${p.name}"? (soft delete)`)) return;
    // Optimistic
    const prev = products;
    setProducts(arr => arr.filter(x => x.id !== p.id));
    const { error } = await supabase.from("products").update({ deleted_at: nowIso(), active: false }).eq("id", p.id);
    if (error) {
      alert("No se pudo eliminar.");
      setProducts(prev);
    }
  }

  async function removeImage(pi) {
    if (!confirm("Quitar imagen?")) return;
    // tratamos de borrar de Storage si es URL pública de nuestro bucket
    try {
      const marker = `/storage/v1/object/public/${BUCKET}/`;
      if (pi.url.includes(marker)) {
        const path = pi.url.split(marker)[1];
        if (path) await supabase.storage.from(BUCKET).remove([path]);
      }
    } catch (_) {}
    const { error } = await supabase.from("product_images").delete().eq("id", pi.id);
    if (error) { console.error(error); alert("No se pudo quitar la imagen"); }
    await loadProducts();
  }

  // ---------- UI helpers ----------
  function ProductCard({ p }) {
    const [local, setLocal] = useState({
      name: p.name || "",
      price: p.price || 0,
      stock: typeof p.stock === "number" ? p.stock : 1,
      category: p.category || "",
      subcategory: p.subcategory || "",
      active: !!p.active
    });
    const fileRef = useRef(null);

    useEffect(() => {
      setLocal({
        name: p.name || "",
        price: p.price || 0,
        stock: typeof p.stock === "number" ? p.stock : 1,
        category: p.category || "",
        subcategory: p.subcategory || "",
        active: !!p.active
      });
    }, [p.id]);

    const cover = (p.images && p.images[0]?.url) || null;

    return (
      <div className="card" style={{ padding: 12 }}>
        {/* imagen cuadrada */}
        <div style={{
          width: "100%", aspectRatio: "1 / 1", borderRadius: 12, overflow: "hidden",
          border: "1px solid var(--border)", background: "#0d0f12", display: "grid", placeItems: "center"
        }}>
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ color: "#89a", fontSize: 12 }}>Sin imagen</div>
          )}
        </div>

        {/* mini tira de imágenes con borrar */}
        {p.images?.length ? (
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {p.images.map(pi => (
              <div key={pi.id} style={{ position: "relative" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pi.url} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
                {pi.id !== "legacy" && (
                  <button
                    className="btn btn-ghost"
                    style={{ position: "absolute", top: -8, right: -8, borderRadius: 999, padding: "2px 6px" }}
                    onClick={() => removeImage(pi)}
                    title="Quitar imagen"
                    aria-label="Quitar imagen"
                  >✕</button>
                )}
              </div>
            ))}
          </div>
        ) : null}

        {/* subir más imágenes */}
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }}
                 onChange={async (e)=>{ const files = Array.from(e.target.files||[]); if (files.length){ await uploadImagesForProduct(p.id, files); await loadProducts(); e.target.value=""; } }} />
          <button className="btn" onClick={()=>fileRef.current?.click()} disabled={(p.images?.length||0) >= MAX_IMAGES}>
            Agregar imagen{(p.images?.length||0) ? ` (${p.images.length}/${MAX_IMAGES})` : ""}
          </button>
        </div>

        {/* campos */}
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <input className="input" placeholder="Nombre" value={local.name} onChange={e=>setLocal(s=>({...s,name:e.target.value}))} />
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <div className="row" style={{ gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#9aa" }}>Precio</span>
            <input className="input" type="number" min="0" step="1" value={local.price}
                   onChange={e=>setLocal(s=>({...s,price: clampInt(e.target.value,0)}))}
                   style={{ width: 120 }} />
            <span style={{ fontSize: 12, color: "#9aa" }}>${currency(local.price)}</span>
          </div>
          <div className="row" style={{ gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#9aa" }}>Stock</span>
            <input className="input" type="number" min="0" step="1" value={local.stock}
                   onChange={e=>setLocal(s=>({...s,stock: clampInt(e.target.value,0)}))}
                   style={{ width: 96 }} />
          </div>
          <label className="row" style={{ gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={local.active} onChange={e=>setLocal(s=>({...s,active:e.target.checked}))} />
            <span style={{ fontSize: 12 }}>Activo</span>
          </label>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <input className="input" placeholder="Categoría (opcional)" value={local.category} onChange={e=>setLocal(s=>({...s,category:e.target.value}))} />
          <input className="input" placeholder="Subcategoría (opcional)" value={local.subcategory} onChange={e=>setLocal(s=>({...s,subcategory:e.target.value}))} />
        </div>

        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <button className="btn btn-primary" onClick={()=>updateProduct(p, local)}>Guardar</button>
          <button className="btn btn-ghost" onClick={()=>deleteProduct(p)}>Eliminar</button>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="container">
        <Head><title>Vendedor — CABURE.STORE</title></Head>
        <div className="status-empty">
          <p>Ingresá para ver tu panel.</p>
          <button className="btn btn-primary" onClick={() => supabase.auth.signInWithOAuth({ provider: "google" })}>
            Ingresar con Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingBottom: 56 }}>
      <Head><title>Vendedor — CABURE.STORE</title></Head>

      {/* Header */}
      <div className="row" style={{ alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Vendedor</h1>
        <div style={{ flex: 1 }} />
        {brands.length > 0 && (
          <select
            className="input"
            aria-label="Seleccionar marca"
            value={brandId || ""}
            onChange={(e) => setBrandId(e.target.value)}
            style={{ maxWidth: 320 }}
          >
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        {activeBrand?.slug && (
          <Link href={`/marcas/${encodeURIComponent(activeBrand.slug)}`} className="btn btn-ghost" style={{ marginLeft: 8 }}>
            Ver marca
          </Link>
        )}
      </div>

      {!activeBrand ? (
        <div className="card" style={{ marginTop: 12, padding: 16, border: "1px dashed var(--border)" }}>
          No tenés marcas asignadas todavía.
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="row" role="tablist" aria-label="Secciones del panel" style={{ gap: 8, marginTop: 12 }}>
            {TABS.map(t => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                className={`chip ${tab === t ? "chip--active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {/* CHATS */}
          {tab === "Chats" && (
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, alignItems: "start" }}>
              <section className="card" style={{ padding: 12 }}>
                <h2 style={{ marginTop: 0 }}>Chats</h2>
                {loadingThreads ? (
                  <div className="skeleton" style={{ marginTop: 12, height: 64, borderRadius: 10 }} />
                ) : threads.length === 0 ? (
                  <div className="card" style={{ marginTop: 12, padding: 12, border: "1px dashed var(--border)", color: "#9aa" }}>
                    No hay tickets por ahora.
                  </div>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0 0", display: "grid", gap: 8 }}>
                    {threads.map(t => {
                      const buyerName = buyerMap[t.user_id] || "Cliente";
                      const active = t.id === activeThreadId;
                      return (
                        <li key={t.id}>
                          <button
                            className="btn"
                            onClick={() => setActiveThreadId(t.id)}
                            aria-label={`Abrir chat con ${buyerName}`}
                            style={{
                              width: "100%",
                              justifyContent: "flex-start",
                              background: active ? "var(--brand)" : "var(--panel)",
                              color: active ? "#000" : "var(--text)",
                              border: "1px solid var(--border)"
                            }}
                          >
                            <div style={{ textAlign: "left" }}>
                              <div style={{ fontWeight: 600 }}>{buyerName}</div>
                              <div style={{ fontSize: 12, opacity: 0.8 }}>
                                {t.status === "open" ? "Abierto" : t.status} · {new Date(t.created_at).toLocaleString("es-AR", { hour12: false })}
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="card" style={{ padding: 12, minHeight: 520 }}>
                {!activeThreadId ? (
                  <div className="status-empty">Seleccioná un chat para comenzar.</div>
                ) : (
                  <ChatBox threadId={activeThreadId} />
                )}
              </section>
            </div>
          )}

          {/* CATALOGO */}
          {tab === "Catálogo" && (
            <section className="card" style={{ padding: 16, marginTop: 12 }}>
              <div className="row" style={{ alignItems: "center" }}>
                <h2 style={{ margin: 0 }}>Catálogo</h2>
                <div style={{ flex: 1 }} />
                <button className="btn btn-primary" onClick={()=>setCreating(c=>!c)}>
                  {creating ? "Cerrar" : "Nuevo producto"}
                </button>
              </div>

              {/* Crear */}
              {creating && (
                <form
                  onSubmit={async (e)=>{e.preventDefault(); await createProduct(e.currentTarget);}}
                  className="card"
                  style={{ padding: 12, marginTop: 12, border: "1px dashed var(--border)" }}
                >
                  <div className="row" style={{ gap: 8 }}>
                    <input className="input" name="name" placeholder="Nombre *" aria-label="Nombre" />
                    <input className="input" type="number" step="1" min="0" name="price" placeholder="Precio *" aria-label="Precio" style={{ width: 160 }} />
                    <input className="input" type="number" step="1" min="0" name="stock" defaultValue={1} placeholder="Stock" aria-label="Stock" style={{ width: 120 }} />
                  </div>
                  <div className="row" style={{ gap: 8, marginTop: 8 }}>
                    <input className="input" name="category" placeholder="Categoría (opcional)" />
                    <input className="input" name="subcategory" placeholder="Subcategoría (opcional)" />
                  </div>
                  <div className="row" style={{ gap: 8, marginTop: 8, alignItems: "center" }}>
                    <input type="file" name="images" accept="image/*" multiple />
                    <div style={{ fontSize: 12, color: "#9aa" }}>Hasta {MAX_IMAGES} imágenes. Se recomienda formato cuadrado.</div>
                  </div>
                  <div className="row" style={{ gap: 8, marginTop: 10 }}>
                    <button className="btn btn-primary" type="submit" disabled={creating}>Crear</button>
                    <button className="btn btn-ghost" type="button" onClick={()=>setCreating(false)}>Cancelar</button>
                  </div>
                </form>
              )}

              {/* Lista */}
              <div style={{
                marginTop: 12,
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))"
              }}>
                {loadingProducts ? (
                  <>
                    <div className="skeleton" style={{ height: 320, borderRadius: 14 }} />
                    <div className="skeleton" style={{ height: 320, borderRadius: 14 }} />
                    <div className="skeleton" style={{ height: 320, borderRadius: 14 }} />
                    <div className="skeleton" style={{ height: 320, borderRadius: 14 }} />
                  </>
                ) : products.length === 0 ? (
                  <div className="card" style={{ padding: 16, border: "1px dashed var(--border)" }}>
                    No hay productos aún.
                  </div>
                ) : (
                  products.map(p => <ProductCard key={p.id} p={p} />)
                )}
              </div>
            </section>
          )}

          {/* PEDIDOS (placeholder; tuvíste pedidos antes, podés reusar) */}
          {tab === "Pedidos" && (
            <section className="card" style={{ padding: 16, marginTop: 12 }}>
              <h2 style={{ marginTop: 0 }}>Pedidos</h2>
              <div style={{ color: "#9aa" }}>
                Acá va el listado de órdenes de la marca con detalle y acciones. (Si querés, lo armamos ya mismo sobre tu tabla <code>orders</code>.)
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
