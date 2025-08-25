// pages/soporte.jsx
import Head from "next/head";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import ChatBox from "@/components/ChatBox";

export default function Soporte(){
  const router = useRouter();
  const requestedThread = router.query.thread || null;

  const [session, setSession] = useState(null);
  const [threadId, setThreadId] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    (async () => {
      if (requestedThread) {
        const { data: t } = await supabase
          .from("support_threads")
          .select("id,user_id,status")
          .eq("id", requestedThread)
          .maybeSingle();
        if (t && t.user_id === session.user.id) {
          setThreadId(t.id);
          return;
        }
      }
      const user_id = session.user.id;
      let { data: t } = await supabase
        .from("support_threads")
        .select("id").eq("user_id", user_id).eq("status", "open")
        .maybeSingle();
      if (!t) {
        const { data } = await supabase
          .from("support_threads")
          .insert({ user_id, status:"open" })
          .select("id")
          .maybeSingle();
        t = data;
      }
      setThreadId(t?.id || null);
    })();
  }, [session, requestedThread]);

  const login = async () => { await supabase.auth.signInWithOAuth({ provider: "google" }); };

  return (
    <div className="container">
      <Head><title>Chat con el vendedor — CABURE.STORE</title></Head>

      {!session ? (
        <div className="status-empty">
          <p>Ingresá para abrir el chat.</p>
          <button className="btn btn-primary" onClick={login} aria-label="Ingresar con Google">Ingresar con Google</button>
        </div>
      ) : (
        <>
          <div className="row" style={{justifyContent:"space-between", alignItems:"center"}}>
            <h1>Chat con el vendedor</h1>
          </div>
          {threadId ? (
            <ChatBox threadId={threadId} />
          ) : (
            <div className="status-loading skeleton" style={{height:80}}/>
          )}
        </>
      )}
    </div>
  );
}
