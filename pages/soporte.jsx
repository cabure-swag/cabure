import Head from "next/head";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ChatBox from "@/components/ChatBox";
import { useToast } from "@/components/Toast";

export default function Soporte(){
  const [session, setSession] = useState(null);
  const [threadId, setThreadId] = useState(null);
  const { push } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => { listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const user_id = session.user.id;
      let { data: t } = await supabase.from('support_threads').select('id').eq('user_id', user_id).eq('status','open').maybeSingle();
      if (!t) {
        const { data, error } = await supabase.from('support_threads').insert({ user_id }).select('id').maybeSingle();
        if (error) return push('No se pudo abrir soporte');
        t = data;
      }
      setThreadId(t.id);
    })();
  }, [session]);

  const login = async () => {
    await supabase.auth.signInWithOAuth({ provider:'google' });
  };
  const logout = async () => { await supabase.auth.signOut(); };

  return (
    <div className="container">
      <Head><title>Soporte — CABURE.STORE</title></Head>
      {!session ? (
        <div className="status-empty">
          <p>Ingresá para abrir el chat de soporte.</p>
          <button className="btn btn-primary" onClick={login} aria-label="Ingresar con Google">Ingresar con Google</button>
        </div>
      ) : (
        <>
          <div className="row" style={{justifyContent:'space-between'}}>
            <h1>Soporte</h1>
            <button className="btn btn-ghost" onClick={logout}>Salir</button>
          </div>
          {threadId ? <ChatBox threadId={threadId} /> : <div className="status-loading skeleton" style={{height:80}}/>}
        </>
      )}
    </div>
  );
}