// pages/admin/support.jsx
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ChatBox from "@/components/ChatBox";
import Link from "next/link";

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

export default function AdminSupport() {
  const { session, profile } = useAuthProfile();
  const isAdmin = profile?.role === "admin";

  const [threads, setThreads] = useState([]);
  const [brands, setBrands] = useState([]);
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("open"); // open | all

  // cargar hilos
  async function load() {
    if (!isAdmin) return;
    const [{ data: bs }, { data: th, error }] = await Promise.all([
      supabase.from("brands").select("id,name"),
      supabase
        .from("support_threads")
        .select("id,user_id,brand_id,status,created_at")
        .order("created_at", { ascending: false })
    ]);
    if (error) {
      alert(error.message || "No se pudieron cargar los tickets.");
      return;
    }
    // enriquecer con email del user
    const userIds = Array.from(new Set((th || []).map(t => t.user_id)));
    let profilesMap = {};
    if (userIds.length) {
      const { data: ps } = await supabase
        .from("profiles")
        .select("user_id,email")
        .in("user_id", userIds);
      (ps || []).forEach(p => { profilesMap[p.user_id] = p.email; });
    }
    const brandMap = {};
    (bs || []).forEach(b => (brandMap[b.id] = b.name));

    const final = (th || []).map(t => ({
      ...t,
      user_email: profilesMap[t.user_id] || "—",
      brand_name: t.brand_id ? (brandMap[t.brand_id] || "—") : "General"
    }));

    setBrands(bs || []);
    setThreads(final);
  }

  useEffect(() => { load(); /* eslint-disable-line */ }, [isAdmin]);

  // realtime: nuevos hilos para admins
  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase
      .channel("support_threads_admin")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_threads" }, (payload) => {
        setThreads(prev => [{
          ...payload.new,
          user_email: "—",
          brand_name: payload.new.brand_id ? "—" : "General",
        }, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return threads.filter(t => {
      if (status === "open" && t.status !== "open") return false;
      if (!term) return true;
      return (
        t.id.toLowerCase().includes(term) ||
        (t.user_email || "").toLowerCase().includes(term) ||
        (t.brand_name || "").toLowerCase().includes(term)
      );
    });
  }, [threads, q, status]);

  function handleClosed() {
    // tras cerrar/eliminar desde ChatBox, refresco lista
    load();
    setSel(null);
  }

  if (!session) {
    return (
      <div className="container">
        <Head><title>Soporte (Admin) — CABURE.STORE</title></Head>
        <h1>Soporte (Admin)</h1>
        <p>Necesitás iniciar sesión.</p>
        <style jsx>{`.container{padding:16px;}`}</style>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="container">
        <Head><title>Soporte (Admin) — CABURE.STORE</title></Head>
        <h1>Soporte (Admin)</h1>
        <p>No tenés permisos de administrador.</p>
        <style jsx>{`.container{padding:16px;}`}</style>
      </div>
    );
  }

  return (
    <div className="container">
      <Head><title>Soporte (Admin) — CABURE.STORE</title></Head>

      <div className="row" style={{ gap:12, alignItems:"center" }}>
        <h1 style={{ margin:0 }}>Soporte (Admin)</h1>
        <div style={{ flex:1 }} />
        <Link href="/admin" className="btn ghost">Volver a Admin</Link>
      </div>

      {/* Filtros */}
      <section className="card" style={{ marginTop:12, padding:12 }}>
        <div className="row" style={{ gap:8, flexWrap:"wrap" }}>
          <input
            className="inp"
            placeholder="Buscar por ID / email / marca…"
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            style={{ minWidth: 260 }}
          />
          <div className="row" style={{ gap:6 }}>
            <button className={`btn ${status==="open" ? "" : "ghost"}`} onClick={()=>setStatus("open")}>Abiertos</button>
            <button className={`btn ${status==="all" ? "" : "ghost"}`} onClick={()=>setStatus("all")}>Todos</button>
          </div>
        </div>
      </section>

      <div className="grid">
        <section className="card" style={{ padding:0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>ID</th>
                <th>Usuario</th>
                <th>Marca</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6}><div className="empty">Sin tickets.</div></td></tr>
              ) : filtered.map(t => (
                <tr key={t.id} className={t.status !== "open" ? "row-closed" : ""}>
                  <td title={t.created_at}>{new Date(t.created_at).toLocaleString()}</td>
                  <td title={t.id}>{t.id.slice(0,8)}…</td>
                  <td>{t.user_email}</td>
                  <td>{t.brand_name}</td>
                  <td><span className={`badge ${t.status}`}>{t.status}</span></td>
                  <td><button className="btn" onClick={()=>setSel(t.id)}>Abrir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card" style={{ padding:12 }}>
          {!sel ? (
            <div className="empty">Elegí un ticket para abrir el chat.</div>
          ) : (
            <ChatBox threadId={sel} adminView onCloseThread={handleClosed} />
          )}
        </section>
      </div>

      <style jsx>{`
        .container { padding:16px; }
        .row { display:flex; align-items:center; }
        .grid { display:grid; grid-template-columns: 1.1fr 1fr; gap:12px; margin-top:12px; }
        @media (max-width: 960px) { .grid { grid-template-columns: 1fr; } }
        .card { border:1px solid #1a1a1a; border-radius:14px; background:#0a0a0a; }
        .inp { padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#0f0f0f; color:#fff; }
        .btn { padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#161616; color:#fff; cursor:pointer; white-space:nowrap; }
        .btn.ghost { background:#0f0f0f; }
        .tbl { width:100%; border-collapse:collapse; }
        .tbl th, .tbl td { padding:8px 10px; border-bottom:1px solid #1a1a1a; text-align:left; }
        .badge { padding:2px 8px; border-radius:999px; border:1px solid #333; font-size:.75rem; text-transform:lowercase; }
        .badge.open { background:#111127; color:#cdd6ff; border-color:#23234a; }
        .badge.closed { background:#2a1717; color:#f8b4b4; border-color:#422; }
        .empty { padding:14px; text-align:center; border:1px dashed #2a2a2a; border-radius:12px; margin:8px; }
        .row-closed td { opacity:.75; }
      `}</style>
    </div>
  );
}
