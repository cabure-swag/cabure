// pages/vendor/index.jsx
import React, { useEffect, useState } from "react";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// Utilidades simples
const fmtMoney = (n) => `$ ${Number(n || 0).toLocaleString("es-AR")}`;
const fmtDate = (iso) => new Date(iso).toLocaleString("es-AR");

function downloadCSV(filename, rows) {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const v = r[h] ?? "";
          const s = String(v).replace(/"/g, '""');
          return /[",\n]/.test(s) ? `"${s}"` : s;
        })
        .join(",")
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

export default function VendorPage() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [brands, setBrands] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [uiError, setUiError] = useState("");

  // Cargar sesión + rol
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const s = data?.session ?? null;
      if (!alive) return;
      setSession(s);
      if (s?.user?.id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", s.user.id)
          .maybeSingle();
        setRole(prof?.role ?? null);
      } else {
        setRole(null);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      (async () => {
        if (s?.user?.id) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("role")
            .eq("user_id", s.user.id)
            .maybeSingle();
          setRole(prof?.role ?? null);
        } else {
          setRole(null);
        }
      })();
    });
    return () => {
      alive = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // Cargar marcas donde soy vendor (o todas si admin)
  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      try {
        setUiError("");
        // Traer links brand_users
        const { data: links, error: e1 } = await supabase
          .from("brand_users")
          .select("brand_id")
          .eq("user_id", session.user.id);
        if (e1) throw e1;
        const ids = (links || []).map((l) => l.brand_id);

        // Si admin, permitir ver todas
        let brandQuery = supabase
          .from("brands")
          .select("id,name,slug,description,instagram_url,logo_url,color,active,deleted_at");
        if (role !== "admin") {
          if (!ids.length) return setBrands([]);
          brandQuery = brandQuery.in("id", ids);
        }
        const { data: bs, error: e2 } = await brandQuery;
        if (e2) throw e2;
        setBrands(bs || []);
      } catch (err) {
        console.error(err);
        setUiError("No se pudieron cargar tus marcas.");
        setBrands([]);
      }
    })();
  }, [session?.user?.id, role]);

  if (!session) {
    return (
      <div className="container">
        <div className="card" style={{ padding: 24 }}>
          <h2>Vendor</h2>
          <p>Necesitás iniciar sesión.</p>
          <Link href="/soporte" className="btn">Iniciar sesión</Link>
        </div>
      </div>
    );
  }
  if (role !== "vendor" && role !== "admin") {
    return (
      <div className="container">
        <div className="card" style={{ padding: 24 }}>
          <h2>Sin permiso</h2>
          <p>Tu usuario no tiene rol de vendedor.</p>
          <Link href="/" className="btn">Volver</Link>
        </div>
      </div>
    );
  }

  async function uploadLogo(brand, file) {
    if (!file) return null;
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${brand.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("brand-logos").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/png",
    });
    if (upErr) throw upErr;
    const { data } = supabase.storage.from("brand-logos").getPublicUrl(path);
    return data?.publicUrl || null;
  }

  async function saveBrand(b, partial) {
    try {
      setUiError("");
      setSavingId(b.id);
      const payload = {
        description: partial.description ?? b.description ?? null,
        instagram_url: partial.instagram_url ?? b.instagram_url ?? null,
        logo_url: partial.logo_url ?? b.logo_url ?? null,
        color: partial.color ?? b.color ?? null,
      };
      const { error } = await supabase.from("brands").update(payload).eq("id", b.id);
      if (error) throw error;
      setBrands((prev) => prev.map((x) => (x.id === b.id ? { ...x, ...payload } : x)));
    } catch (e) {
      setUiError(e.message || "No se pudo guardar la marca.");
    } finally {
      setSavingId(null);
    }
  }

  // Traer pedidos por brand
  async function loadOrders(brandId) {
    // pedidos + conteo de items (join simple)
    const { data, error } = await supabase
      .from("orders")
      .select("id, created_at, total, payment_method, status, order_items(count)")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map((o) => ({
      id: o.id,
      created_at: o.created_at,
      total: o.total,
      payment_method: o.payment_method,
      status: o.status,
      items_count: Array.isArray(o.order_items) && o.order_items[0]?.count != null ? o.order_items[0].count : 0,
    }));
  }

  async function exportOrdersCSV(brand) {
    try {
      const orders = await loadOrders(brand.id);
      if (!orders.length) return;
      const rows = orders.map((o) => ({
        order_id: o.id,
        fecha: fmtDate(o.created_at),
        total: o.total,
        payment_method: o.payment_method,
        status: o.status,
        items: o.items_count,
      }));
      downloadCSV(`pedidos-${brand.slug}.csv`, rows);
    } catch (e) {
      setUiError(e.message || "No se pudieron exportar los pedidos.");
    }
  }

  async function exportOrderItemsCSV(brand) {
    try {
      // Traigo todos los pedidos y luego sus items en un solo SELECT con join
      const { data, error } = await supabase
        .from("order_items")
        .select(`
          order_id,
          qty,
          unit_price,
          created_at,
          orders!inner(id, brand_id, created_at, payment_method, status, total),
          products!inner(id, name)
        `)
        .eq("orders.brand_id", brand.id)
        .order("order_id", { ascending: false });
      if (error) throw error;

      const rows = (data || []).map((it) => ({
        order_id: it.order_id,
        fecha_pedido: fmtDate(it.orders?.created_at),
        producto: it.products?.name || it.product_id,
        qty: it.qty,
        unit_price: it.unit_price,
        payment_method: it.orders?.payment_method,
        status: it.orders?.status,
      }));
      if (!rows.length) return;
      downloadCSV(`items-${brand.slug}.csv`, rows);
    } catch (e) {
      setUiError(e.message || "No se pudieron exportar los items.");
    }
  }

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
        <div className="grid grid-2">
          {brands.map((b) => (
            <BrandEditorCard
              key={b.id}
              brand={b}
              savingId={savingId}
              onSave={saveBrand}
              onUploadLogo={uploadLogo}
              onExportOrders={() => exportOrdersCSV(b)}
              onExportItems={() => exportOrderItemsCSV(b)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BrandEditorCard({ brand: b, savingId, onSave, onUploadLogo, onExportOrders, onExportItems }) {
  const [orders, setOrders] = useState(null);
  const [loadingOrders, setLoadingOrders] = useState(false);

  async function refreshOrders() {
    setLoadingOrders(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("id, created_at, total, payment_method, status, order_items(count)")
        .eq("brand_id", b.id)
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
    } finally {
      setLoadingOrders(false);
    }
  }

  useEffect(() => {
    // Cargar al abrir
    refreshOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b.id]);

  return (
    <article className="card" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 64, height: 64, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,.08)", position: "relative", background: "#0E1012" }}>
          {b.logo_url && (
            <Image src={b.logo_url} alt={`${b.name} logo`} fill sizes="64px" style={{ objectFit: "cover" }} unoptimized />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <strong>{b.name}</strong>
          <div style={{ color: "var(--text-dim)" }}>/marcas/{b.slug}</div>
        </div>
        <a href={`/marcas/${b.slug}`} target="_blank" rel="noreferrer" className="btn ghost">Ver</a>
      </div>

      {/* Edición rápida de perfil de marca */}
      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
        <label className="input-label">Descripción</label>
        <textarea
          className="input"
          rows={3}
          defaultValue={b.description || ""}
          onBlur={(e) => onSave(b, { description: e.target.value })}
        />

        <label className="input-label">Instagram (URL)</label>
        <input
          className="input"
          type="url"
          defaultValue={b.instagram_url || ""}
          placeholder="https://instagram.com/mi_marca"
          onBlur={(e) => onSave(b, { instagram_url: e.target.value })}
        />

        <label className="input-label">Color (hex opcional)</label>
        <input
          className="input"
          type="text"
          defaultValue={b.color || ""}
          placeholder="#111111"
          onBlur={(e) => onSave(b, { color: e.target.value })}
        />

        <label className="input-label">Logo (PNG/JPG)</label>
        <input
          className="input"
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const publicUrl = await onUploadLogo(b, file);
              await onSave(b, { logo_url: publicUrl });
            } catch (err) {
              alert(err.message || "No se pudo subir el logo.");
            }
          }}
        />
      </div>

      {/* Pedidos */}
      <div style={{ marginTop: 16 }}>
        <div className="row" style={{ alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Pedidos</h3>
          <div style={{ flex: 1 }} />
          <button className="btn ghost" onClick={refreshOrders} aria-label="Refrescar pedidos">Refrescar</button>
          <button className="btn ghost" onClick={onExportOrders} aria-label="Exportar CSV pedidos">Exportar CSV (pedidos)</button>
          <button className="btn ghost" onClick={onExportItems} aria-label="Exportar CSV items">Exportar CSV (items)</button>
        </div>

        <div className="card" style={{ marginTop: 8, padding: 0, overflowX: "auto" }}>
          {loadingOrders ? (
            <div className="skel" style={{ height: 120 }} />
          ) : !orders ? (
            <div style={{ padding: 16 }}>Cargando...</div>
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
                    <td style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>{o.id.slice(0, 8)}…</td>
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
      </div>

      <div style={{ marginTop: 12 }}>
        {savingId === b.id ? <span className="badge">Guardando…</span> : null}
      </div>
    </article>
  );
}
