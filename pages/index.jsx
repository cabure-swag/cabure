// pages/index.jsx
import React, { useEffect, useState, useMemo } from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const [brands, setBrands] = useState(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("*") // trae todas las columnas (si existe instagram_url, la trae)
        .eq("active", true)
        .is("deleted_at", null)
        .order("name", { ascending: true });
      if (error) {
        console.error(error);
        setBrands([]);
        return;
      }
      setBrands(data || []);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!brands) return null;
    const term = q.trim().toLowerCase();
    if (!term) return brands;
    return brands.filter(
      (b) =>
        b.name?.toLowerCase().includes(term) ||
        b.description?.toLowerCase().includes(term)
    );
  }, [brands, q]);

  return (
    <>
      <Head>
        <title>CABURE.STORE</title>
        <meta name="description" content="Tienda colectiva de marcas jóvenes." />
      </Head>

      {/* Buscador chiquito arriba (opcional, minimal) */}
      <div style={{ margin: "16px 0" }}>
        <input
          className="input"
          placeholder="Buscar marcas…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar marcas"
        />
      </div>

      {/* Estados */}
      {!filtered && (
        <div className="grid grid-3" aria-busy="true" aria-live="polite">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skel" style={{ height: 140, borderRadius: 12 }} />
          ))}
        </div>
      )}

      {filtered && filtered.length === 0 && (
        <div className="card" role="status">
          Aún no hay marcas activas.
        </div>
      )}

      {/* Grilla de marcas (solo cards) */}
      <div className="grid grid-3">
        {filtered &&
          filtered.map((b) => (
            <article key={b.id} className="card" style={{ padding: 16 }}>
              <Link
                href={`/marcas/${b.slug}`}
                aria-label={`Abrir ${b.name}`}
                style={{ display: "flex", gap: 12, alignItems: "center" }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    background: "#0E1012",
                    display: "grid",
                    placeItems: "center",
                    border: "1px solid rgba(255,255,255,.08)",
                    overflow: "hidden",
                    flex: "0 0 auto",
                  }}
                >
                  {b.logo_url ? (
                    <Image
                      src={b.logo_url}
                      alt=""
                      width={48}
                      height={48}
                      style={{ objectFit: "contain" }}
                    />
                  ) : (
                    <span className="badge">LOGO</span>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontWeight: 700, lineHeight: 1.2 }}>
                    {b.name}
                  </h3>
                  <p
                    style={{
                      margin: "4px 0 0",
                      color: "var(--text-dim)",
                      fontSize: ".92rem",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {b.description || "—"}
                  </p>
                </div>
              </Link>

              {/* Botón Instagram si hay URL */}
              {b.instagram_url ? (
                <div style={{ marginTop: 10 }}>
                  <a
                    href={b.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Instagram de ${b.name}`}
                    className="btn ghost"
                    style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                  >
                    <InstagramIcon />
                    Instagram
                  </a>
                </div>
              ) : null}
            </article>
          ))}
      </div>
    </>
  );
}

/** Icono de Instagram (SVG inline) */
function InstagramIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M7 2C4.2 2 2 4.2 2 7v10c0 2.8 2.2 5 5 5h10c2.8 0 5-2.2 5-5V7c0-2.8-2.2-5-5-5H7zm0 2h10c1.7 0 3 1.3 3 3v10c0 1.7-1.3 3-3 3H7c-1.7 0-3-1.3-3-3V7c0-1.7 1.3-3 3-3zm10 1.5a1 1 0 100 2 1 1 0 000-2zM12 7a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6z" />
    </svg>
  );
}
