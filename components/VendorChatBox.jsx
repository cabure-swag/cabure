import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function VendorChatBox({ threadId, senderRole = "vendor" }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [closing, setClosing] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!threadId) return;
    let mounted = true;

    async function load() {
      const { data, error } = await supabase
        .from("vendor_messages")
        .select("id,thread_id,sender_role,message,created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (!error && mounted) setMessages(data || []);
    }
    load();

    const channel = supabase
      .channel(`vm:${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "vendor_messages", filter: `thread_id=eq.${threadId}` },
        (payload) => setMessages((prev) => [...prev, payload.new])
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages.length]);

  async function send() {
    const text = input.trim();
    if (!text || !threadId) return;
    setInput("");
    // Optimistic UI
    const temp = { id: `temp-${Date.now()}`, thread_id: threadId, sender_role: senderRole, message: text, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, temp]);

    const { error } = await supabase.from("vendor_messages").insert({
      thread_id: threadId,
      sender_role: senderRole, // 'vendor' en panel vendedor
      message: text
    });
    if (error) {
      alert("No se pudo enviar el mensaje");
      // revertir
      setMessages((prev) => prev.filter((m) => m.id !== temp.id));
      setInput(text);
    }
  }

  async function closeThread() {
    if (!threadId) return;
    if (!confirm("¿Cerrar este hilo?")) return;
    setClosing(true);
    const { error } = await supabase
      .from("vendor_threads")
      .update({ status: "closed" })
      .eq("id", threadId);
    setClosing(false);
    if (error) alert("No se pudo cerrar el hilo");
    else alert("Hilo cerrado");
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="chat">
      <div className="head">
        <h3>Chat con cliente</h3>
        <button className="btn ghost" onClick={closeThread} disabled={closing}>
          {closing ? "Cerrando…" : "Cerrar hilo"}
        </button>
      </div>

      <div className="list" ref={scrollRef}>
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.sender_role === "vendor" || m.sender_role === "admin" ? "me" : ""}`}>
            <div className="bubble">
              <div className="meta">{m.sender_role}</div>
              <div>{m.message}</div>
            </div>
          </div>
        ))}
        {messages.length === 0 && <div className="empty">Sin mensajes aún.</div>}
      </div>

      <div className="composer">
        <textarea
          placeholder="Escribí un mensaje…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
        />
        <button className="btn primary" onClick={send}>Enviar</button>
      </div>

      <style jsx>{`
        .chat { display:flex; flex-direction:column; gap:10px; background:#0c0c0c; border:1px solid #1f1f1f; border-radius:16px; padding:12px; }
        .head { display:flex; align-items:center; justify-content:space-between; }
        .list { height: 40vh; overflow:auto; background:#0a0a0a; border:1px solid #1a1a1a; border-radius:12px; padding:10px; }
        .empty { opacity:.8; text-align:center; padding:12px; }
        .msg { display:flex; margin:8px 0; }
        .msg.me { justify-content:flex-end; }
        .bubble { background:#121212; border:1px solid #222; color:#eee; border-radius:12px; padding:8px 10px; max-width:70%; }
        .msg.me .bubble { background:#171717; border-color:#2a2a2a; }
        .meta { font-size:.75rem; opacity:.7; margin-bottom:4px; text-transform:uppercase; }
        .composer { display:flex; gap:8px; }
        textarea { flex:1; background:#0f0f0f; color:#fff; border:1px solid #2a2a2a; border-radius:10px; padding:10px; resize:none; height:60px; }
        .btn { padding:10px 12px; border-radius:10px; border:1px solid #2a2a2a; background:#161616; color:#fff; cursor:pointer; }
        .btn.ghost { background:transparent; }
        .btn.primary { background:#1e1e1e; border-color:#3a3a3a; }
      `}</style>
    </div>
  );
}
