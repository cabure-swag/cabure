// pages/soporte.jsx
import Head from "next/head";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ChatBox from "@/components/ChatBox";

export default function Soporte(){
  const [session, setSession] = useState(null);
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [brands, setBrands] = useState({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    let cancel = false;
    (async ()=>{
      const uid = session.user.id;
      const { data: ts } = await supabase
        .from("support_threads")
        .select("id,brand_id,status,created_at")
        .eq("user_id", uid)
        .order("status",{ ascending:true })
        .order("created_at",{ ascending:false });
      if (cancel) return;
      setThreads(ts || []);
      setActive(ts?.[0]?.id || null);

      const brandIds = Array.from(new Set((ts||[]).map(t => t.brand_id).filter(Boolean)));
      if (brandIds.length){
        const { data: bs } = await supabase.from("brands").select("id,name").in("id", brandIds);
        const map = {}; (bs||[]).forEach(b => map[b.id] = b.name);
        setBrands(map);
      }
    })();
    return () => { cancel = true; };
  }, [session?.user?.id]);

  async function newThread(){
    if (!session?.user?.id) return;
    const { data, error } = await supabase
      .from("support_threads")
      .insert({ user_id: session.user.id, status: "open" })
      .select("id").maybeSingle();
    if (error) { alert("No se pudo abrir soporte."); return; }
    setThreads(arr => [ { id: data.id, brand_id: null, status: "open", created_at: new Date().toISOString() }, ...arr ]);
    setActive(data.id);
  }

  if (!session?.user) {
    return (
      <div className="container">
        <Head><title>Soporte — CABURE.STORE</title></Head>
        <div className="status-empty">
          <p>Ingresá para ver tus chats.</p>
          <button className="btn btn-primary" onClick={()=>supabase.auth.signInWithOAuth({ provider:"google" })}>
            Ingresar con Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <Head><title>Soporte — CABURE.STORE</title></Head>
      <div className="row" style={{ alignItems:"center" }}>
        <h1 style={{ margin:0 }}>Mis chats</h1>
        <div style={{ flex:1 }} />
        <button className="btn" onClick={newThread}>Nuevo chat</button>
      </div>

      <div style={{ marginTop:12, display:"grid", gridTemplateColumns:"320px 1fr", gap:16 }}>
        <section className="card" style={{ padding:12 }}>
          {threads.length === 0 ? (
            <div className="status-empty">No tenés chats aún.</div>
          ) : (
            <ul style={{ listStyle:"none", padding:0, margin:0, display:"grid", gap:8 }}>
              {threads.map(t => {
                const activeRow = t.id === active;
                return (
                  <li key={t.id}>
                    <button
                      className="btn"
                      onClick={()=>setActive(t.id)}
                      style={{
                        width:"100%", justifyContent:"flex-start",
                        background: activeRow ? "var(--brand)" : "var(--panel)",
                        color: activeRow ? "#000" : "var(--text)",
                        border:"1px solid var(--border)"
                      }}
                    >
                      <div style={{ textAlign:"left" }}>
                        <div style={{ fontWeight:600 }}>{brands[t.brand_id] || "Soporte general"}</div>
                        <div style={{ fontSize:12, opacity:.8 }}>
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

        <section className="card" style={{ padding:12, minHeight:520 }}>
          {!active ? <div className="status-empty">Elegí un chat a la izquierda.</div> : <ChatBox threadId={active} />}
        </section>
      </div>
    </div>
  );
}
