import React, { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import VendorChatBox from "@/components/VendorChatBox";

function currency(n) { return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0); }

export default function VendorPage() {
  const [session, setSession] = useState(null);
  const [myRole, setMyRole] = useState(null);
  const [vendorBrands, setVendorBrands] = useState([]);
  const [brandId, setBrandId] = useState(null);

  // Tabs: catalog | orders | chats
  const [tab, setTab] = useState("catalog");

  // Catalog state
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [products, setProducts] = useState([]);
  const [addingOpen, setAddingOpen] = useState(false);
  const [savingId, setSavingId] = useState(null);

  // Orders state
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orders, setOrders] = useState([]);

  // Chats state
  const [threads, setThreads] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [activeThread, setActiveThread] = useState(null);
  const [profilesMap, setProfilesMap] = useState({}); // user_id -> email/name

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s || null);
    });
    return () => listener?.subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      // Role
      const { data: prof } = await supabase
        .from("profiles")
        .select("role,email")
        .eq("user_id", session.user.id)
        .maybeSingle();
      setMyRole(prof?.role || null);

      // Brands donde soy vendor o admin ve todas
      if (prof?.role === "admin") {
        const { data: bAll } = await supabase
          .from("brands")
          .select("id,name,slug")
          .eq("active", true)
          .is("deleted_at", null)
          .order("name");
        setVendorBrands(bAll || []);
        if (!brandId && (bAll?.length)) setBrandId(bAll[0].id);
      } else {
        // buscar mis marcas por brand_users
        const { data: bu } = await supabase
          .from("brand_users")
          .select("brand_id")
          .eq("user_id", session.user.id);
        const ids = (bu || []).map((r) => r.brand_id);
        if (ids.length) {
          const { data: bMine } = await supabase
            .from("brands")
            .select("id,name,slug")
            .in("id", ids)
            .eq("active", true)
            .is("deleted_at", null)
            .order("name");
          setVendorBrands(bMine || []);
          if (!brandId && (bMine?.length)) setBrandId(bMine[0].id);
        } else {
          setVendorBrands([]);
          setBrandId(null);
        }
      }
    })();
  }, [session?.user?.id]);

  // Load data per brand/tab
  useEffect(() => {
    if (!brandId) return;
    if (tab === "catalog") loadProducts();
    if (tab === "orders") loadOrders();
    if (tab === "chats") loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, tab]);

  async function loadProducts() {
    setLoadingProducts(true);
    const { data, error } = await supabase
      .from("products")
      .select("id,name,price,stock,active,image_url,category,subcategory,created_at,deleted_at")
      .eq("brand_id", brandId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setLoadingProducts(false);
    if (!error) setProducts(data || []);
  }

  async function loadOrders() {
    setLoadingOrders(true);
    const { data, error } = await supabase
      .from("orders")
      .select("id,buyer_id,total,status,payment_method,created_at")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false });
    setLoadingOrders(false);
    if (!error) setOrders(data || []);
  }

  async function loadThreads() {
    setLoadingThreads(true);
    const { data, error } = await supabase
      .from("vendor_threads")
      .select("id,user_id,status,created_at")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false });
    setLoadingThreads(false);
    if (!error) {
      setThreads(data || []);
      // mapear perfiles
      const uids = Array.from(new Set((data || []).map((t) => t.user_id)));
      if (uids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id,email")
          .in("user_id", uids);
        const map = {};
        (profs || []).forEach((p) => (map[p.user_id] = p.email));
        setProfilesMap(map);
      }
    }
  }

  // CSV export
  function exportOrdersCSV() {
    const rows = [
      ["order_id","created_at","buyer_id","total","payment_method","status"]
    ];
    (orders || []).forEach(o => {
      rows.push([o.id, o.created_at, o.buyer_id, String(o.total || 0), o.payment_method || "", o.status || ""]);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pedidos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function createOrUpdateProduct(e, product) {
    e?.preventDefault?.();
    setSavingId(product?.id || "new");

    try {
      const form = e?.target?.closest?.("form");
      const fd = form ? new FormData(form) : null;
      const payload = {
        name: fd ? (fd.get("name") || "").toString().trim() : (product?.name || ""),
        price: fd ? Number(fd.get("price") || 0) : Number(product?.price || 0),
        stock: fd ? Number(fd.get("stock") ?? 1) : Number(product?.stock ?? 1),
        category: fd ? (fd.get("category") || "").toString() : (product?.category || null),
        subcategory: fd ? (fd.get("subcategory") || "").toString() : (product?.subcategory || null),
        active: fd ? (fd.get("active") === "on") : !!product?.active
      };

      // Subida de imágenes (hasta 5). La primera se guarda en image_url.
      let files = fd ? fd.getAll("images") : [];
      files = files?.filter(Boolean) || [];
      let image_url = product?.image_url || null;
      const newImages = [];

      if (files.length) {
        for (let i = 0; i < Math.min(files.length, 5); i++) {
          const f = files[i];
          if (!(f instanceof File)) continue;
          const path = `${brandId}/${Date.now()}_${i}_${f.name.replace(/\s+/g, "_")}`;
          const { error: upErr } = await supabase.storage.from("product-images").upload(path, f, {
            cacheControl: "3600", upsert: false, contentType: f.type || "image/jpeg"
          });
          if (upErr) { alert("No se pudo subir una imagen."); continue; }
          const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
          const url = pub?.publicUrl;
          if (url) newImages.push(url);
        }
        if (newImages[0]) image_url = newImages[0];
      }

      if (!product?.id) {
        // Crear
        const { data: ins, error: insErr } = await supabase
          .from("products")
          .insert({
            brand_id: brandId,
            name: payload.name,
            price: payload.price,
            stock: Number.isFinite(payload.stock) ? payload.stock : 1,
            category: payload.category || null,
            subcategory: payload.subcategory || null,
            active: payload.active,
            image_url: image_url || null
          })
          .select("id")
          .maybeSingle();
        if (insErr) throw insErr;

        // Inserta imágenes extra (si existe tabla product_images)
        if (newImages.length > 0) {
          const rows = newImages.map((url, i) => ({ product_id: ins.id, url, position: i }));
          await supabase.from("product_images").insert(rows);
        }
      } else {
        // Editar
        const { error: updErr } = await supabase
          .from("products")
          .update({
            name: payload.name,
            price: payload.price,
            stock: Number.isFinite(payload.stock) ? payload.stock : 1,
            category: payload.category || null,
            subcategory: payload.subcategory || null,
            active: payload.active,
            image_url: image_url || product.image_url || null
          })
          .eq("id", product.id);
        if (updErr) throw updErr;

        if (newImages.length > 0) {
          const rows = newImages.map((url, i) => ({ product_id: product.id, url, position: i }));
          await supabase.from("product_images").insert(rows);
        }
      }

      setAddingOpen(false);
      await loadProducts();
      alert("Guardado ✅");
    } catch (err) {
      console.error(err);
      alert(err.message || "No se pudo guardar el producto");
    } finally {
      setSavingId(null);
    }
  }

  async function softDeleteProduct(p) {
    if (!confirm(`Eliminar "${p.name}"?`)) return;
    const { error } = await supabase
      .from("products")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", p.id);
    if (error) { alert("No se pudo eliminar"); return; }
    await loadProducts();
  }

  if (!session) {
    return (
      <div className="container">
        <Head><title>Vendor — CABURE.STORE</title></Head>
        <p>Iniciá sesión para continuar.</p>
      </div>
    );
  }

  // Guard de rol
  if (!myRole && vendorBrands.length === 0) {
    return (
      <div className="container">
        <Head><title>Vendor — CABURE.STORE</title></Head>
        <p>No tenés marcas asignadas. Pedile a un admin que te asigne.</p>
      </div>
    );
  }

  return (
    <div className="container">
      <Head><title>Vendor — CABURE.STORE</title></Head>

      <div className="row" style={{ alignItems:"center", gap:12 }}>
        <h1 style={{ margin:0 }}>Vendedor</h1>
        <div style={{ flex:1 }} />
        <select
          value={brandId || ""}
          onChange={(e) => setBrandId(e.target.value)}
          aria-label="Seleccionar marca"
          className="select"
        >
          {(vendorBrands || []).map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "catalog" ? "active" : ""}`} onClick={() => setTab("catalog")}>Catálogo</button>
        <button className={`tab ${tab === "orders" ? "active" : ""}`} onClick={() => setTab("orders")}>Pedidos</button>
        <button className={`tab ${tab === "chats" ? "active" : ""}`} onClick={() => setTab("chats")}>Chats</button>
      </div>

      {/* ===================== CATALOGO ===================== */}
      {tab === "catalog" && (
        <section className="card">
          <div className="row" style={{ alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Catálogo</h2>
            <div style={{ flex: 1 }} />
            <button className="btn" onClick={() => setAddingOpen(v => !v)}>{addingOpen ? "Cerrar" : "Nuevo producto"}</button>
          </div>

          {addingOpen && (
            <form className="grid form" onSubmit={(e) => createOrUpdateProduct(e, null)}>
              <input name="name" placeholder="Nombre" required />
              <input name="price" type="number" placeholder="Precio" min="0" step="1" required />
              <input name="stock" type="number" placeholder="Stock (predet. 1)" min="0" defaultValue="1" />
              <input name="category" placeholder="Categoría (opcional)" />
              <input name="subcategory" placeholder="Subcategoría (opcional)" />
              <label className="chk">
                <input type="checkbox" name="active" defaultChecked /> Activo
              </label>
              <div className="file">
                <label>Imágenes (hasta 5)</label>
                <input name="images" type="file" accept="image/*" multiple />
              </div>
              <div className="row" style={{ gap:8 }}>
                <button className="btn primary" type="submit" disabled={savingId === "new"}>{savingId === "new" ? "Guardando…" : "Guardar producto"}</button>
                <button className="btn ghost" type="button" onClick={() => setAddingOpen(false)}>Cancelar</button>
              </div>
            </form>
          )}

          {loadingProducts && <div className="skeleton" style={{ height: 60, marginTop: 12 }} />}

          <div className="grid products">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                p={p}
                onSave={(e) => createOrUpdateProduct(e, p)}
                onDelete={() => softDeleteProduct(p)}
              />
            ))}
          </div>

          {(!loadingProducts && products.length === 0) && (
            <div className="empty">No tenés productos aún. Creá el primero 👆</div>
          )}
        </section>
      )}

      {/* ===================== PEDIDOS ===================== */}
      {tab === "orders" && (
        <section className="card">
          <div className="row" style={{ alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Pedidos</h2>
            <div style={{ flex: 1 }} />
            <button className="btn" onClick={exportOrdersCSV}>Exportar CSV</button>
          </div>

          {loadingOrders && <div className="skeleton" style={{ height: 60, marginTop: 12 }} />}

          <div className="table">
            <div className="thead">
              <div>Fecha</div>
              <div>Pedido</div>
              <div>Cliente</div>
              <div>Método</div>
              <div>Total</div>
              <div>Estado</div>
            </div>
            {(orders || []).map(o => (
              <div key={o.id} className="trow">
                <div>{new Date(o.created_at).toLocaleString()}</div>
                <div>{o.id.slice(0,8)}…</div>
                <div>{o.buyer_id?.slice(0,8)}…</div>
                <div>{o.payment_method || "-"}</div>
                <div>{currency(o.total)}</div>
                <div>{o.status}</div>
              </div>
            ))}
            {!loadingOrders && orders.length === 0 && (
              <div className="empty">Sin pedidos todavía.</div>
            )}
          </div>
        </section>
      )}

      {/* ===================== CHATS ===================== */}
      {tab === "chats" && (
        <section className="card">
          <div className="row" style={{ alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Chats con clientes</h2>
            <div style={{ flex: 1 }} />
            <button className="btn" onClick={() => loadThreads()}>Actualizar</button>
          </div>

          {loadingThreads && <div className="skeleton" style={{ height: 60, marginTop: 12 }} />}

          <div className="grid2">
            <div className="threads">
              {(threads || []).map(t => (
                <button
                  key={t.id}
                  className={`thread ${activeThread === t.id ? "active" : ""}`}
                  onClick={() => setActiveThread(t.id)}
                >
                  <div className="title">{profilesMap[t.user_id] || t.user_id.slice(0,8)}</div>
                  <div className="meta">{t.status} · {new Date(t.created_at).toLocaleString()}</div>
                </button>
              ))}
              {!loadingThreads && threads.length === 0 && (
                <div className="empty">Sin hilos por ahora.</div>
              )}
            </div>
            <div className="box">
              {activeThread ? (
                <VendorChatBox threadId={activeThread} senderRole="vendor" />
              ) : (
                <div className="empty">Seleccioná un hilo a la izquierda</div>
              )}
            </div>
          </div>
        </section>
      )}

      <style jsx>{`
        .container { padding: 16px; }
        .row { display:flex; gap:10px; }
        .select { background:#0f0f0f; color:#fff; border:1px solid #2a2a2a; border-radius:10px; padding:8px 10px; }
        .tabs { display:flex; gap:8px; margin:12px 0; }
        .tab { background:#0f0f0f; color:#ddd; border:1px solid #2a2a2a; border-radius:12px; padding:8px 12px; cursor:pointer; }
        .tab.active { background:#171717; border-color:#3a3a3a; color:#fff; }

        .card { background:#0c0c0c; border:1px solid #1f1f1f; border-radius:16px; padding:12px; margin-top:10px; }
        .grid.form { display:grid; gap:10px; grid-template-columns: repeat(3, minmax(0,1fr)); margin-top:12px; }
        .grid.form .row { grid-column: 1 / -1; }
        .grid.products { display:grid; gap:12px; grid-template-columns: repeat(3, minmax(0,1fr)); margin-top:12px; }
        @media (max-width: 920px){ .grid.products { grid-template-columns: repeat(2, minmax(0,1fr)); } }
        @media (max-width: 540px){ .grid.products { grid-template-columns: 1fr; } }
        input, textarea { background:#0f0f0f; color:#fff; border:1px solid #2a2a2a; border-radius:10px; padding:10px 12px; }
        .file input { background:transparent; border:none; padding:0; }
        .chk { display:flex; align-items:center; gap:8px; color:#ddd; }

        .skeleton { background: linear-gradient(90deg, #0f0f0f, #151515, #0f0f0f); border-radius:12px; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%{opacity:.6} 50%{opacity:1} 100%{opacity:.6} }

        .table { margin-top:12px; }
        .thead, .trow { display:grid; grid-template-columns: 1.2fr 1fr 1fr 1fr .8fr .8fr; gap:8px; padding:10px; border-bottom:1px solid #1a1a1a; }
        .thead { font-weight:600; background:#0e0e0e; border-radius:10px; }
        .empty { padding:12px; border:1px dashed #2a2a2a; border-radius:12px; text-align:center; opacity:.85; margin-top:10px; }

        .grid2 { display:grid; grid-template-columns: 300px 1fr; gap:12px; margin-top:12px; }
        @media (max-width: 920px){ .grid2 { grid-template-columns: 1fr; } }
        .threads { background:#0a0a0a; border:1px solid #1a1a1a; border-radius:12px; padding:8px; display:grid; gap:6px; }
        .thread { text-align:left; background:#0f0f0f; border:1px solid #222; color:#ddd; border-radius:10px; padding:10px; cursor:pointer; }
        .thread.active { background:#171717; border-color:#3a3a3a; color:#fff; }
        .thread .title { font-weight:600; }
        .thread .meta { font-size:.85rem; opacity:.8; }
        .box { min-height: 50vh; }
        .btn { padding:10px 12px; border-radius:10px; border:1px solid #2a2a2a; background:#161616; color:#fff; cursor:pointer; }
        .btn.primary { background:#1e1e1e; border-color:#3a3a3a; }
        .btn.ghost { background:transparent; }
      `}</style>
    </div>
  );
}

function ProductCard({ p, onSave, onDelete }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="pcard">
      <div className="img">
        <Image
          src={p.image_url || "/cabure-logo.png"}
          alt={p.name}
          width={600}
          height={600}
          style={{ objectFit:"cover", width:"100%", height:"100%", borderRadius:12 }}
        />
      </div>
      <div className="body">
        <div className="row" style={{ alignItems:"center" }}>
          <b>{p.name}</b>
          <div style={{ marginLeft:"auto" }}>{currency(p.price)}</div>
        </div>
        <div className="row" style={{ gap:8 }}>
          <span style={{ opacity:.85 }}>Stock: {Number.isFinite(p.stock) ? p.stock : "-"}</span>
          <span style={{ opacity:.85 }}>Estado: {p.active ? "Activo" : "Inactivo"}</span>
        </div>
        <div className="row" style={{ gap:8 }}>
          <button className="btn" onClick={() => setOpen(v => !v)}>{open ? "Cerrar" : "Editar"}</button>
          <button className="btn ghost" onClick={onDelete}>Eliminar</button>
        </div>
        {open && (
          <form className="grid form" onSubmit={onSave}>
            <input name="name" defaultValue={p.name} placeholder="Nombre" required />
            <input name="price" type="number" defaultValue={p.price || 0} min="0" step="1" required />
            <input name="stock" type="number" defaultValue={Number.isFinite(p.stock) ? p.stock : 1} min="0" />
            <input name="category" defaultValue={p.category || ""} placeholder="Categoría (opcional)" />
            <input name="subcategory" defaultValue={p.subcategory || ""} placeholder="Subcategoría (opcional)" />
            <label className="chk">
              <input type="checkbox" name="active" defaultChecked={!!p.active} /> Activo
            </label>
            <div className="file">
              <label>Nuevas imágenes (hasta 5)</label>
              <input name="images" type="file" accept="image/*" multiple />
            </div>
            <div className="row" style={{ gap:8 }}>
              <button className="btn primary" type="submit">Guardar</button>
            </div>
          </form>
        )}
      </div>

      <style jsx>{`
        .pcard { background:#0c0c0c; border:1px solid #1f1f1f; border-radius:16px; overflow:hidden; }
        .img { width:100%; aspect-ratio:1/1; background:#0a0a0a; }
        .body { padding:10px; display:grid; gap:8px; }
        .grid.form { display:grid; gap:10px; grid-template-columns: repeat(3, minmax(0,1fr)); margin-top:8px; }
        .btn { padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#161616; color:#fff; cursor:pointer; }
        .btn.ghost { background:transparent; }
        input { background:#0f0f0f; color:#fff; border:1px solid #2a2a2a; border-radius:10px; padding:8px 10px; }
        .file input { background:transparent; border:none; padding:0; }
        .chk { display:flex; align-items:center; gap:8px; color:#ddd; }
      `}</style>
    </div>
  );
}
