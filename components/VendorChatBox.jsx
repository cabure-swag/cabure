import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * VendorChatBox
 * Props:
 *  - threadId (uuid)  // requerido
 *  - senderRole: "user" | "vendor" | "admin"  // etiqueta en los mensajes
 */
export default function VendorChatBox({ threadId, senderRole = "user" }) {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const viewportRef = useRef(null);
  const chanRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s || null));
    return () => sub?.subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    if (!threadId) return;

    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("vendor_messages")
        .select("id,thread_id,sender_role,message,created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      if (mounted) setMessages(data || []);
    })();

    // Realtime
    const chan = supabase
      .channel(`vm_${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "vendor_messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          setMessages((m) => [...m, payload.new]);
          scrollDown();
        }
      )
      .subscribe();

    chanRef.current = chan;
    return () => {
      mounted = false;
      if (chanRef.current) supabase.removeChannel(chanRef.current);
    };
  }, [threadId]);

  useEffect(() => {
    scrollDown();
  }, [messages.length]);

  function scrollDown() {
    try {
      const el = viewportRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    } catch {}
  }

  async function sendMsg(e) {
    e?.preventDefault?.();
    const body = text.trim();
    if (!body || !session?.user?.id || !threadId) return;

    const optimistic = {
      id: `tmp_${Date.now()}`,
      thread_id: threadId,
      sender_role: senderRole,
      message: body,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    setMessages((m) => [...m, optimistic]);
    setText("");
    scrollDown();

    const { error } = await supabase
      .from("vendor_messages")
      .insert({ thread_id: threadId, sender_role: senderRole, message: body });

    if (error) {
      // revert
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      alert("No se pudo enviar el mensaje.");
    }
  }

  return (
    <div className="chat">
      <div className="viewport" ref={viewportRef}>
        {(messages || []).map((m) => (
          <div key={m.id} className={`msg ${m.sender_role}`}>
            <div className="bubble">
              <div className="meta">
                <span className="role">{label(m.sender_role)}</span>
                <span className="time">{new Date(m.created_at).toLocaleString()}</span>
              </div>
              <div>{m.message}</div>
            </div>
          </div>
        ))}
        {(messages || []).length === 0 && (
          <div className="empty">Empezá la conversación…</div>
        )}
      </div>

      <form className="composer" onSubmit={sendMsg}>
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribí un mensaje…"
          aria-label="Mensaje"
        />
        <button className="btn" type="submit">Enviar</button>
      </form>

      <style jsx>{`
        .chat { display:grid; grid-template-rows: 1fr auto; height: 60vh; }
        .viewport { overflow: auto; padding: 8px; background:#0a0a0a; border:1px solid #1a1a1a; border-radius:12px; }
        .empty { padding:12px; text-align:center; opacity:.8; }
        .msg { display:flex; margin:8px 0; }
        .msg.user { justify-content:flex-end; }
        .msg.vendor { justify-content:flex-start; }
        .msg.admin { justify-content:center; }
        .bubble { max-width: 86%; background:#141414; border:1px solid #222; border-radius:12px; padding:8px 10px; color:#fff; }
        .meta { font-size:.8rem; opacity:.8; margin-bottom:4px; display:flex; gap:8px; }
        .composer { display:flex; gap:8px; margin-top:8px; }
        .input { flex:1; padding:10px 12px; border-radius:10px; border:1px solid #2a2a2a; background:#0f0f0f; color:#fff; }
        .btn { padding:10px 12px; border-radius:10px; border:1px solid #2a2a2a; background:#161616; color:#fff; cursor:pointer; }
      `}</style>
    </div>
  );
}

function label(r) {
  if (r === "vendor") return "Vendedor";
  if (r === "admin") return "Admin";
  return "Cliente";
}
