// pages/_app.js
import React, { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import ErrorBoundary from "@/components/ErrorBoundary";
import { supabase } from "@/lib/supabaseClient";
import "@/styles/globals.css";

function Header({ session, role }) {
  const email = session?.user?.email || "";

  async function login() {
    try {
      await supabase.auth.signInWithOAuth({ provider: "google" });
    } catch (e) {
      alert(e.message || "No se pudo iniciar sesión.");
    }
  }
  async function logout() {
    try { await supabase.auth.signOut(); } catch {}
  }

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
      <div className="container" style={{ display: "flex", alignItems: "center", height: 64 }}>
        <Link href="/" className="logo" aria-label="Ir al inicio" style={{ display:"flex", alignItems:"center", gap:8 }}>
          <Image src="/cabure-logo.png" width={28} height={28} alt="CABURE logo" />
          <span style={{ fontWeight: 700, letterSpacing: 0.3 }}>CABURE.STORE</span>
        </Link>

        <div style={{ flex: 1 }} />

        <nav style={{ display:"flex", gap: 8, alignItems:"center" }}>
          <Link className="btn ghost" href="/soporte">Soporte</Link>
          {role === "admin" && <Link className="btn ghost" href="/admin">Admin</Link>}
          {(role === "vendor" || role === "admin") && <Link className="btn ghost" href="/vendor">Vendor</Link>}
          {!session ? (
            <button className="btn" onClick={login} aria-label="Iniciar sesión">Iniciar sesión</button>
          ) : (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span className="chip" title={email}>{email || "Usuario"}</span>
              <button className="btn ghost" onClick={logout}>Salir</button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

function AppContent({ Component, pageProps }) {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        const s = data?.session ?? null;
        setSession(s);
        if (s?.user?.id) {
          const { data: prof } = await supabase.from("profiles").select("role").eq("user_id", s.user.id).maybeSingle();
          setRole(prof?.role ?? null);
        } else setRole(null);
      } catch {}
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      (async () => {
        if (s?.user?.id) {
          const { data: prof } = await supabase.from("profiles").select("role").eq("user_id", s.user.id).maybeSingle();
          setRole(prof?.role ?? null);
        } else setRole(null);
      })();
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  return (
    <>
      <Header session={session} role={role} />
      <main className="container" style={{ paddingTop: 16, paddingBottom: 32 }}>
        <Component {...pageProps} session={session} role={role} />
      </main>
      <footer style={{ borderTop:"1px solid var(--border)" }}>
        <div className="container" style={{ padding:"16px 0", fontSize:12, opacity:0.7 }}>
          © {new Date().getFullYear()} CABURE.STORE
        </div>
      </footer>
    </>
  );
}

// ⚠️ Deshabilitamos SSR de TODO el árbol para evitar el error #310.
const NoSSRApp = dynamic(() => Promise.resolve(AppContent), { ssr: false });

export default function MyApp(props) {
  return (
    <>
      <Head><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
      <ErrorBoundary>
        <NoSSRApp {...props} />
      </ErrorBoundary>
    </>
  );
}
