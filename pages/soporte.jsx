// pages/soporte.jsx
import Head from "next/head";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ChatBox from "@/components/ChatBox";

export default function Soporte() {
  const [session, setSession] = useState(null);
  const [threadId, setThreadId] = useState(null);
  const [loading, setLoading] = useState(true);

  // sesión
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  // crear/abrir hilo del usuario (status=open y sin brand_id específico)
  useEffect(() => {
    (async () => {
      if (!session?.user?.id) { setThreadId(null); setLoading(false); return; }
      setLoading(true);
      const uid = session.user.id;

      // re-abrir si ya existe uno open
      const { data: tOpen } = await supabase
        .from("support_threads")
        .select("id")
        .eq("user_id", uid)
        .eq("status", "open")
        .is("brand_id", null)
        .maybeSingle();

      if (tOpen?.id) {
        setThreadId(tOpen.id);
        setLoading(false);
        return;
      }

      // crear nuevo
      const { data, error } = await supabase
        .from("support_threads")
        .insert({ user_id: uid, brand_id: null, status: "open" })
        .select("id")
        .maybeSingle();

      if (error) {
        setThreadId(null);
        alert(error.message || "No se pudo abrir soporte.");
      } else {
        setThreadId(data?.id || null);
      }
      setLoading(false);
    })();
  }, [session?.user?.id]);

  const login = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  };
  const logout = async () => { await supabase.auth.signOut(); };

  return (
    <div className="container">
      <Head>
        <title>Soporte — CABURE.STORE</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Soporte</h1>
        <div className="row" style={{ gap: 8 }}>
          {!session ? (
            <button className="btn" onClick={login} aria-label="Ingresar con Google">Ingresar</button>
          ) : (
            <button className="btn ghost" onClick={logout}>Salir</button>
          )}
        </div>
      </div>

      {!session ? (
        <section className="card" style={{ padding: 16, marginTop: 12 }}>
          <p>Ingresá para abrir el chat de soporte con nuestro equipo.</p>
          <button className="btn" onClick={login}>Ingresar con Google</button>
        </section>
      ) : loading ? (
        <section className="card" style={{ padding: 16, marginTop: 12 }}>
          <div className="skeleton" style={{ height: 80 }} />
        </section>
      ) : threadId ? (
        <section className="card" style={{ padding: 8, marginTop: 12 }}>
          <ChatBox threadId={threadId} />
        </section>
      ) : (
        <section className="card" style={{ padding: 16, marginTop: 12 }}>
          <div className="empty">No se pudo abrir un ticket de soporte.</div>
        </section>
      )}

      <style jsx>{`
        .container { padding: 16px; }
        .row { display: flex; align-items: center; }
        .card { border:1px solid #1a1a1a; border-radius:14px; background:#0a0a0a; }
        .btn { padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#161616; color:#fff; cursor:pointer; white-space:nowrap; }
        .btn.ghost { background:#0f0f0f; }
        .skeleton { background:linear-gradient(90deg,#0f0f0f,#151515,#0f0f0f); animation:pulse 1.5s infinite; border-radius:12px; }
        @keyframes pulse { 0%{opacity:.6} 50%{opacity:1} 100%{opacity:.6} }
        .empty { padding:14px; text-align:center; border:1px dashed #2a2a2a; border-radius:12px; margin:8px; }
      `}</style>
    </div>
  );
}
