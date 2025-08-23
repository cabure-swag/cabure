// pages/soporte.jsx
import React, { useEffect, useState } from "react";
import Head from "next/head";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import ChatBox from "@/components/ChatBox";

function SoporteInner() {
  const [session, setSession] = useState(null);
  const [threadId, setThreadId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!alive) return;
        setSession(data?.session ?? null);
      } catch {}
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) { setThreadId(null); return; }
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const user_id = session.user.id;
        // buscar hilo abierto
        let { data: t, error } = await supabase
          .from("support_threads")
          .select("id")
          .eq("user_id", user_id)
          .eq("status","open")
          .maybeSingle();
        if (error) throw error;
        if (!t) {
          const { data, error: e2 } = await supabase
            .from("support_threads")
            .insert({ user_id })
            .select("id")
            .maybeSingle();
          if (e2) throw e2;
          t = data;
        }
        setThreadId(t?.id || null);
      } catch (e) {
        setErr(e.message || "No se pudo abrir soporte.");
        setThreadId(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [session?.user?.id]);

  async function login() {
    try {
      await supabase.auth.signInWithOAuth({ provider:"google" });
    } catch (e) { alert(e.message || "No se pudo iniciar sesión."); }
  }
  async function logout() {
    try { await supabase.auth.signOut(); } catch {}
  }

  return (
    <div className="container">
      <Head><title>Soporte — CABURE.STORE</title></Head>

      {!session ? (
        <div className="status-empty card" style={{ padding: 24 }}>
          <h1>Soporte</h1>
          <p>Ingresá para abrir el chat de soporte.</p>
          <button className="btn" onClick={login} aria-label="Ingresar con Google">Ingresar con Google</button>
        </div>
      ) : (
        <>
          <div className="row" style={{ justifyContent:"space-between", alignItems:"center" }}>
            <h1 style={{ margin: 0 }}>Soporte</h1>
            <button className="btn ghost" onClick={logout}>Salir</button>
          </div>

          {err && <div className="card" style={{ padding: 12, border: "1px solid #a33", marginTop: 12 }}>{err}</div>}

          {loading ? (
            <div className="status-loading skeleton" style={{ height: 80, marginTop: 12 }} />
          ) : threadId ? (
            <div style={{ marginTop: 12 }}>
              <ChatBox threadId={threadId} />
            </div>
          ) : (
            <div className="card" style={{ padding: 16, marginTop: 12 }}>
              No se pudo iniciar el chat. Probá nuevamente.
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default dynamic(() => Promise.resolve(SoporteInner), { ssr: false });
