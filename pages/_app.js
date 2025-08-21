// pages/_app.js
import React, { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import "@/styles/globals.css";
import { supabase } from "@/lib/supabaseClient";

function Header({ isAdmin }) {
  return (
    <header className="header" role="banner">
      <div className="header-inner container" style={{ gap: 12 }}>
        {/* IZQUIERDA: SOLO CABURE.STORE */}
        <Link href="/" className="brand" aria-label="Ir al inicio CABURE.STORE">
          <Image src="/cabure-logo.png" alt="" width={28} height={28} priority />
          <span>CABURE.STORE</span>
        </Link>

        {/* DERECHA: SOLO SI SOS ADMIN (si no, no se ve nada) */}
        {isAdmin ? (
          <nav aria-label="Accesos admin" style={{ marginLeft: "auto" }}>
            <Link className="btn secondary" href="/admin" aria-label="Ir a admin">
              Admin
            </Link>
          </nav>
        ) : null}
      </div>
    </header>
  );
}

export default function MyApp({ Component, pageProps }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadRole() {
      // 1) Sesión
      const { data: sess } = await supabase.auth.getSession();
      const session = sess?.session;
      if (!session) {
        if (mounted) setIsAdmin(false);
        return;
      }

      // 2) Perfil (tabla profiles.role)
      const { data: prof, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!mounted) return;
      if (error) {
        setIsAdmin(false);
        return;
      }
      setIsAdmin(prof?.role === "admin");
    }

    loadRole();

    // Suscripción a cambios de auth
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!mounted) return;
      if (!s) return setIsAdmin(false);
      // re-chequear al loguear
      (async () => {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", s.user.id)
          .maybeSingle();
        setIsAdmin(prof?.role === "admin");
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

      <Header isAdmin={isAdmin} />

      <main className="container">
        <Component {...pageProps} />
      </main>
    </>
  );
}
