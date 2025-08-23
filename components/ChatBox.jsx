// components/ChatBox.jsx
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ChatBox({ threadId, adminView = false }) {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const listRef = useRef(null);

  // sesión
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setSession(data?.session ?? null);
      } catch {}
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  // cargar y suscribir
  useEffect(() => {
    if (!threadId) return;
    let mounted = true;

    async function load() {
      setError("");
      try {
        const { data, error } = await supabase
          .from("support_messages")
          .select("id, sender_role, message, created_at")
          .eq("thread_id", threadId)
          .order("created_at", { ascending: true });
        if (error) throw error;
        if (!mounted) return;
        setMessages(data || []);
        // autoscroll
        setTimeout(() => {
          listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight, behavior: "auto" });
        }, 0);
      } catch (e) {
        setMessages([]);
        setError(e.message || "No se pudieron cargar los mensajes.");
      }
    }

    load();

    const channel = supabase
      .channel(`chat-${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          setMessages((prev) => {
            const arr = Array.isArray(prev) ? prev.slice() : [];
            arr.push(payload.new);
            return arr;
          });
          setTimeout(() => {
            listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight, behavior: "smooth" });
          }, 0);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  async function send(e) {
    e.preventDefault();
    if (!text.trim() || !threadId) return;
    const body = {
      thread_id: threadId,
      sender_role: adminView ? "admin" : "user",
      message: text.trim(),
    };
    // Optimistic
    const temp = {
      id: `tmp-${Date.now()}`,
      ...body,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => ([...(prev || []), temp]));
    setText("");

    const { error } = await supabase.from("support_messages").insert(body);
    if (error) {
      setError(error.message || "No se pudo enviar el mensaje.");
      // revertir si falla (opcional)
      setMessages((prev) => (prev || []).filter((m) => m.id !== temp.id));
    }
  }

  return (
    <div className="card" style={{ padding: 12, display: "flex", flexDirection: "column", height: 420 }}>
      <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: 8, border: "1px solid var(--border)", borderRadius: 8, background: "#0E1012" }}>
        {!messages ? (
          <div className="skel" style={{ height: 80 }} />
        ) : messages.length === 0 ? (
          <div style={{ opacity: 0.8 }}>Todavía no hay mensajes.</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} style={{ marginBottom: 8, display: "flex", justifyContent: m.sender_role === "admin" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "80%",
                background: m.sender_role === "admin" ? "#1F2937" : "#111827",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "8px 10px",
                fontSize: 14
              }}>
                <div style={{ opacity: 0.7, fontSize: 11, marginBottom: 4 }}>{m.sender_role}</div>
                <div>{m.message}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {error && <div className="card" style={{ marginTop: 8, padding: 8, border: "1px solid #a33" }}>{error}</div>}

      <form onSubmit={send} className="row" style={{ gap: 8, marginTop: 8 }}>
        <input
          className="input"
          placeholder="Escribí tu mensaje…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Mensaje"
        />
        <button className="btn" type="submit" disabled={!threadId || !text.trim()}>
          Enviar
        </button>
      </form>
    </div>
  );
}
