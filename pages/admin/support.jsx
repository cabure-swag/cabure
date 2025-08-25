// pages/admin/support.jsx
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ChatBox from "@/components/ChatBox";

export default function AdminSupport(){
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [threads, setThreads] = useState([]);
  const [brands, setBrands] = useState({});
  const [buyers, setBuyers] = useState({});
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(()=>{
    if (!session?.user?.id) return;
    (async ()=>{
      const { data: me } = await supabase.from("profiles").select("role").eq("user_id", session.user.id).maybeSingle();
      setIsAdmin(me?.role === "admin");
    })();
  }, [session?.user?.id]);

  useEffect(()=>{
    if (!isAdmin) { setThreads([]); setLoading(false); return; }
    let cancel = false;
    (async ()=>{
      setLoading(true);
      const { data: ts } = await supabase
        .from("support_threads")
        .select("id,brand_id,user_id,status,created_at")
        .order("status", { ascending:true })
        .order("created_at", { ascending:false });
      if (cancel) return;
      setThreads(ts || []);

      const brandIds = Array.from(new Set((ts||[]).map(t => t.brand_id).filter(Boolean)));
      if (brandIds.length){
        const { data: bs } = await supabase.from("brands").select("id,name").in("id", brandIds);
        const map = {}; (bs||[]).forEach(b => map[b.id] = b.name);
        if (!cancel) setBrands(map);
      }
      const userIds = Array.from(new Set((ts||[]).map(t => t.user_id).filter(Boolean)));
      if (userIds.length){
        const { data: ps } = await supabase.from("profiles").select("user_id,full_name,name,email").in("user_id", userIds);
        const map2 = {}; (ps||[]).forEach(p => map2[p.user_id] = p.full_name || p.name || p.email || "Cliente");
        if (!cancel) setBuyers(map2);
      }

      setLoading(false);
      setActiveThreadId(ts?.[0]?.id || null);
    })();
    return () => { cancel = true; };
  }, [isAdmin]);

  if (!session?.user) {
    return <div className="container"><div className="status-empty">Ingresá para ver soporte.</div></div>;
  }
  if (!isAdmin) {
    return <div className="container"><div className="status-empty">Acceso solo administradores.</div></div>;
  }

  return (
    <div className="container">
      <Head><title>Soporte — Admin</title></Head>
      <h1>Soporte (Admin)</h1>

      <div style={{ marginTop: 12, display:"grid", gridTemplateColumns:"320px 1fr", gap: 16 }}>
        <section className="card" style={{ padding: 12 }}>
          <h2 style={{ marginTop: 0 }}>Tickets</h2>
          {loading ? (
            <div className="skeleton" style={{ height:64, borderRadius:10 }} />
          ) : threads.length === 0 ? (
            <div className="card" style={{ padding:12, border:"1px dashed var(--border)", color:"#9aa" }}>No hay hilos.</div>
          ) : (
            <ul style={{ listStyle:"none", padding:0, margin:0, display:"grid", gap:8 }}>
              {threads.map(t => {
                const title = `${buyers[t.user_id] || "Cliente"} · ${brands[t.brand_id] || "—"}`;
                const active = t.id === activeThreadId;
                return (
                  <li key={t.id}>
                    <button
                      className="btn"
                      onClick={()=>setActiveThreadId(t.id)}
                      style={{
                        width:"100%", justifyContent:"flex-start",
                        background: active ? "var(--brand)" : "var(--panel)",
                        color: active ? "#000" : "var(--text)",
                        border: "1px solid var(--border)"
                      }}
                    >
                      <div style={{ textAlign:"left" }}>
                        <div style={{ fontWeight:600 }}>{title}</div>
                        <div style={{ fontSize:12, opacity:0.8 }}>
                          {t.status} · {new Date(t.created_at).toLocaleString("es-AR", { hour12:false })}
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
            <div className="status-empty">Seleccioná un hilo para ver el chat.</div>
          ) : (
            <ChatBox threadId={activeThreadId} onDeleted={()=>setThreads(arr => arr.filter(x => x.id !== activeThreadId))} />
          )}
        </section>
      </div>
    </div>
  );
}
