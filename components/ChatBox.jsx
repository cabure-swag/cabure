// components/ChatBox.jsx
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * ChatBox reutilizable (cliente y admin)
 * Props:
 * - threadId (uuid)       -> id del hilo en support_threads
 * - adminView (boolean)   -> si true muestra "Admin" como emisor y puede cerrar hilo
 * - onCloseThread()       -> callback opcional luego de cerrar hilo
 */
export default function ChatBox({ threadId, adminView = false, onCloseThread }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [thread, setThread] = useState(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  // Cargar hilo y mensajes
  useEffect(() => {
    if (!threadId) return;
    (async () => {
      const { data: t } = await supabase
        .from("support_threads")
        .select("id, status, brand_id, created_at")
        .eq("id", threadId)
        .maybeSingle();
      setThread(t || null);

      const { data: msgs } = await supabase
        .from("support_messages")
        .select("id, thread_id, sender_role, message, created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      setMessages(msgs || []);
      // scroll
      setTimeout(() => {
        listRef.current?.lastElementChild?.scrollIntoView({ behavior: "smooth" });
      }, 0);
    })();
  }, [threadId]);

  // Realtime: nuevos mensajes
  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`support_messages_thread_${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
          setTimeout(() => {
            listRef.current?.lastElementChild?.scrollIntoView({ behavior: "smooth" });
          }, 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  async function send() {
    const msg = text.trim();
    if (!msg || !threadId) return;
    setSending(true);
    try {
      const payload = {
        thread_id: threadId,
        sender_role: adminView ? "admin" : "user",
        message: msg,
      };
      const { error } = await supabase.from("support_messages").insert(payload);
      if (error) throw error;
      setText("");
    } catch (e) {
      alert(e.message || "No se pudo enviar el mensaje");
    } finally {
      setSending(false);
    }
  }

  async function closeThread() {
    if (!threadId) return;
    if (!confirm("¿Cerrar este ticket?")) return;
    const { error } = await supabase
      .from("support_threads")
      .update({ status: "closed" })
      .eq("id", threadId);
    if (error) {
      alert(error.message || "No se pudo cerrar el ticket (¿RLS admin?).");
      return;
    }
    setThread((t) => (t ? { ...t, status: "closed" } : t));
    onCloseThread?.();
  }

  async function deleteThread() {
    if (!threadId) return;
    if (!adminView) return alert("Solo admin puede eliminar un ticket.");
    if (!confirm("⚠️ Esto elimina DEFINITIVAMENTE el ticket y sus mensajes.\n¿Continuar?")) return;
    setSending(true);
    try {
      const { error: e1 } = await supabase.from("support_messages").delete().eq("thread_id", threadId);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("support_threads").delete().eq("id", threadId);
      if (e2) throw e2;
      onCloseThread?.(); // que el contenedor deje de mostrarlo
    } catch (e) {
      alert(e.message || "No se pudo eliminar el ticket. Revisá RLS admin.");
    } finally {
      setSending(false);
    }
  }

  const locked = thread?.status === "closed";

  return (
    <div className="chatbox">
      <div className="chatbox__head">
        <div className="row" style={{ gap: 8 }}>
          <h3 style={{ margin: 0 }}>Chat {adminView ? "(Admin)" : ""}</h3>
          <span className={`badge ${thread?.status || "open"}`}>{thread?.status || "open"}</span>
        </div>
        {adminView ? (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost" onClick={closeThread} disabled={locked}>
              Cerrar
            </button>
            <button className="btn danger" onClick={deleteThread}>
              Eliminar
            </button>
          </div>
        ) : null}
      </div>

      <div className="chatbox__list" ref={listRef}>
        {(messages || []).map((m) => (
          <div
            key={m.id}
            className={`msg ${m.sender_role === "admin" ? "msg--admin" : "msg--user"}`}
            title={new Date(m.created_at).toLocaleString()}
          >
            <div className="msg__from">{m.sender_role === "admin" ? "Admin" : "Vos"}</div>
            <div className="msg__body">{m.message}</div>
          </div>
        ))}
        {(!messages || messages.length === 0) && (
          <div className="empty">No hay mensajes. ¡Escribí el primero!</div>
        )}
      </div>

      <div className="chatbox__composer">
        <input
          className="inp"
          placeholder={locked ? "Ticket cerrado" : "Escribí tu mensaje…"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={sending || locked}
          aria-label="Mensaje"
        />
        <button className="btn" onClick={send} disabled={sending || locked}>
          Enviar
        </button>
      </div>

      <style jsx>{`
        .chatbox { display: grid; grid-template-rows: auto 1fr auto; gap: 8px; border:1px solid #1a1a1a; border-radius:14px; background:#0a0a0a; }
        .chatbox__head { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-bottom:1px solid #121212; }
        .chatbox__list { padding:12px; display:flex; flex-direction:column; gap:8px; max-height:42vh; overflow:auto; }
        .chatbox__composer { display:flex; gap:8px; padding:10px; border-top:1px solid #121212; }
        .inp { flex:1; padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#0f0f0f; color:#fff; }
        .btn { padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#161616; color:#fff; cursor:pointer; }
        .btn.ghost { background:#0f0f0f; }
        .btn.danger { background:#1c1313; border-color:#3a2222; }
        .row { display:flex; align-items:center; }
        .badge { padding:2px 8px; border-radius:999px; border:1px solid #333; font-size:.75rem; text-transform:lowercase; }
        .badge.open { background:#111127; color:#cdd6ff; border-color:#23234a; }
        .badge.closed { background:#2a1717; color:#f8b4b4; border-color:#422; }
        .msg { max-width: 80%; }
        .msg--user { align-self:flex-start; }
        .msg--admin { align-self:flex-end; text-align:right; }
        .msg__from { font-size:.7rem; opacity:.7; margin-bottom:2px; }
        .msg__body { background:#121212; border:1px solid #222; padding:8px 10px; border-radius:10px; }
        .empty { padding:14px; text-align:center; border:1px dashed #2a2a2a; border-radius:12px; margin:8px; }
      `}</style>
    </div>
  );
}
