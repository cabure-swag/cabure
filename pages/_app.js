// pages/_app.js
import React from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import "@/styles/globals.css";

function Header() {
  return (
    <header className="header" role="banner">
      <div className="header-inner container">
        <Link href="/" className="brand" aria-label="Ir al inicio CABURE.STORE">
          <Image
            src="/cabure-logo.png"
            alt=""
            width={28}
            height={28}
            priority
          />
          <span>CABURE.STORE</span>
        </Link>

        <nav aria-label="Navegación principal" style={{ display: "flex", gap: 12 }}>
          <Link className="btn ghost" href="/soporte" aria-label="Ir a soporte">
            Soporte
          </Link>
          <Link className="btn secondary" href="/admin" aria-label="Ir a admin">
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        {/* SEO base (puede sobreescribirse por página) */}
        <title>CABURE.STORE</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="dark" />
        <meta name="theme-color" content="#0e0e0e" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/site.webmanifest" />
        {/* Canonical (si definiste NEXT_PUBLIC_SITE_URL, se respeta) */}
        {process.env.NEXT_PUBLIC_SITE_URL && (
          <link rel="canonical" href={process.env.NEXT_PUBLIC_SITE_URL} />
        )}
      </Head>

      <Header />

      <main className="container">
        <Component {...pageProps} />
      </main>
    </>
  );
}
