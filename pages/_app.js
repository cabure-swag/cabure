// pages/_app.js
import React, { useEffect, useState, useRef } from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import "@/styles/globals.css";
import { supabase } from "@/lib/supabaseClient";

// Hook: cerrar menú al click afuera
function useClickAway(ref, onAway) {
  useEffect(() => {
    function handler(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) onAway?.();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onAway]);
}

function Header({ isAdmin, session }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  useClickAway(menuRef, () => setOpen(false));

  const userName =
    session?.user?.user_metadata?.full_name ||
    session?.user?.user_metadata?.name ||
    session?.user?.email ||
    null;

  // LOGIN — siempre volver al MISMO dominio (preview o prod)
  const signInWithGoogle = async () => {
    setOpen(false);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/soporte`
            : undefined,
      },
    });
  };

  const logout = async () => {
    setOpen(false);
    await supabase.auth.signOut();
  };

  return (
    <header className="header" role="banner">
      <div className="header-inner container" style={{ gap: 12, display: "flex", alignItems: "center" }}>
        {/* IZQUIERDA: CABURE.STORE */}
        <Link href="/" className="brand" aria-label="Ir al inicio CABURE.STORE">
          <Image src="/cabure-logo.png" alt="" width={28} height={28} priority />
          <span>CABURE.STORE</span>
        </Link>

        {/* ESPACIADOR */}
        <div style={{ flex: 1 }} />

        {/* DERECHA: sesión / admin */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isAdmin && (
            <Link className="btn secondary" href="/admin" aria-label="Ir a admin">
              Admin
            </Link>
          )}

          {/* NO logueado → botón Iniciar sesión con menú (Google por ahora) */}
          {!session && (
            <div ref={menuRef} style={{ position: "relative" }}>
              <button
                className="btn ghost"
                aria-haspopup="menu"
                aria-expanded={open ? "true" : "false"}
                onClick={() => setOpen((v) => !v)}
              >
                Iniciar sesión
              </button>

              {open && (
                <div
                  role="menu"
                  aria-label="Opciones de inicio de sesión"
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 8px)",
                    background: "var(--surface, #111316)",
                    border: "1px solid rgba(255,255,255,.12)",
                    borderRadius: 12,
                    padding: 8,
                    minWidth: 220,
                    boxShadow: "0 8px 24px rgba(0,0,0,.35)",
                    zIndex: 50,
                  }}
                >
                  <button
                    className="btn"
                    style={{ width: "100%" }}
                    onClick={signInWithGoogle}
                    role="menuitem"
                    aria-label="Continuar con Google"
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <svg width="18" height="18" viewBox="0 0 533.5 544.3" aria-hidden="true">
                        <path fill="#4285F4" d="M533.5 278.4c0-18.5-1.7-36.3-4.9-53.6H272v101.4h147.1c-6.4 34.6-25.9 63.9-55.2 83.6v69.4h89.3c52.2-48.1 80.3-119 80.3-200.8z"/>
                        <path fill="#34A853" d="M272 544.3c73 0 134.3-24.2 179.1-65.5l-89.3-69.4c-24.8 16.7-56.5 26.6-89.8 26.6-69 0-127.5-46.6-148.5-109.2H31v68.5C75.9 495.3 168.8 544.3 272 544.3z"/>
                        <path fill="#FBBC05" d="M123.5 326.8c-10.8-32.1-10.8-67.1 0-99.2V159H31c-40.8 81.5-40.8 178.8 0 260.3l92.5-92.5z"/>
                        <path fill="#EA4335" d="M272 107.7c37.4-.6 73.5 13.3 101 39.2l75.4-75.4C406.3 24.5 344.9 0 272 0 168.8 0 75.9 49 31 159l92.5 68.6C144.5 154.9 203 108.3 272 108.3z"/>
                      </svg>
                      Continuar con Google
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Logueado → nombre + menú (Soporte / Cerrar sesión) */}
          {session && (
            <div ref={menuRef} style={{ position: "relative" }}>
              <button
                className="btn ghost"
                aria-haspopup="menu"
                aria-expanded={open ? "true" : "false"}
                onClick={() => setOpen((v) => !v)}
              >
                {userName || "Mi cuenta"}
              </button>
              {open && (
                <div
                  role="menu"
                  aria-label="Menú de cuenta"
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 8px)",
                    background: "var(--surface, #111316)",
                    border: "1px solid rgba(255,255,255,.12)",
                    borderRadius: 12,
                    padding: 8,
                    minWidth: 220,
                    boxShadow: "0 8px 24px rgba(0,0,0,.35)",
                    zIndex: 50,
                  }}
                >
                  <Link
                    href="/soporte"
                    role="menuitem"
                    className="btn secondary"
                    style={{ width: "100%", marginBottom: 8, display: "inline-flex", justifyContent: "center" }}
                    onClick={() => setOpen(false)}
                  >
                    Soporte
                  </Link>
                  <button
                    className="btn ghost"
                    role="menuitem"
                    style={{ width: "100%" }}
                    onClick={logout}
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default function MyApp({ Component, pageProps }) {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Cargar sesión + rol en cliente
  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data: sess } = await supabase.auth.getSession();
      const s = sess?.session ?? null;
      if (mounted) setSession(s);

      if (s?.user?.id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", s.user.id)
          .maybeSingle();
        if (mounted) setIsAdmin(prof?.role === "admin");
      } else {
        if (mounted) setIsAdmin(false);
      }
    }
    load();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!mounted) return;
      setSession(s);
      (async () => {
        if (s?.user?.id) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("role")
            .eq("user_id", s.user.id)
            .maybeSingle();
          setIsAdmin(prof?.role === "admin");
        } else {
          setIsAdmin(false);
        }
      })();
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  return (
    <>
      <Head>
        <title>CABURE.STORE</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="dark" />
        <meta name="theme-color" content="#0e0e0e" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/site.webmanifest" />
        {process.env.NEXT_PUBLIC_SITE_URL && (
          <link rel="canonical" href={process.env.NEXT_PUBLIC_SITE_URL} />
        )}
      </Head>

      <Header isAdmin={isAdmin} session={session} />

      <main className="container">
        <Component {...pageProps} />
      </main>
    </>
  );
}
