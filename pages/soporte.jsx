// pages/soporte.jsx
import React, { useEffect, useState } from "react";
import Head from "next/head";
import { supabase } from "@/lib/supabaseClient";
import ChatBox from "@/components/ChatBox";
import { useToast } from "@/components/Toast";

export default function Soporte() {
  const [session, setSession] = useState(null);
  const [threadId, setThreadId] = useState(null);

  // useToast puede ser null en SSR; usamos fallback no-op
  const toast = useToast();
  const push = toast?.push ?? (() => {});

  // Obtener sesión y escuchar cambios de auth
  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) setSession(data.session ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      if (isMounted) setSession(s);
    });

    return () => {
      isMounted = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  // Crear o reabrir hilo de soporte
  useEffect(() => {
    if (!session) return;

    (async () => {
      const user_id = session.user.id;

      // Buscar hilo abierto
      let { data: t, error: selErr } = await supabase
        .from("support_threads")
        .select("id")
        .eq("user_id", user_id)
        .eq("status", "open")
        .maybeSingle();

      if (selErr) {
        push("No se pudo abrir soporte");
        return;
      }

      // Si no hay, crear uno
      if (!t) {
        const { data, error } = await supabase
          .from("support_threads")
          .insert({ user_id })
          .select("id")
          .maybeSingle();

        if (error) {
          push("No se pudo abrir soporte");
          return;
        }
        t = data;
      }

      setThreadId(t?.id ?? null);
    })();
  }, [session, push]);

  const login = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setThreadId(null);
  };

  return (
    <div className="container">
      <Head>
        <title>Soporte — CABURE.STORE</title>
        <meta name="robots" content="noindex" />
      </Head>

      {!session ? (
        <div className="card" role="status" style={{ padding: 24 }}>
          <p style={{ marginBottom: 12 }}>Ingresá para abrir el chat de soporte.</p>
          <button className="btn" onClick={login} aria-label="Ingresar con Google">
            Ingresar con Google
          </button>
        </div>
      ) : (
        <>
          <div
            className="row"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}
          >
            <h1>Soporte</h1>
            <button className="btn secondary" onClick={logout}>
              Salir
            </button>
          </div>

          {threadId ? (
            <ChatBox threadId={threadId} />
          ) : (
            <div className="skel" style={{ height: 80, borderRadius: 12 }} />
          )}
        </>
      )}
    </div>
  );
}

// Forzamos SSR para evitar el prerender/export de esta página (previene errores en build)
export async function getServerSideProps() {
  return { props: {} };
}
