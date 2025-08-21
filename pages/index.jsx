// pages/index.jsx
import React, { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";

function InstaIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.5A5.5 5.5 0 1 1 6.5 13 5.51 5.51 0 0 1 12 7.5zm0 2A3.5 3.5 0 1 0 15.5 13 3.5 3.5 0 0 0 12 9.5zM17.75 6a1.25 1.25 0 1 1-1.25 1.25A1.25 1.25 0 0 1 17.75 6z"/>
    </svg>
  );
}

export default function Home() {
  const [brands, setBrands] = useState(null); // null = cargando; [] = vacío
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Por RLS: público solo ve active=true y deleted_at IS NULL
        const { data, error } = await supabase
          .from("brands")
          .select("id,name,slug,description,logo_url,instagram_url,color")
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (alive) setBrands(data ?? []);
      } catch (e) {
        if (alive) {
          setError("No se pudieron cargar las marcas.");
          setBrands([]);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="container">
      <Head>
        <title>CABURE.STORE — Marcas</title>
        <meta
          name="description"
          content="Colectivo de marcas jóvenes. Ropa y otros. Catálogo por marca en CABURE.STORE."
        />
        <meta property="og:title" content="CABURE.STORE — Marcas" />
        <meta property="og:description" content="Catálogo por marca, urbano y minimal." />
        <meta property="og:image" content="/cabure-logo.png" />
        <link rel="canonical" href={typeof window !== "undefined" ? window.location.href : ""} />
      </Head>

      {/* No titulo “Marcas” como pediste; directamente la grilla */}
      {brands === null ? (
        <div className="skel" style={{ height: 160, borderRadius: 16 }} />
      ) : brands.length === 0 ? (
        <div className="card" style={{ padding: 24 }}>
          {error || "Aún no hay marcas activas."}
        </div>
      ) : (
        <div className="grid grid-3">
          {brands.map((b) => (
            <article key={b.id} className="card" style={{ padding: 16 }}>
              <Link
                href={`/marcas/${b.slug}`}
                className="card-hover"
                title={`Ver catálogo de ${b.name}`}
                aria-label={`Ver catálogo de ${b.name}`}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 12,
                      background: "#0E1012",
                      border: "1px solid rgba(255,255,255,.08)",
                      overflow: "hidden",
                      position: "relative",
                      flex: "0 0 auto",
                    }}
                  >
                    {b.logo_url ? (
                      <Image
                        src={b.logo_url}
                        alt={`${b.name} logo`}
                        fill
                        sizes="56px"
                        style={{ objectFit: "cover" }}
                      />
                    ) : null}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{b.name}</h2>
                    <p
                      style={{
                        margin: "6px 0 0",
                        color: "var(--text-dim)",
                        fontSize: ".95rem",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {b.description || "—"}
                    </p>
                  </div>
                </div>
              </Link>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
                <Link href={`/marcas/${b.slug}`} className="btn secondary">
                  Ver catálogo
                </Link>
                {b.instagram_url ? (
                  <a
                    href={b.instagram_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn ghost"
                    aria-label="Instagram"
                    title="Instagram"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <InstaIcon />
                    <span>Instagram</span>
                  </a>
                ) : (
                  <span />
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
