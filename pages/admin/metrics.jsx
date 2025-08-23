// pages/admin/metrics.jsx
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { supabase } from "@/lib/supabaseClient";

const fmtMoney = (n) => `$ ${Number(n || 0).toLocaleString("es-AR")}`;
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString("es-AR") : "—");

export default function AdminMetrics() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [orders, setOrders] = useState(null);
  const [expanded, setExpanded] = useState({}); // order_id => bool
  const [uiError, setUiError] = useState("");
  const [loading, setLoading] = useState(false);

  // Sesión + rol
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const s = data?.session ?? null;
      setSession(s);
      if (s?.user?.id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", s.user.id)
          .maybeSingle();
        setRole(prof?.role ?? null);
      } else setRole(null);
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
        } else setRole(null);
      })();
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  async function loadOrders() {
    setLoading(true);
    setUiError("");
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("id, brand_id, buyer_id, total, status, payment_method, mp_preference_id, mp_payment_id, created_at, brands:brand_id(name,slug)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setOrders(data || []);
    } catch (e) {
      setUiError(e.message || "No se pudieron cargar los pedidos.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadOrders(); }, []);

  if (!session) {
    return (
      <div className="container">
        <Head><title>Métricas — CABURE.STORE</title></Head>
        <div className="card" style={{ padding: 24 }}>
          <h2>Métricas</h2>
          <p>Necesitás iniciar sesión.</p>
        </div>
      </div>
    );
  }
  if (role !== "admin") {
    return (
      <div className="container">
        <Head><title>Métricas — CABURE.STORE</title></Head>
        <div className="card" style={{ padding: 24 }}>
          <h2>Sin permiso</h2>
          <p>Tu usuario no es admin.</p>
        </div>
      </div>
    );
  }

  async function toggleExpand(orderId) {
    setExpanded((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
    // Lazy-load de items cuando se expande por primera vez
    if (!expanded[orderId]) {
      const { data, error } = await supabase
        .from("order_items")
        .select("id, product_id, qty, unit_price, products:product_id(name)")
        .eq("order_id", orderId)
        .order("id");
      if (!error) {
        setOrders((prev) =>
          (prev || []).map((o) =>
            o.id === orderId ? { ...o, _items: data || [] } : o
          )
        );
      }
    }
  }

  async function deleteOrder(orderId) {
    if (!confirm("Esto eliminará el pedido y sus ítems. ¿Continuar?")) return;
    try {
      // 1) Borrar ítems primero
      const delItems = await supabase.from("order_items").delete().eq("order_id", orderId);
      if (delItems.error) throw delItems.error;
      // 2) Borrar pedido
      const delOrder = await supabase.from("orders").delete().eq("id", orderId);
      if (delOrder.error) throw delOrder.error;
      // 3) Actualizar UI
      setOrders((prev) => (prev || []).filter((o) => o.id !== orderId));
    } catch (e) {
      alert(e.message || "No se pudo eliminar el pedido (ver políticas RLS).");
    }
  }

  return (
    <div className="container">
      <Head><title>Métricas — CABURE.STORE</title></Head>
      <h1>Métricas / Pedidos</h1>

      {uiError ? <div className="card" style={{ padding: 12, border: "1px solid #a33" }}>{uiError}</div> : null}

      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <button className="btn ghost" onClick={loadOrders} disabled={loading}>{loading ? "Cargando…" : "Refrescar"}</button>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        {!orders ? (
          <div className="skel" style={{ height: 160 }} />
        ) : orders.length === 0 ? (
          <div style={{ padding: 16 }}>No hay pedidos.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Pedido</th>
                <th>Marca</th>
                <th>Buyer</th>
                <th>Método</th>
                <th>Total</th>
                <th>Estado</th>
                <th>MP Pref</th>
                <th>MP Pay</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <React.Fragment key={o.id}>
                  <tr>
                    <td>{fmtDate(o.created_at)}</td>
                    <td style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>
                      {o.id.slice(0, 8)}…
                    </td>
                    <td>{o.brands?.name || o.brand_id} <span style={{ color: "var(--text-dim)" }}>/{o.brands?.slug || "-"}</span></td>
                    <td>{o.buyer_id?.slice(0,8)}…</td>
                    <td>{o.payment_method}</td>
                    <td>{fmtMoney(o.total)}</td>
                    <td>{o.status}</td>
                    <td title={o.mp_preference_id || ""}>{o.mp_preference_id ? o.mp_preference_id.slice(0,6)+"…" : "—"}</td>
                    <td title={o.mp_payment_id || ""}>{o.mp_payment_id ? o.mp_payment_id.slice(0,6)+"…" : "—"}</td>
                    <td>
                      <button className="btn ghost" onClick={() => toggleExpand(o.id)}>
                        {expanded[o.id] ? "Ocultar" : "Ver ítems"}
                      </button>
                      <button className="btn danger" onClick={() => deleteOrder(o.id)} style={{ marginLeft: 6 }}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                  {expanded[o.id] ? (
                    <tr>
                      <td colSpan={10} style={{ background: "#0E1012" }}>
                        {!o._items ? (
                          <div style={{ padding: 12 }}>Cargando ítems…</div>
                        ) : o._items.length === 0 ? (
                          <div style={{ padding: 12 }}>Sin ítems.</div>
                        ) : (
                          <table className="table" style={{ margin: 12, width: "calc(100% - 24px)" }}>
                            <thead>
                              <tr>
                                <th>Producto</th>
                                <th>Cant</th>
                                <th>Unit</th>
                                <th>Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {o._items.map((it) => (
                                <tr key={it.id}>
                                  <td>{it.products?.name || it.product_id}</td>
                                  <td>{it.qty}</td>
                                  <td>{fmtMoney(it.unit_price)}</td>
                                  <td>{fmtMoney(Number(it.unit_price || 0) * Number(it.qty || 0))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
