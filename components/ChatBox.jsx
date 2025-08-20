import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "./Toast";

export default function ChatBox({ threadId, adminView=false, onCloseThread }){
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [thread, setThread] = useState(null);
  const scrollerRef = useRef();
  const { push } = useToast();

  useEffect(() => {
    (async () => {
      const { data: t } = await supabase.from('support_threads').select('*').eq('id', threadId).single();
      setThread(t);
      const { data: ms } = await supabase.from('support_messages').select('*').eq('thread_id', threadId).order('created_at', { ascending: true });
      setMessages(ms || []);
    })();
  }, [threadId]);

  useEffect(() => {
    const channel = supabase
      .channel(`support_messages:${threadId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages', filter: `thread_id=eq.${threadId}` }, (payload) => {
        setMessages(prev => {
          const copy = [...prev];
          if (payload.eventType === 'INSERT') copy.push(payload.new);
          return copy;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId]);

  useEffect(() => {
    scrollerRef.current?.scrollTo(0, 1e9);
  }, [messages.length]);

  const send = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return push("Necesitás ingresar para chatear");
    const sender_role = adminView ? 'admin' : 'user';
    const optimistic = { id: Math.random(), thread_id: threadId, sender_role, message: input, created_at: new Date().toISOString() };
    setMessages(m => [...m, optimistic]);
    setInput("");
    const { error } = await supabase.from('support_messages').insert({ thread_id: threadId, sender_role, message: optimistic.message });
    if (error) push("Error al enviar mensaje");
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <div className="card" style={{height: 420, display:'flex', flexDirection:'column'}}>
      <div className="card-body" style={{flex:1, overflow:'auto'}} ref={scrollerRef}>
        {messages.map((m) => (
          <div key={m.id} style={{ display:'flex', justifyContent: m.sender_role==='admin' ? 'flex-end' : 'flex-start', marginBottom:8 }}>
            <div style={{ background:m.sender_role==='admin'?'#0f172a':'#111827', border:'1px solid #1f2937', padding:'8px 10px', borderRadius:12, maxWidth:'80%'}}>
              <div style={{fontSize:12, color:'var(--muted)'}}>{m.sender_role==='admin'?'Admin':'Cliente'}</div>
              <div>{m.message}</div>
            </div>
          </div>
        ))}
        {messages.length===0 && <div className="status-empty">No hay mensajes todavía.</div>}
      </div>
      <div style={{padding:12, borderTop:'1px solid #1f2937'}}>
        <textarea aria-label="Escribe tu mensaje" className="input" rows={2} placeholder="Escribe un mensaje…" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey}/>
        <div className="row" style={{justifyContent:'space-between', marginTop:8}}>
          {adminView && thread?.status==='open' && <button className="btn btn-ghost" onClick={onCloseThread}>Cerrar ticket</button>}
          <div style={{flex:1}} />
          <button className="btn btn-primary" onClick={send} aria-label="Enviar">Enviar</button>
        </div>
      </div>
    </div>
  );
}