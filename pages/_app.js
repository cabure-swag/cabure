+ import React from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ToastProvider, useToast } from "@/components/Toast";
import "@/styles/globals.css";

function EnsureProfile(){
  const { push } = useToast();
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        await fetch('/api/auth/ensure-profile', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({}) });
      } catch(e){ if(mounted) push('No se pudo sincronizar el perfil'); }
    })();
    return () => { mounted=false; };
  }, []);
  return null;
}

class ErrorBoundary extends React.Component{
  constructor(props){ super(props); this.state = { hasError:false }; }
  static getDerivedStateFromError(){ return { hasError:true }; }
  componentDidCatch(err, info){ console.error(err, info); }
  render(){ if(this.state.hasError){ return <div className="container"><div className="status-error">Ocurrió un error. Recargá la página.</div></div>; } return this.props.children; }
}

export default function MyApp({ Component, pageProps, router }){
  const canonical = (process.env.NEXT_PUBLIC_SITE_URL || "https://cabure.store") + (router?.asPath || "/");
  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="CABURE.STORE" />
        <meta property="og:url" content={canonical} />
        <meta property="og:title" content="CABURE.STORE — Tienda colectiva" />
        <meta property="og:image" content="/cabure-logo.png" />
        <meta name="theme-color" content="#0a0a0a" />
      </Head>
      <ToastProvider>
        <EnsureProfile />
        <header className="header" role="banner">
          <div className="header-inner container">
            <Link className="logo" href="/" aria-label="Volver al inicio">
              <Image src="/cabure-logo.png" alt="CABURE logo" width={24} height={24} priority />
              <span>CABURE.STORE</span>
            </Link>
            <nav className="nav" aria-label="principal">
              <Link className="btn" href="/soporte">Soporte</Link>
              <Link className="btn" href="/admin">Admin</Link>
            </nav>
          </div>
        </header>
        <main role="main">
          <ErrorBoundary>
            <Component {...pageProps} />
          </ErrorBoundary>
        </main>
      </ToastProvider>
    </>
  );
}
