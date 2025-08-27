// pages/vendor/index.jsx
/* Panel de Vendedor — CRUD catálogo + Chat de vendedores + Métricas
   Requisitos previos (SQL ya compartido anteriormente):
   - Tabla products con columnas: id, brand_id, name, price, active, stock int, image_url text, images text[], category text, subcategory text, deleted_at
   - Tablas de chat de vendedores:
     vendor_threads(id uuid pk, brand_id uuid fk, buyer_id uuid fk, status text default 'open', created_at, updated_at)
     vendor_messages(id bigserial pk, thread_id uuid fk, sender_role text check in ('buyer','vendor','admin'), message text, created_at)
   - Tablas de pedidos: orders, order_items (ya existentes)
*/

import React, { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import { supabase } from "@/lib/supabaseClient";

// ---------- Utils ----------
function toPublicURL(input) {
  if (!input) return null;
  const v = String(input).trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  if (!base) return null;
  const clean = v.replace(/^\/+/, "");
  if (clean.startsWith("product-images/") || clean.startsWith("brand-logos/")) {
    return `${base}/storage/v1/object/public/${clean}`;
  }
  // por defecto asumimos product-images/
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

function formatCurrency(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

function firstOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

// ---------- Página ----------
export default function VendorPage() {
  // auth/profile
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  // marcas y selección
  const [brands, setBrands] = useState([]);
  const [activeBrandId, setActiveBrandId] = useState("");

  // productos
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // chat vendor
  const [threads, setThreads] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [openThreadId, setOpenThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sendingMsg, setSendingMsg] = useState(false);
  const msgRef = useRef(null);

  // métricas
  const [metrics, setMetrics] = useState({ totalOrders: 0, sumTotal: 0, list: [] });
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // ---- Auth load ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id,email,role")
        .eq("user_id", session.user.id)
        .maybeSingle();
      setProfile(data || null);
    })();
  }, [session?.user?.id]);

  // ---- Cargar marcas (admin: todas / vendor: asignadas) ----
  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      const isAdmin = profile?.role === "admin";
      if (isAdmin) {
        const { data } = await supabase
          .from("brands")
          .select("id,name,slug,deleted_at")
          .is("deleted_at", null)
          .order("name", { ascending: true });
        setBrands(data || []);
        if (!activeBrandId && data?.[0]?.id) setActiveBrandId(data[0].id);
      } else {
        const { data } = await supabase
          .from("brand_users")
          .select("brand_id, brands(id,name,slug,deleted_at)")
          .eq("user_id", session.user.id);
        const mapped = (data || [])
          .map((x) => x.brands)
          .filter(Boolean)
          .filter((b) => b.deleted_at == null);
        setBrands(mapped);
        if (!activeBrandId && mapped?.[0]?.id) setActiveBrandId(mapped[0].id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, profile?.role]);

  // ---- Cargar productos de la marca seleccionada ----
  useEffect(() => {
    if (!activeBrandId) return;
    (async () => {
      setLoadingProducts(true);
      const { data, error } = await supabase
        .from("products")
        .select("id,brand_id,name,price,active,stock,image_url,images,category,subcategory,deleted_at,created_at")
        .eq("brand_id", activeBrandId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      setLoadingProducts(false);
      if (!error) {
        setProducts(
          (data || []).map((p) => ({
            ...p,
            _imagesRaw: normalizeImages(p.images, p.image_url), // paths
          }))
        );
      }
    })();
  }, [activeBrandId]);

  // ---- CRUD helpers de producto ----
  async function updateProductField(productId, patch) {
    const { error } = await supabase.from("products").update(patch).eq("id", productId);
    if (error) throw error;
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, ...patch } : p)));
  }

  function canAddMore(imagesArr) {
    const count = Array.isArray(imagesArr) ? imagesArr.length : 0;
    return count < 5;
  }

  async function handleUploadImage(p, file) {
    if (!file || !p?.id || !activeBrandId) return;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const rel = `${activeBrandId}/${p.id}/${Date.now()}.${ext}`; // ruta dentro del bucket
    const { error: upErr } = await supabase.storage.from("product-images").upload(rel, file, {
      upsert: false,
      cacheControl: "3600",
    });
    if (upErr) {
      alert("No se pudo subir la imagen.");
      return;
    }
    const nextArr = [...(p._imagesRaw || []), `product-images/${rel}`].slice(0, 5);
    const { error: updErr } = await supabase.from("products").update({ images: nextArr }).eq("id", p.id);
    if (updErr) {
      alert("No se pudo actualizar las imágenes.");
      return;
    }
    setProducts((prev) => prev.map((it) => (it.id === p.id ? { ...it, _imagesRaw: nextArr } : it)));
  }

  async function handleRemoveImage(p, imgPath) {
    if (!p?.id || !imgPath) return;
    const nextArr = (p._imagesRaw || []).filter((x) => x !== imgPath);
    const { error } = await supabase.from("products").update({ images: nextArr }).eq("id", p.id);
    if (error) {
      alert("No se pudo eliminar la imagen.");
      return;
    }
    setProducts((prev) => prev.map((it) => (it.id === p.id ? { ...it, _imagesRaw: nextArr } : it)));
  }

  // ---------- CHAT DE VENDEDORES ----------
  // Lista de hilos
  useEffect(() => {
    if (!activeBrandId) return;
    (async () => {
      setLoadingThreads(true);
      // trae los hilos de la marca; el admin también puede verlos
      const { data, error } = await supabase
        .from("vendor_threads")
        .select("id, brand_id, buyer_id, status, created_at, updated_at")
        .eq("brand_id", activeBrandId)
        .order("updated_at", { ascending: false });
      setLoadingThreads(false);
      if (!error) setThreads(data || []);
    })();
  }, [activeBrandId]);

  // Mensajes del hilo abierto
  useEffect(() => {
    if (!openThreadId) { setMessages([]); return; }
    let channel = null;
    (async () => {
      const { data, error } = await supabase
        .from("vendor_messages")
        .select("id,thread_id,sender_role,message,created_at")
        .eq("thread_id", openThreadId)
        .order("created_at", { ascending: true });
      if (!error) setMessages(data || []);

      // Realtime si está habilitado
      try {
        channel = supabase
          .channel(`vm_${openThreadId}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "vendor_messages", filter: `thread_id=eq.${openThreadId}` },
            (payload) => {
              setMessages((prev) => [...prev, payload.new]);
            }
          )
          .subscribe();
      } catch {}
    })();
    return () => { try { channel && supabase.removeChannel(channel); } catch {} };
  }, [openThreadId]);

  async function sendMessage() {
    const txt = (msgRef.current?.value || "").trim();
    if (!txt || !openThreadId) return;
    setSendingMsg(true);
    const role = profile?.role === "admin" ? "admin" : "vendor";
    const { error } = await supabase
      .from("vendor_messages")
      .insert({ thread_id: openThreadId, sender_role: role, message: txt });
    setSendingMsg(false);
    if (!error) {
      msgRef.current.value = "";
    }
  }

  async function closeThread(id) {
    await supabase.from("vendor_threads").update({ status: "closed" }).eq("id", id);
    setThreads((t) => t.map((x) => (x.id === id ? { ...x, status: "closed" } : x)));
  }

  // ---------- MÉTRICAS ----------
  useEffect(() => {
    if (!activeBrandId) return;
    (async () => {
      setLoadingMetrics(true);
      const from = firstOfMonthISO();
      // KPIs del mes actual
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, total, status, payment_method, created_at, buyer_id")
        .eq("brand_id", activeBrandId)
        .gte("created_at", from)
        .order("created_at", { ascending: false });
      setLoadingMetrics(false);
      if (!error) {
        const sumTotal = (orders || []).reduce((acc, o) => acc + Number(o.total || 0), 0);
        setMetrics({ totalOrders: (orders || []).length, sumTotal, list: orders || [] });
      }
    })();
  }, [activeBrandId]);

  // ---------- UI ----------
  const isAdmin = profile?.role === "admin";

  return (
    <div className="container">
      <Head><title>Vendedor — CABURE.STORE</title></Head>
      <h1 style={{ margin: 0, marginBottom: 12 }}>Vendedor</h1>

      {/* Selector de Marca */}
      <section className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <label htmlFor="brandSel">Marca</label>
          <select
            id="brandSel"
            className="sel"
            value={activeBrandId || ""}
            onChange={(e) => setActiveBrandId(e.target.value)}
          >
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </section>

      {/* Catálogo (CRUD) */}
      <section className="card" style={{ padding: 16, marginBottom: 12 }}>
        <h2 style={{ marginTop: 0 }}>Catálogo</h2>
        {loadingProducts && <div className="skeleton" style={{ height: 80 }} />}
        {!loadingProducts && products.length === 0 && (
          <div className="empty">No hay productos aún.</div>
        )}
        {!loadingProducts && products.length > 0 && (
          <div className="grid">
            {products.map((p) => (
              <div key={p.id} className="pCard">
                <div className="thumb">
                  <img
                    src={toPublicURL((p._imagesRaw && p._imagesRaw[0]) || p.image_url) || "/placeholder.png"}
                    alt={p.name || "producto"}
                  />
                </div>

                {/* Nombre */}
                <div className="row g6">
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

                {/* Precio */}
                <div className="row g6">
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

                {/* Stock */}
                <div className="row g6">
                  <label className="lab">Stock</label>
                  <input
                    className="inp"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={typeof p.stock === "number" ? p.stock : 1}
                    onBlur={async (e) => {
                      const val = Math.max(0, parseInt(e.target.value || "0", 10));
                      if (val !== p.stock) await updateProductField(p.id, { stock: val });
                    }}
                  />
                </div>

                {/* Activo */}
                <div className="row g6" style={{ alignItems: "center" }}>
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

                {/* Categoría */}
                <div className="row g6">
                  <label className="lab">Categoría</label>
                  <input
                    className="inp"
                    placeholder="Ej: Campera, Remera, ..."
                    defaultValue={p.category || ""}
                    onBlur={async (e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== (p.category || null)) await updateProductField(p.id, { category: v });
                    }}
                  />
                </div>

                {/* Subcategoría */}
                <div className="row g6">
                  <label className="lab">Subcat.</label>
                  <input
                    className="inp"
                    placeholder="Ej: Oversize, Unisex, ..."
                    defaultValue={p.subcategory || ""}
                    onBlur={async (e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== (p.subcategory || null)) await updateProductField(p.id, { subcategory: v });
                    }}
                  />
                </div>

                {/* Imágenes */}
                <div className="imgsBlock">
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <strong>Imágenes ({Math.min((p._imagesRaw || []).length, 5)}/5)</strong>
                    <Uploader disabled={!canAddMore(p._imagesRaw)} onPick={(file) => handleUploadImage(p, file)} />
                  </div>
                  <div className="thumbs">
                    {(p._imagesRaw || []).slice(0, 5).map((img) => (
                      <div key={img} className="mini">
                        <img src={toPublicURL(img)} alt="product" />
                        <button className="del" title="Eliminar" onClick={() => handleRemoveImage(p, img)}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Chat de vendedores */}
      <section className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div className="row" style={{ alignItems: "center", gap: 8 }}>
          <h2 style={{ margin: 0 }}>Chats con clientes</h2>
          <span className="hint">— solo hilos de esta marca</span>
        </div>

        {loadingThreads && <div className="skeleton" style={{ height: 60 }} />}
        {!loadingThreads && threads.length === 0 && (
          <div className="empty">No hay hilos todavía.</div>
        )}

        {!loadingThreads && threads.length > 0 && (
          <div className="threads">
            <aside className="tlist">
              {threads.map((t) => (
                <button
                  key={t.id}
                  className={`titem ${openThreadId === t.id ? "titem--active" : ""}`}
                  onClick={() => setOpenThreadId(t.id)}
                >
                  <div className="trow">
                    <strong>{t.id.slice(0, 8)}</strong>
                    <span className={`badge ${t.status === "open" ? "ok" : "muted"}`}>{t.status}</span>
                  </div>
                  <div className="tsub">
                    {new Date(t.updated_at || t.created_at).toLocaleString("es-AR")}
                  </div>
                </button>
              ))}
            </aside>

            <div className="tchat">
              {!openThreadId ? (
                <div className="empty">Elegí un hilo para chatear.</div>
              ) : (
                <>
                  <div className="chatbox" role="log" aria-live="polite">
                    {messages.map((m) => (
                      <div key={m.id} className={`bubble ${m.sender_role === "buyer" ? "left" : "right"}`}>
                        <div className="meta">{m.sender_role}</div>
                        <div className="text">{m.message}</div>
                        <div className="time">{new Date(m.created_at).toLocaleString("es-AR")}</div>
                      </div>
                    ))}
                  </div>
                  <div className="sendrow">
                    <input ref={msgRef} className="inp" placeholder="Escribí un mensaje…" />
                    <button className="btn" disabled={sendingMsg} onClick={sendMessage}>Enviar</button>
                    <div style={{ flex: 1 }} />
                    <button className="btn ghost" onClick={() => closeThread(openThreadId)}>Cerrar hilo</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Métricas */}
      <section className="card" style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Métricas (mes actual)</h2>
        {loadingMetrics && <div className="skeleton" style={{ height: 60 }} />}

        {!loadingMetrics && (
          <>
            <div className="kpis">
              <div className="kpi">
                <div className="kval">{metrics.totalOrders}</div>
                <div className="klabel">Pedidos</div>
              </div>
              <div className="kpi">
                <div className="kval">{formatCurrency(metrics.sumTotal)}</div>
                <div className="klabel">Total vendido</div>
              </div>
            </div>

            <div className="tableWrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Pedido</th>
                    <th>Estado</th>
                    <th>Método</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(metrics.list || []).map((o) => (
                    <tr key={o.id}>
                      <td>{new Date(o.created_at).toLocaleString("es-AR")}</td>
                      <td>{o.id.slice(0, 8)}</td>
                      <td>{o.status}</td>
                      <td>{o.payment_method || "-"}</td>
                      <td style={{ textAlign: "right" }}>{formatCurrency(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <style jsx>{`
        .container { padding: 16px; }
        .row { display:flex; }
        .card { border:1px solid #1a1a1a; border-radius:14px; background:#0a0a0a; }
        .sel, .inp {
          padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#0f0f0f; color:#fff;
        }
        .skeleton { background:linear-gradient(90deg,#0f0f0f,#151515,#0f0f0f); animation:pulse 1.5s infinite; border-radius:10px; }
        @keyframes pulse { 0%{opacity:.6} 50%{opacity:1} 100%{opacity:.6} }
        .empty { padding:12px; border:1px dashed #2a2a2a; border-radius:12px; text-align:center; opacity:.9; }

        /* Grid de productos */
        .grid { display:grid; gap:16px; grid-template-columns: repeat(3, 1fr); }
        @media (max-width: 1100px){ .grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px){ .grid { grid-template-columns: 1fr; } }

        .pCard { border:1px solid #1a1a1a; border-radius:12px; background:#0f0f0f; padding:12px; display:grid; gap:8px; }
        .thumb { width:100%; aspect-ratio:1/1; background:#0a0a0a; border:1px solid #1a1a1a; border-radius:10px; overflow:hidden; }
        .thumb img { width:100%; height:100%; object-fit:cover; display:block; }
        .lab { width:100px; font-size:.9rem; opacity:.85; }
        .g6 { gap:6px; align-items:center; }
        .imgsBlock { margin-top:8px; border-top:1px dashed #222; padding-top:8px; display:grid; gap:8px; }
        .thumbs { display:flex; gap:8px; flex-wrap:wrap; }
        .mini { position:relative; width:88px; height:88px; border:1px solid #222; border-radius:10px; overflow:hidden; background:#0a0a0a; }
        .mini img { width:100%; height:100%; object-fit:cover; display:block; }
        .del { position:absolute; top:4px; right:4px; width:22px; height:22px; border-radius:999px; background:#111; color:#fff; border:1px solid #333; cursor:pointer; }

        .btn { padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#161616; color:#fff; cursor:pointer; }
        .btn.ghost { background:#0f0f0f; }

        .hint { opacity:.7; }

        /* Threads */
        .threads { display:grid; grid-template-columns: 280px 1fr; gap:12px; margin-top:8px; }
        @media (max-width: 900px){ .threads { grid-template-columns: 1fr; } }

        .tlist { display:grid; gap:8px; }
        .titem { text-align:left; border:1px solid #222; border-radius:10px; padding:10px; background:#0f0f0f; color:#fff; cursor:pointer; }
        .titem--active { border-color:#333; background:#141414; }
        .trow { display:flex; gap:8px; align-items:center; }
        .badge { padding:2px 8px; border-radius:999px; border:1px solid #333; font-size:.8rem; }
        .badge.ok { background:#102012; color:#c6f6d5; border-color:#1f3f26; }
        .badge.muted { opacity:.7; }
        .tsub { opacity:.75; font-size:.9rem; margin-top:4px; }

        .tchat { border:1px solid #222; border-radius:12px; padding:10px; background:#0f0f0f; min-height:260px; display:flex; flex-direction:column; }
        .chatbox { flex:1; display:flex; flex-direction:column; gap:8px; overflow:auto; padding-right:4px; }
        .bubble { max-width:70%; padding:8px 10px; border-radius:12px; border:1px solid #2a2a2a; }
        .bubble.left { align-self:flex-start; background:#0d0d0d; }
        .bubble.right { align-self:flex-end; background:#151515; }
        .meta { font-size:.8rem; opacity:.7; margin-bottom:4px; }
        .text { white-space:pre-wrap; }
        .time { font-size:.75rem; opacity:.6; margin-top:4px; }
        .sendrow { display:flex; gap:8px; align-items:center; margin-top:8px; }

        /* Métricas */
        .kpis { display:grid; grid-template-columns: repeat(2, 1fr); gap:12px; margin-bottom:12px; }
        .kpi { border:1px solid #222; border-radius:12px; padding:12px; background:#0f0f0f; }
        .kval { font-size:1.4rem; font-weight:700; }
        .klabel { opacity:.8; }
        .tableWrap { overflow:auto; }
        .tbl { width:100%; border-collapse:collapse; }
        .tbl th, .tbl td { border-bottom:1px solid #1e1e1e; padding:8px; text-align:left; }
      `}</style>
    </div>
  );
}

// Subcomponente para subir imagen
function Uploader({ disabled, onPick }) {
  const ref = useRef(null);
  return (
    <>
      <button className="btn" disabled={disabled} onClick={() => ref.current?.click()}>
        Subir imagen
      </button>
      <input
        ref={ref}
        type="file"
        hidden
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          onPick?.(f);
          e.target.value = "";
        }}
      />
      <style jsx>{`
        .btn { padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#161616; color:#fff; cursor:pointer; }
      `}</style>
    </>
  );
}
