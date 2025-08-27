// pages/admin/metrics.jsx
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// ------- Utils -------
function useAuthProfile() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription?.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from("profiles")
      .select("user_id,email,role")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data || null));
  }, [session?.user?.id]);
  return { session, profile };
}
function fmtMoney(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-AR", { minimumFractionDigits: 0 });
}
function ymd(d) {
  const dt = new Date(d);
  return dt.toISOString().slice(0, 10);
}
function fileDownload(name, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ------- Página -------
export default function AdminMetrics() {
  const { session, profile } = useAuthProfile();
  const isAdmin = profile?.role === "admin";

  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [brands, setBrands] = useState([]);
  const [brandFilter, setBrandFilter] = useState("all");
  const [deleting, setDeleting] = useState(null); // orderId en eliminación

  async function loadData() {
    if (!isAdmin) return;
    setLoading(true);

    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1); // exclusivo

    const [{ data: brandsData }, { data: ordersData, error: ordErr }] = await Promise.all([
      supabase
        .from("brands")
        .select("id,name,slug,deleted_at")
        .order("name", { ascending: true }),
      supabase
        .from("orders")
        .select("id, brand_id, buyer_id, total, status, payment_method, mp_payment_id, mp_preference_id, created_at")
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString())
        .order("created_at", { ascending: false }),
    ]);

    if (ordErr) {
      setOrders([]);
      setBrands(brandsData || []);
      setLoading(false);
      alert(ordErr.message || "No se pudieron cargar los pedidos.");
      return;
    }

    const buyerIds = Array.from(new Set((ordersData || []).map(o => o.buyer_id).filter(Boolean)));
    let buyerProfiles = {};
    if (buyerIds.length) {
      const { data: buyers } = await supabase
        .from("profiles")
        .select("user_id,email")
        .in("user_id", buyerIds);
      for (const p of (buyers || [])) buyerProfiles[p.user_id] = p.email;
    }

    const orderIds = Array.from(new Set((ordersData || []).map(o => o.id)));
    let itemsCountByOrder = {};
    if (orderIds.length) {
      const { data: itemsAgg } = await supabase
        .from("order_items")
        .select("order_id, qty");
      (itemsAgg || []).forEach(it => {
        if (!orderIds.includes(it.order_id)) return;
        itemsCountByOrder[it.order_id] = (itemsCountByOrder[it.order_id] || 0) + Number(it.qty || 0);
      });
    }

    const brandById = {};
    (brandsData || []).forEach(b => (brandById[b.id] = b));

    const compiled = (ordersData || []).map(o => ({
      ...o,
      buyer_email: buyerProfiles[o.buyer_id] || "—",
      brand_name: brandById[o.brand_id]?.name || "—",
      items_count: itemsCountByOrder[o.id] || 0,
    }));

    setBrands(brandsData || []);
    setOrders(compiled);
    setLoading(false);
  }

  useEffect(() => { loadData(); /* eslint-disable-line */ }, [isAdmin, month]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => (brandFilter === "all" ? true : o.brand_id === brandFilter));
  }, [orders, brandFilter]);

  const totals = useMemo(() => {
    const t = filteredOrders.reduce((acc, o) => {
      acc.total += Number(o.total || 0);
      acc.count += 1;
      if (o.status === "paid") acc.paid += Number(o.total || 0);
      if (o.status === "canceled") acc.canceled += 1;
      return acc;
    }, { total: 0, count: 0, paid: 0, canceled: 0 });
    return t;
  }, [filteredOrders]);

  async function cancelOrder(orderId) {
    if (!confirm("¿Cancelar este pedido? Quedará con estado 'canceled'.\n(No borra registros.)")) return;
    const { error } = await supabase.from("orders").update({ status: "canceled" }).eq("id", orderId);
    if (error) {
      alert(error.message || "No se pudo cancelar el pedido. Revisá RLS (admin).");
      return;
    }
    setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status: "canceled" } : o)));
  }

  async function deleteOrder(orderId) {
    // Doble confirmación: confirm() + ingresar el ID completo
    if (!confirm("⚠️ Esto elimina DEFINITIVAMENTE el pedido y sus ítems.\n¿Continuar?")) return;
    const typed = prompt(
      `Para confirmar, escribí EXACTAMENTE el ID del pedido:\n\n${orderId}\n\n` +
      "Esto es irreversible."
    );
    if (typed !== orderId) {
      alert("El ID ingresado no coincide. No se eliminó el pedido.");
      return;
    }

    setDeleting(orderId);
    try {
      const { error: e1 } = await supabase.from("order_items").delete().eq("order_id", orderId);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("orders").delete().eq("id", orderId);
      if (e2) throw e2;
      setOrders(prev => prev.filter(o => o.id !== orderId));
    } catch (err) {
      alert(err.message || "No se pudo eliminar el pedido. Revisá RLS (admin).");
    } finally {
      setDeleting(null);
    }
  }

  async function exportCSV() {
    const headers = [
      "fecha","marca","pedido_id","buyer_email","items","total_ars","status","payment_method","mp_preference_id","mp_payment_id",
    ];
    const rows = filteredOrders.map(o => ([
      ymd(o.created_at),
      o.brand_name,
      o.id,
      o.buyer_email,
      o.items_count,
      String(o.total || 0).replace(".", ","),
      o.status,
      o.payment_method || "",
      o.mp_preference_id || "",
      o.mp_payment_id || "",
    ]));
    const csv = [headers.join(","), ...rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(","))].join("\n");
    fileDownload(`pedidos-${month}.csv`, csv);
  }

  if (!session) {
    return (
      <div className="container">
        <Head><title>Métricas — CABURE.STORE</title></Head>
        <h1>Métricas</h1>
        <p>Necesitás iniciar sesión.</p>
        <style jsx>{`.container{padding:16px;}`}</style>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="container">
        <Head><title>Métricas — CABURE.STORE</title></Head>
        <h1>Métricas</h1>
        <p>No tenés permisos de administrador.</p>
        <style jsx>{`.container{padding:16px;}`}</style>
      </div>
    );
  }

  return (
    <div className="container">
      <Head><title>Métricas — CABURE.STORE</title></Head>

      <div className="row" style={{ alignItems:"center", gap:12 }}>
        <h1 style={{ margin:0 }}>Métricas</h1>
        <div style={{ flex:1 }} />
        <Link href="/admin" className="btn ghost">Volver a Admin</Link>
      </div>

      {/* Filtros */}
      <section className="card" style={{ marginTop:12, padding:12 }}>
        <div className="row" style={{ gap:12, alignItems:"center", flexWrap:"wrap" }}>
          <div className="block">
            <label>Mes</label>
            <input className="inp" type="month" value={month} onChange={(e)=>setMonth(e.target.value)} />
          </div>
          <div className="block">
            <label>Marca</label>
            <select className="inp" value={brandFilter} onChange={(e)=>setBrandFilter(e.target.value)}>
              <option value="all">Todas</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div style={{ flex:1 }} />
          <div className="kpis">
            <div className="kpi"><div className="kpiTop">Pedidos</div><div className="kpiNum">{filteredOrders.length}</div></div>
            <div className="kpi"><div className="kpiTop">Total ARS</div><div className="kpiNum">${fmtMoney(filteredOrders.reduce((a,o)=>a+Number(o.total||0),0))}</div></div>
            <div className="kpi"><div className="kpiTop">Pagado</div><div className="kpiNum">${fmtMoney(filteredOrders.filter(o=>o.status==="paid").reduce((a,o)=>a+Number(o.total||0),0))}</div></div>
            <div className="kpi"><div className="kpiTop">Cancelados</div><div className="kpiNum">{filteredOrders.filter(o=>o.status==="canceled").length}</div></div>
          </div>
          <button className="btn" onClick={exportCSV}>Exportar CSV</button>
        </div>
      </section>

      {/* Tabla */}
      <section className="card" style={{ marginTop:12, padding:0, overflowX:"auto" }}>
        {loading ? (
          <div className="skeleton" style={{ height:120 }} />
        ) : filteredOrders.length === 0 ? (
          <div className="empty">Sin pedidos en este rango.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Marca</th>
                <th>Pedido</th>
                <th>Comprador</th>
                <th>Items</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Pago</th>
                <th>MP Pref</th>
                <th>MP Pay</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(o => (
                <tr key={o.id}>
                  <td
  onClick={() => {
    navigator.clipboard.writeText(o.id);
    alert("ID copiado al portapapeles:\n" + o.id);
  }}
  style={{
    cursor: "pointer",
    color: "#4fc3f7",
    textDecoration: "underline"
  }}
  title="Click para copiar el ID completo"
>
  {o.id}
</td>

                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <style jsx>{`
        .container { padding:16px; }
        .row { display:flex; align-items:center; }
        .card { border:1px solid #1a1a1a; border-radius:14px; background:#0a0a0a; }
        .block { display:grid; gap:6px; }
        .inp { padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#0f0f0f; color:#fff; }
        .btn { padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#161616; color:#fff; cursor:pointer; white-space:nowrap; }
        .btn.ghost { background:#0f0f0f; }
        .btn.danger { background:#1c1313; border-color:#3a2222; }
        .kpis { display:flex; gap:10px; margin-left:auto; }
        .kpi { border:1px solid #222; border-radius:10px; padding:8px 10px; background:#0f0f0f; }
        .kpiTop { font-size:.8rem; opacity:.8; }
        .kpiNum { font-size:1.1rem; font-weight:700; }
        .empty { padding:14px; text-align:center; border:1px dashed #2a2a2a; border-radius:12px; margin:8px; }
        .skeleton { background:linear-gradient(90deg,#0f0f0f,#151515,#0f0f0f); animation:pulse 1.5s infinite; border-radius:12px; }
        @keyframes pulse { 0%{opacity:.6} 50%{opacity:1} 100%{opacity:.6} }
        .tbl { width:100%; border-collapse:collapse; min-width:980px; }
        .tbl th, .tbl td { padding:8px 10px; border-bottom:1px solid #1a1a1a; text-align:left; }
        .badge { padding:2px 8px; border-radius:999px; border:1px solid #333; font-size:.8rem; text-transform:lowercase; }
        .badge.paid { background:#102012; color:#c6f6d5; border-color:#1f3f26; }
        .badge.created { background:#111127; color:#cdd6ff; border-color:#23234a; }
        .badge.canceled { background:#2a1717; color:#f8b4b4; border-color:#422; }
      `}</style>
    </div>
  );
}
