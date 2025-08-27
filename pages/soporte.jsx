// pages/soporte.jsx
import Head from "next/head";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ChatBox from "@/components/ChatBox";

export default function Soporte() {
  const [session, setSession] = useState(null);
  const [threadId, setThreadId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Estado para primer mensaje (creación diferida)
  const [firstMsg, setFirstMsg] = useState("");
  const [creating, setCreating] = useState(false);

  // sesión
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  // Buscar si ya existe un hilo abierto (NO crear)
  useEffect(() => {
    (async () => {
      if (!session?.user?.id) { setThreadId(null); setLoading(false); return; }
      setLoading(true);
      const uid = session.user.id;

      const { data: tOpen, error } = await supabase
        .from("support_threads")
        .select("id")
        .eq("user_id", uid)
        .eq("status", "open")
        .is("brand_id", null) // soporte general
        .maybeSingle();

      if (error) {
        console.warn("Error buscando hilo:", error.message);
      }
      setThreadId(tOpen?.id || null);
      setLoading(false);
    })();
  }, [session?.user?.id]);

  // Auth
  const login = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  };
  const logout = async () => { await supabase.auth.signOut(); };

  // Crear hilo + primer mensaje (solo cuando el usuario realmente envía)
  async function createThreadAndSend() {
    const msg = firstMsg.trim();
    if (!msg) return;
    if (!session?.user?.id) {
      alert("Necesitás iniciar sesión para enviar mensajes.");
      return;
    }
    setCreating(true);
    try {
      const uid = session.user.id;

      // crear hilo
      const { data: t, error: e1 } = await supabase
        .from("support_threads")
        .insert({ user_id: uid, brand_id: null, status: "open" })
        .select("id")
        .maybeSingle();

      if (e1) throw e1;
      if (!t?.id) throw new Error("No se pudo crear el ticket.");

      // insertar primer mensaje
      const payload = { thread_id: t.id, sender_role: "user", message: msg };
      const { error: e2 } = await supabase.from("support_messages").insert(payload);
      if (e2) throw e2;

      setThreadId(t.id);
      setFirstMsg("");
    } catch (err) {
      alert(err.message || "No se pudo abrir el ticket de soporte.");
    } finally {
      setCreating(false);
    }
  }

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
          <p>Ingresá para chatear con soporte. No se abrirán tickets hasta que envíes tu primer mensaje.</p>
          <button className="btn" onClick={login}>Ingresar con Google</button>
        </section>
      ) : loading ? (
        <section className="card" style={{ padding: 16, marginTop: 12 }}>
          <div className="skeleton" style={{ height: 80 }} />
        </section>
      ) : threadId ? (
        // Si ya hay hilo abierto, mostramos el chat normalmente
        <section className="card" style={{ padding: 8, marginTop: 12 }}>
          <ChatBox threadId={threadId} />
        </section>
      ) : (
        // Si NO hay hilo, mostramos un mini composer. Recién al enviar se crea el ticket.
        <section className="card" style={{ padding: 16, marginTop: 12 }}>
          <p style={{ marginTop: 0, opacity: 0.9 }}>
            Contanos brevemente en qué te podemos ayudar. Al enviar, se abrirá tu ticket de soporte.
          </p>
          <div className="row" style={{ gap: 8 }}>
            <input
              className="inp"
              placeholder="Escribí tu mensaje…"
              value={firstMsg}
              onChange={(e) => setFirstMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createThreadAndSend()}
              aria-label="Primer mensaje a soporte"
            />
            <button className="btn" onClick={createThreadAndSend} disabled={creating || !firstMsg.trim()}>
              {creating ? "Creando…" : "Enviar"}
            </button>
          </div>
          <small style={{ display: "block", marginTop: 8, opacity: 0.7 }}>
            Consejo: intentá ser específico para poder ayudarte más rápido. 🙂
          </small>
        </section>
      )}

      <style jsx>{`
        .container { padding: 16px; }
        .row { display: flex; align-items: center; }
        .card { border:1px solid #1a1a1a; border-radius:14px; background:#0a0a0a; }
        .btn { padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#161616; color:#fff; cursor:pointer; white-space:nowrap; }
        .btn.ghost { background:#0f0f0f; }
        .inp { flex:1; padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#0f0f0f; color:#fff; }
        .skeleton { background:linear-gradient(90deg,#0f0f0f,#151515,#0f0f0f); animation:pulse 1.5s infinite; border-radius:12px; }
        @keyframes pulse { 0%{opacity:.6} 50%{opacity:1} 100%{opacity:.6} }
      `}</style>
    </div>
  );
}
