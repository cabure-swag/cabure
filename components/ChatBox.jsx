// components/ChatBox.jsx
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function fmtDate(ts) {
  try { return new Date(ts).toLocaleString("es-AR", { hour12: false }); } catch { return ts; }
}

/**
 * Chat neutral (cliente o staff).
 * - Si el usuario logueado === buyer => sender_role = 'user'
 * - Caso contrario => sender_role = 'admin' (vendedor/admin)
 * Staff ve botón "Cerrar hilo".
 */
export default function ChatBox({ threadId }) {
  const [session, setSession] = useState(null);
  const [thread, setThread] = useState(null);     // { id, user_id, brand_id, status }
  const [brand, setBrand] = useState(null);       // { id, name }
  const [buyer, setBuyer] = useState(null);       // { user_id, email, name }
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const listRef = useRef(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!threadId) return;
    let cancelled = false;
    (async () => {
      const { data: t } = await supabase
        .from("support_threads")
        .select("id,user_id,brand_id,status,created_at")
        .eq("id", threadId)
        .maybeSingle();
      if (!t || cancelled) return;
      setThread(t);

      if (t.brand_id) {
        const { data: b } = await supabase.from("brands").select("id,name").eq("id", t.brand_id).maybeSingle();
        if (!cancelled) setBrand(b || null);
      } else { setBrand(null); }

      const { data: p } = await supabase
        .from("profiles")
        .select("user_id,email,full_name,name")
        .eq("user_id", t.user_id)
        .maybeSingle();
      const buyerName = p?.full_name || p?.name || null;
      const buyerEmail = p?.email || null;
      setBuyer({ user_id: t.user_id, name: buyerName, email: buyerEmail });

      const { data: ms } = await supabase
        .from("support_messages")
        .select("id, sender_role, message, created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (!cancelled) setMessages(ms || []);
    })();
    return () => { cancelled = true; };
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return;
    const ch = supabase
      .channel(`support_messages_${threadId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "support_messages", filter: `thread_id=eq.${threadId}` },
        (payload) => { if (payload.eventType === "INSERT") setMessages(prev => [...prev, payload.new]); }
      ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [threadId]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const isBuyer = !!(session?.user?.id && thread?.user_id && session.user.id === thread.user_id);
  const isClosed = thread?.status === "closed";

  function labelFor(msg) {
    if (msg.sender_role === "user") return buyer?.name || buyer?.email || "Cliente";
    return brand?.name || "Marca";
  }

  async function send(e) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || !threadId || isClosed) return;

    const sender_role = isBuyer ? "user" : "admin";
    const tmp = { id: `tmp_${Date.now()}`, sender_role, message: body, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, tmp]);
    setText("");

    const { error } = await supabase
      .from("support_messages")
      .insert({ thread_id: threadId, sender_role, message: body });

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tmp.id));
      alert("No se pudo enviar el mensaje.");
      setText(body);
    }
  }

  async function closeThread() {
    if (!threadId || isBuyer || isClosed) return; // solo staff
    if (!confirm("¿Cerrar este hilo?")) return;
    setClosing(true);
    const { error, data } = await supabase
      .from("support_threads")
      .update({ status: "closed" })
      .eq("id", threadId)
      .select("status")
      .maybeSingle();
    setClosing(false);
    if (error) { alert(error.message || "No se pudo cerrar el hilo."); return; }
    setThread(t => ({ ...t, status: data?.status || "closed" }));
  }

  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="row" style={{ alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0 }}>Chat</h3>
          {!!brand?.name && <div style={{ color: "#9aa", fontSize: 12 }}>{brand.name}</div>}
        </div>
        <div style={{ flex: 1 }} />
        {!isBuyer && (
          <button
            className="btn btn-ghost"
            onClick={closeThread}
            disabled={isClosed || closing}
            aria-label="Cerrar hilo"
            title="Cerrar hilo"
          >
            {isClosed ? "Cerrado" : (closing ? "Cerrando…" : "Cerrar hilo")}
          </button>
        )}
      </div>

      <div ref={listRef} style={{
        marginTop: 12, height: 360, overflowY: "auto",
        padding: 8, border: "1px solid var(--border)", borderRadius: 10, background: "var(--panel)"
      }}>
        {messages.length === 0 ? (
          <div style={{ color: "#9aa", fontSize: 14 }}>No hay mensajes aún.</div>
        ) : messages.map(m => {
          const me = isBuyer ? (m.sender_role === "user") : (m.sender_role !== "user");
          return (
            <div key={m.id} style={{ marginBottom: 10, display: "flex", flexDirection: "column", alignItems: me ? "flex-end" : "flex-start" }}>
              <div style={{ fontSize: 11, color: "#9aa", marginBottom: 2 }}>
                {labelFor(m)} · {fmtDate(m.created_at)}
              </div>
              <div style={{
                maxWidth: "85%",
                background: me ? "var(--brand)" : "#111",
                color: me ? "#000" : "var(--text)",
                border: "1px solid var(--border)",
                padding: "8px 10px",
                borderRadius: 10,
                whiteSpace: "pre-wrap"
              }}>
                {m.message}
              </div>
            </div>
          );
        })}
      </div>

      <form className="row" onSubmit={send} style={{ marginTop: 10, gap: 8 }}>
        <input
          className="input"
          placeholder={isClosed ? "Hilo cerrado" : "Escribí un mensaje…"}
          value={text}
          onChange={e => setText(e.target.value)}
          aria-label="Mensaje"
          disabled={isClosed}
        />
        <button className="btn btn-primary" type="submit" disabled={isClosed}>Enviar</button>
      </form>
    </div>
  );
}
