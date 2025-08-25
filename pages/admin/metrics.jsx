// pages/admin/metrics.jsx
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { supabase } from "@/lib/supabaseClient";

function currency(n) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0);
}

export default function AdminMetrics() {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [brands, setBrands] = useState([]);
  const [brandId, setBrandId] = useState("all");
  const [from, setFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());
  const [to, setTo] = useState(() => new Date().toISOString());

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openRow, setOpenRow] = useState(null);
  const [itemsMap, setItemsMap] = useState({}); // order_id -> items[]

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s || null));
    return () => sub?.subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      const { data: prof } = await supabase.from("profiles").select("role").eq("user_id", session.user.id).maybeSingle();
      setIsAdmin(prof?.role === "admin");
      if (prof?.role !== "admin") return;

      const { data: b } = await supabase.from("brands").select("id,name").is("deleted_at", null).order("name");
      setBrands(b || []);
    })();
  }, [session?.user?.id]);

  useEffect(() => {
    if (!isAdmin) return;
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, brandId, from, to]);

  async function loadOrders() {
    setLoading(true);
    let q = supabase.from("orders")
      .select("id,brand_id,buyer_id,total,status,payment_method,mp_payment_id,created_at")
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: false });

    if (brandId !== "all") q = q.eq("brand_id", brandId);

    const { data, error } = await q;
    setLoading(false);
    if (error) return;
    setOrders(data || []);
  }

  async function loadItems(orderId) {
    if (itemsMap[orderId]) return; // cached
    const { data } = await supabase
      .from("order_items")
      .select("id,product_id,qty,unit_price,created_at,products(name)")
      .eq("order_id", orderId);
    setItemsMap((m) => ({ ...m, [orderId]: data || [] }));
  }

  async function cancelOrder(orderId) {
    if (!session?.user?.email) return alert("Sesión inválida");
    if (!confirm("¿Cancelar/Eliminar este pedido?")) return;
    const resp = await fetch("/api/admin/order-cancel.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, requesterEmail: session.user.email }),
    });
    const json = await resp.json();
    if (!json.ok) return alert(json.error || "No se pudo cancelar");
    await loadOrders();
    alert("Pedido cancelado");
  }

  if (!session) {
    return (
      <div className="container">
        <Head><title>Admin · Métricas — CABURE.STORE</title></Head>
        <p>Iniciá sesión.</p>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="container">
        <Head><title>Admin · Métricas — CABURE.STORE</title></Head>
        <p>Acceso solo admin.</p>
      </div>
    );
  }

  return (
    <div className="container">
      <Head><title>Admin · Métricas — CABURE.STORE</title></Head>

      <div className="row" style={{ gap:12, alignItems:"center" }}>
        <h1 style={{ margin:0 }}>Pedidos</h1>
        <div style={{ flex:1 }} />
        <select value={brandId} onChange={(e)=>setBrandId(e.target.value)} className="select" aria-label="Marca">
          <option value="all">Todas</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input type="datetime-local" value={toLocal(from)} onChange={(e)=>setFrom(fromLocal(e.target.value))} className="select"/>
        <input type="datetime-local" value={toLocal(to)} onChange={(e)=>setTo(fromLocal(e.target.value))} className="select"/>
        <button className="btn" onClick={loadOrders}>Actualizar</button>
      </div>

      {loading && <div className="skeleton" style={{ height: 56, marginTop: 12 }} />}

      <div className="table" style={{ marginTop:12 }}>
        <div className="thead">
          <div>Fecha</div>
          <div>Pedido</div>
          <div>Marca</div>
          <div>Cliente</div>
          <div>Método</div>
          <div>Total</div>
          <div>Estado</div>
          <div>Acciones</div>
        </div>

        {orders.map(o => (
          <div key={o.id} className="rowset">
            <div className="trow">
              <div>{new Date(o.created_at).toLocaleString()}</div>
              <div>{o.id.slice(0,8)}…</div>
              <div>{o.brand_id.slice(0,8)}…</div>
              <div>{o.buyer_id.slice(0,8)}…</div>
              <div>{o.payment_method || "-"}</div>
              <div>{currency(o.total)}</div>
              <div>{o.status}</div>
              <div className="actions">
                <button className="btn ghost" onClick={() => { setOpenRow(openRow === o.id ? null : o.id); if (openRow !== o.id) loadItems(o.id); }}>
                  {openRow === o.id ? "Ocultar" : "Ver ítems"}
                </button>
                {o.status !== "canceled" && (
                  <button className="btn danger" onClick={() => cancelOrder(o.id)}>Cancelar</button>
                )}
              </div>
            </div>
            {openRow === o.id && (
              <div className="items">
                <div className="thead sub">
                  <div>Producto</div>
                  <div>Cant.</div>
                  <div>Unitario</div>
                  <div>Subtotal</div>
                </div>
                {(itemsMap[o.id] || []).map(it => (
                  <div key={it.id} className="trow sub">
                    <div>{it.products?.name || it.product_id.slice(0,8)}</div>
                    <div>{it.qty}</div>
                    <div>{currency(it.unit_price)}</div>
                    <div>{currency((it.unit_price || 0) * (it.qty || 0))}</div>
                  </div>
                ))}
                {(itemsMap[o.id]?.length === 0) && <div className="empty">Sin ítems.</div>}
              </div>
            )}
          </div>
        ))}

        {!loading && orders.length === 0 && (
          <div className="empty">Sin pedidos en el rango seleccionado.</div>
        )}
      </div>

      <style jsx>{`
        .container { padding: 16px; }
        .row { display:flex; }
        .select { background:#0f0f0f; color:#fff; border:1px solid #2a2a2a; border-radius:10px; padding:8px 10px; }
        .btn { padding:10px 12px; border-radius:10px; border:1px solid #2a2a2a; background:#161616; color:#fff; cursor:pointer; }
        .btn.ghost { background:transparent; }
        .btn.danger { background:#2a1212; border-color:#462222; }
        .skeleton { background: linear-gradient(90deg, #0f0f0f, #151515, #0f0f0f); border-radius:12px; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%{opacity:.6} 50%{opacity:1} 100%{opacity:.6} }

        .table { width:100%; }
        .thead, .trow { display:grid; grid-template-columns: 1.2fr .9fr .9fr .9fr .8fr .8fr .7fr 1fr; gap:10px; padding:10px; border-bottom:1px solid #1a1a1a; }
        .thead { font-weight:600; background:#0e0e0e; border-radius:10px; }
        .rowset { border:1px solid #1a1a1a; border-radius:12px; margin-top:10px; overflow:hidden; }
        .items { background:#0b0b0b; padding:8px; }
        .sub { grid-template-columns: 1.6fr .5fr .6fr .6fr; }
        .actions { display:flex; gap:8px; }
        .empty { padding:12px; border:1px dashed #2a2a2a; border-radius:12px; text-align:center; opacity:.85; }
      `}</style>
    </div>
  );
}

function toLocal(iso) {
  // ISO -> input datetime-local (sin zona)
  const d = new Date(iso);
  const pad = (n) => `${n}`.padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocal(localStr) {
  // datetime-local -> ISO
  return new Date(localStr).toISOString();
}
