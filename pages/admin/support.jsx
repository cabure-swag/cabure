// pages/admin/support.jsx
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { supabase } from "@/lib/supabaseClient";
import VendorChatBox from "@/components/VendorChatBox";

export default function AdminSupport() {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [brands, setBrands] = useState([]);
  const [brandId, setBrandId] = useState("all");
  const [status, setStatus] = useState("open"); // open | closed | all
  const [threads, setThreads] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeThread, setActiveThread] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s || null));
    return () => sub?.subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      const { data: prof } = await supabase.from("profiles").select("role,email").eq("user_id", session.user.id).maybeSingle();
      setIsAdmin(prof?.role === "admin");
      if (prof?.role !== "admin") return;

      const { data: b } = await supabase.from("brands").select("id,name").is("deleted_at", null).order("name");
      setBrands(b || []);
    })();
  }, [session?.user?.id]);

  useEffect(() => {
    if (!isAdmin) return;
    loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, brandId, status]);

  async function loadThreads() {
    setLoading(true);
    let q = supabase.from("vendor_threads").select("id,brand_id,user_id,status,created_at").order("created_at", { ascending: false });

    if (brandId !== "all") q = q.eq("brand_id", brandId);
    if (status !== "all") q = q.eq("status", status);

    const { data, error } = await q;
    setLoading(false);
    if (error) return;

    setThreads(data || []);
    const uids = Array.from(new Set((data || []).map((t) => t.user_id)));
    if (uids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id,email").in("user_id", uids);
      const map = {};
      (profs || []).forEach((p) => (map[p.user_id] = p.email));
      setProfilesMap(map);
    }
  }

  async function closeThread(id) {
    if (!confirm("¿Cerrar este hilo?")) return;
    const { error } = await supabase.from("vendor_threads").update({ status: "closed" }).eq("id", id);
    if (error) alert(error.message);
    else {
      await loadThreads();
      if (activeThread === id) setActiveThread(null);
    }
  }

  async function deleteThread(id) {
    if (!session?.user?.email) return alert("Sesión inválida");
    if (!confirm("Eliminar hilo y todos sus mensajes (acción permanente)?")) return;

    const resp = await fetch("/api/admin/vendor-thread-delete.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: id, requesterEmail: session.user.email }),
    });
    const json = await resp.json();
    if (!json.ok) return alert(json.error || "No se pudo eliminar");

    await loadThreads();
    if (activeThread === id) setActiveThread(null);
  }

  if (!session) {
    return (
      <div className="container">
        <Head><title>Admin · Soporte vendedores — CABURE.STORE</title></Head>
        <p>Iniciá sesión.</p>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="container">
        <Head><title>Admin · Soporte vendedores — CABURE.STORE</title></Head>
        <p>Acceso solo admin.</p>
      </div>
    );
  }

  return (
    <div className="container">
      <Head><title>Admin · Soporte vendedores — CABURE.STORE</title></Head>

      <div className="row" style={{ gap: 12, alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Chats de vendedores</h1>
        <div style={{ flex: 1 }} />
        <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="select" aria-label="Filtrar por marca">
          <option value="all">Todas las marcas</option>
          {brands.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="select" aria-label="Filtrar por estado">
          <option value="open">Abiertos</option>
          <option value="closed">Cerrados</option>
          <option value="all">Todos</option>
        </select>
        <button className="btn" onClick={loadThreads}>Actualizar</button>
      </div>

      <div className="grid2" style={{ marginTop: 12 }}>
        <div className="threads">
          {loading && <div className="skeleton" style={{ height: 48 }} />}
          {threads.map((t) => (
            <div key={t.id} className={`thread ${activeThread === t.id ? "active" : ""}`}>
              <button className="threadBtn" onClick={() => setActiveThread(t.id)}>
                <div className="title">{profilesMap[t.user_id] || t.user_id.slice(0, 8)}</div>
                <div className="meta">{t.status} · {new Date(t.created_at).toLocaleString()}</div>
              </button>
              <div className="actions">
                {t.status !== "closed" && (
                  <button className="btn ghost" onClick={() => closeThread(t.id)}>Cerrar</button>
                )}
                <button className="btn danger" onClick={() => deleteThread(t.id)}>Eliminar</button>
              </div>
            </div>
          ))}
          {!loading && threads.length === 0 && <div className="empty">No hay hilos.</div>}
        </div>

        <div className="box">
          {activeThread ? (
            <VendorChatBox threadId={activeThread} senderRole="admin" />
          ) : (
            <div className="empty">Elegí un hilo para ver el chat</div>
          )}
        </div>
      </div>

      <style jsx>{`
        .container { padding: 16px; }
        .row { display:flex; }
        .select { background:#0f0f0f; color:#fff; border:1px solid #2a2a2a; border-radius:10px; padding:8px 10px; }
        .btn { padding:10px 12px; border-radius:10px; border:1px solid #2a2a2a; background:#161616; color:#fff; cursor:pointer; }
        .btn.ghost { background:transparent; }
        .btn.danger { background:#2a1212; border-color:#462222; }

        .grid2 { display:grid; grid-template-columns: 320px 1fr; gap:12px; }
        @media (max-width: 900px){ .grid2 { grid-template-columns: 1fr; } }
        .threads { background:#0a0a0a; border:1px solid #1a1a1a; border-radius:12px; padding:8px; display:grid; gap:8px; }
        .thread { display:grid; grid-template-columns: 1fr auto; gap:8px; align-items:center; background:#0f0f0f; border:1px solid #222; color:#ddd; border-radius:10px; padding:8px; }
        .thread.active { border-color:#3a3a3a; color:#fff; background:#171717; }
        .threadBtn { text-align:left; background:transparent; border:none; color:inherit; cursor:pointer; }
        .title { font-weight:600; }
        .meta { font-size:.85rem; opacity:.85; }
        .actions { display:flex; gap:8px; }
        .box { min-height: 50vh; background:#0a0a0a; border:1px solid #1a1a1a; border-radius:12px; padding:8px; }
        .empty { padding:12px; border:1px dashed #2a2a2a; border-radius:12px; text-align:center; opacity:.85; }
        .skeleton { background: linear-gradient(90deg, #0f0f0f, #151515, #0f0f0f); border-radius:12px; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%{opacity:.6} 50%{opacity:1} 100%{opacity:.6} }
      `}</style>
    </div>
  );
}
