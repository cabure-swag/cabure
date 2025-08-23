// pages/vendor/index.jsx
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";

const fmtMoney = (n) => `$ ${Number(n || 0).toLocaleString("es-AR")}`;
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString("es-AR") : "—");
const CATS = ["Remera","Pantalon","Buzo","Campera","Gorra","Otros"];

function VendorInner() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [brands, setBrands] = useState(null);
  const [brandId, setBrandId] = useState(null);
  const [uiError, setUiError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!alive) return;
        const s = data?.session ?? null;
        setSession(s);
        if (s?.user?.id) {
          const { data: prof } = await supabase.from("profiles").select("role").eq("user_id", s.user.id).maybeSingle();
          setRole(prof?.role ?? null);
        } else setRole(null);
      } catch (e) {
        setUiError("No se pudo cargar la sesión.");
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      (async () => {
        if (s?.user?.id) {
          const { data: prof } = await supabase.from("profiles").select("role").eq("user_id", s.user.id).maybeSingle();
          setRole(prof?.role ?? null);
        } else setRole(null);
      })();
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      try {
        setUiError("");
        const { data: links, error: e1 } = await supabase.from("brand_users").select("brand_id").eq("user_id", session.user.id);
        if (e1) throw e1;
        const ids = (links || []).map((l) => l.brand_id);

        let q = supabase.from("brands").select("id,name,slug,description,instagram_url,logo_url,color,active,deleted_at").order("name");
        if (role !== "admin") {
          if (!ids.length) { setBrands([]); return; }
          q = q.in("id", ids);
        }
        const { data, error } = await q;
        if (error) throw error;
        const list = data || [];
        setBrands(list);
        if (!brandId && list.length) setBrandId(list[0].id);
      } catch (e) {
        console.error(e);
        setBrands([]);
        setUiError(e.message || "No se pudieron cargar marcas.");
      }
    })();
  }, [session?.user?.id, role]);

  if (!session) {
    return (
      <div className="container">
        <Head><title>Vendor — CABURE.STORE</title></Head>
        <div className="card" style={{ padding: 24 }}>
          <h2>Panel de Vendedor</h2>
          <p>Necesitás iniciar sesión.</p>
          <Link href="/soporte" className="btn">Iniciar sesión</Link>
        </div>
      </div>
    );
  }
  if (role !== "vendor" && role !== "admin") {
    return (
      <div className="container">
        <Head><title>Vendor — CABURE.STORE</title></Head>
        <div className="card" style={{ padding: 24 }}>
          <h2>Sin permiso</h2>
          <p>Tu usuario no tiene rol de vendedor.</p>
          <Link href="/" className="btn">Volver</Link>
        </div>
      </div>
    );
  }

  const currentBrand = useMemo(() => (brands || []).find((b) => b.id === brandId) || null, [brands, brandId]);

  return (
    <div className="container">
      <Head>
        <title>Vendor — CABURE.STORE</title>
        <meta name="robots" content="noindex" />
      </Head>

      <h1>Panel de Vendedor</h1>
      {uiError ? <div className="card" style={{ padding: 12, border: "1px solid #a33" }}>{uiError}</div> : null}

      {!brands ? (
        <div className="skel" style={{ height: 160, borderRadius: 12 }} />
      ) : brands.length === 0 ? (
        <div className="card" style={{ padding: 16 }}>No tenés marcas asignadas todavía.</div>
      ) : (
        <>
          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <label className="input-label">Marca</label>
            <select className="input" value={brandId || ""} onChange={(e) => setBrandId(e.target.value)} aria-label="Seleccionar marca">
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name} — /marcas/{b.slug}</option>
              ))}
            </select>
          </div>

          {currentBrand ? (
            <>
              <BrandProfileEditor b={currentBrand} />
              <ProductCrud brand={currentBrand} />
              <BrandOrders brand={currentBrand} />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function BrandProfileEditor({ b }) {
  const [saving, setSaving] = useState(false);
  async function update(partial) {
    try {
      setSaving(true);
      const { error } = await supabase.from("brands").update(partial).eq("id", b.id);
      if (error) throw error;
    } catch (e) {
      alert(e.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }
  async function handleLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setSaving(true);
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${b.id}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("brand-logos").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/png",
      });
      if (up.error) throw up.error;
      const { data } = supabase.storage.from("brand-logos").getPublicUrl(path);
      await update({ logo_url: data?.publicUrl || null });
    } catch (e2) {
      alert(e2.message || "No se pudo subir el logo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card" style={{ padding: 16, marginBottom: 12 }}>
      <h2 style={{ marginTop: 0 }}>Perfil de {b.name}</h2>
      <div className="grid grid-2" style={{ gap: 8 }}>
        <div>
          <label className="input-label">Descripción</label>
          <textarea className="input" rows={3} defaultValue={b.description || ""} onBlur={(e) => update({ description: e.target.value })} />
        </div>
        <div>
          <label className="input-label">Instagram (URL)</label>
          <input className="input" type="url" defaultValue={b.instagram_url || ""} onBlur={(e) => update({ instagram_url: e.target.value || null })} />
          <label className="input-label" style={{ marginTop: 8 }}>Logo</label>
          <input type="file" className="input" accept="image/*" onChange={handleLogo} disabled={saving} />
        </div>
      </div>
      {saving ? <div className="badge" style={{ marginTop: 8 }}>Guardando…</div> : null}
    </section>
  );
}

/** ===== CRUD de productos (idéntico al anterior) ===== */
function ProductCrud({ brand }) {
  const [products, setProducts] = useState(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [creating, setCreating] = useState(false);

  async function loadProducts() {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,price,image_url,category,subcategory,active,deleted_at,created_at")
        .eq("brand_id", brand.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setProducts(data || []);
    } catch (e) {
      setProducts([]);
      console.error(e);
    }
  }
  useEffect(() => { loadProducts(); }, [brand.id]);

  const list = useMemo(() => {
    if (!products) return null;
    let arr = products;
    if (cat) arr = arr.filter((p) => (p.subcategory || p.category || "").toLowerCase() === cat.toLowerCase());
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      arr = arr.filter((p) => (p.name || "").toLowerCase().includes(t));
    }
    return arr;
  }, [products, q, cat]);

  async function uploadImage(file) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${brand.id}/${Date.now()}.${ext}`;
    const up = await supabase.storage.from("product-images").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/png",
    });
    if (up.error) throw up.error;
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data?.publicUrl || null;
  }

  async function createProduct(e) {
    e.preventDefault();
    try {
      setCreating(true);
      const form = new FormData(e.currentTarget);
      const payload = {
        brand_id: brand.id,
        name: (form.get("name") || "").toString().trim(),
        price: Number(form.get("price") || 0),
        category: (form.get("category") || "").toString().trim() || null,
        subcategory: (form.get("subcategory") || "").toString().trim() || null,
        active: true,
      };
      if (!payload.name) { alert("Nombre requerido"); return; }
      const file = form.get("image");
      if (file && file.size) payload.image_url = await uploadImage(file);
      const { error } = await supabase.from("products").insert(payload);
      if (error) throw error;
      e.currentTarget.reset();
      await loadProducts();
      alert("Producto creado");
    } catch (e2) {
      alert(e2.message || "No se pudo crear el producto.");
    } finally {
      setCreating(false);
    }
  }

  async function saveProduct(p, partial) {
    try {
      setSavingId(p.id);
      const { error } = await supabase.from("products").update(partial).eq("id", p.id);
      if (error) throw error;
      await loadProducts();
    } catch (e) {
      alert(e.message || "No se pudo guardar");
    } finally {
      setSavingId(null);
    }
  }

  async function handleUploadImage(p, file) {
    try {
      setSavingId(p.id);
      const publicUrl = await uploadImage(file);
      await saveProduct(p, { image_url: publicUrl });
    } catch (e) {
      alert(e.message || "No se pudo subir la imagen");
      setSavingId(null);
    }
  }

  async function softDelete(p) {
    if (!confirm(`¿Eliminar (soft) el producto “${p.name}”?`)) return;
    try {
      const { error } = await supabase
        .from("products")
        .update({ deleted_at: new Date().toISOString(), active: false })
        .eq("id", p.id);
      if (error) throw error;
      await loadProducts();
    } catch (e) {
      alert(e.message || "No se pudo eliminar");
    }
  }

  async function restore(p) {
    try {
      const { error } = await supabase
        .from("products")
        .update({ deleted_at: null })
        .eq("id", p.id);
      if (error) throw error;
      await loadProducts();
    } catch (e) {
      alert(e.message || "No se pudo restaurar");
    }
  }

  return (
    <section className="card" style={{ padding: 16, marginBottom: 12 }}>
      <div className="row" style={{ alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Catálogo</h2>
        <div style={{ flex: 1 }} />
        <Link href={`/marcas/${brand.slug}`} className="btn ghost" target="_blank">Ver público</Link>
      </div>

      <form onSubmit={createProduct} className="grid grid-3" style={{ gap: 8, marginTop: 8 }}>
        <input name="name" className="input" placeholder="Nombre *" />
        <input name="price" className="input" type="number" step="0.01" placeholder="Precio *" />
        <select name="subcategory" className="input" defaultValue="">
          <option value="">Subcategoría (opcional)</option>
          {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input name="category" className="input" placeholder="Categoría (opcional)" />
        <input name="image" className="input" type="file" accept="image/*" />
        <div style={{ gridColumn: "1 / -1", textAlign: "right" }}>
          <button className="btn" type="submit" disabled={creating}>Crear</button>
        </div>
      </form>

      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <select className="input" value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: 220 }}>
          <option value="">Todas las subcategorías</option>
          {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className="input" placeholder="Buscar por nombre" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="card" style={{ marginTop: 8, padding: 0, overflowX: "auto" }}>
        {!list ? (
          <div className="skel" style={{ height: 160 }} />
        ) : list.length === 0 ? (
          <div style={{ padding: 16 }}>No hay productos.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Img</th>
                <th>Nombre</th>
                <th>Subcat</th>
                <th>Precio</th>
                <th>Activo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ width: 56, height: 56, position: "relative", overflow: "hidden", borderRadius: 8, background: "#0E1012" }}>
                      {p.image_url && <Image src={p.image_url} alt={p.name} fill sizes="56px" style={{ objectFit: "cover" }} unoptimized />}
                    </div>
                  </td>
                  <td>
                    <input className="input" defaultValue={p.name} onBlur={(e) => saveProduct(p, { name: e.target.value })} />
                  </td>
                  <td>
                    <select className="input" defaultValue={p.subcategory || ""} onChange={(e) => saveProduct(p, { subcategory: e.target.value || null })}>
                      <option value="">—</option>
                      {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td>
                    <input className="input" type="number" step="0.01" defaultValue={p.price ?? 0} onBlur={(e) => saveProduct(p, { price: Number(e.target.value || 0) })} />
                  </td>
                  <td>
                    <label className="chip">
                      <input type="checkbox" checked={!!p.active} onChange={() => saveProduct(p, { active: !p.active })} /> activo
                    </label>
                  </td>
                  <td>{p.deleted_at ? "Eliminado" : "OK"}</td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <label className="btn ghost" style={{ cursor: "pointer" }}>
                      Cambiar imagen
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && handleUploadImage(p, e.target.files[0])} />
                    </label>
                    {!p.deleted_at ? (
                      <button className="btn danger" onClick={() => softDelete(p)}>Eliminar</button>
                    ) : (
                      <button className="btn" onClick={() => restore(p)}>Restaurar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {savingId ? <div className="badge" style={{ marginTop: 8 }}>Guardando…</div> : null}
    </section>
  );
}

function BrandOrders({ brand }) {
  const [orders, setOrders] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  async function refresh() {
    setLoading(true);
    setErrorText("");
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("id, created_at, total, payment_method, status, order_items(count)")
        .eq("brand_id", brand.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setOrders(
        (data || []).map((o) => ({
          id: o.id,
          created_at: o.created_at,
          total: o.total,
          payment_method: o.payment_method,
          status: o.status,
          items_count: Array.isArray(o.order_items) && o.order_items[0]?.count != null ? o.order_items[0].count : 0,
        }))
      );
    } catch (e) {
      setOrders([]);
      setErrorText(e.message || "No se pudieron cargar los pedidos.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refresh(); }, [brand.id]);

  function downloadCSV(filename, rows) {
    if (!rows?.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        headers.map((h) => {
          const v = r[h] ?? "";
          const s = String(v).replace(/"/g, '""');
          return /[",\n]/.test(s) ? `"${s}"` : s;
        }).join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCSV() {
    if (!orders?.length) return;
    const rows = orders.map((o) => ({
      order_id: o.id,
      fecha: fmtDate(o.created_at),
      total: o.total,
      metodo: o.payment_method,
      estado: o.status,
      items: o.items_count,
    }));
    downloadCSV(`pedidos-${brand.slug}.csv`, rows);
  }

  return (
    <section className="card" style={{ padding: 16, marginTop: 12 }}>
      <div className="row" style={{ alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Pedidos</h2>
        <div style={{ flex: 1 }} />
        <button className="btn ghost" onClick={refresh}>Refrescar</button>
        <button className="btn ghost" onClick={exportCSV}>Exportar CSV</button>
      </div>

      {errorText ? <div className="card" style={{ padding: 12, border: "1px solid #a33", marginTop: 8 }}>{errorText}</div> : null}

      <div className="card" style={{ marginTop: 8, padding: 0, overflowX: "auto" }}>
        {loading ? (
          <div className="skel" style={{ height: 120 }} />
        ) : !orders ? (
          <div style={{ padding: 16 }}>Cargando…</div>
        ) : orders.length === 0 ? (
          <div style={{ padding: 16 }}>No hay pedidos todavía.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Pedido</th>
                <th>Items</th>
                <th>Total</th>
                <th>Método</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{fmtDate(o.created_at)}</td>
                  <td style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,'Liberation Mono','Courier New',monospace" }}>{o.id.slice(0,8)}…</td>
                  <td>{o.items_count}</td>
                  <td>{fmtMoney(o.total)}</td>
                  <td>{o.payment_method}</td>
                  <td>{o.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export default dynamic(() => Promise.resolve(VendorInner), { ssr: false });
