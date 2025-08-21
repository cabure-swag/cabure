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
        .select("id,name,slug,description,logo_url,color,active,deleted_at")
        .eq("active", true)
        .is("deleted_at", null)
        .order("name", { ascending: true });
      if (!error) setBrands(data || []);
      else setBrands([]);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!brands) return null;
    if (!q) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(q.toLowerCase()));
  }, [brands, q]);

  return (
    <>
      <Head>
        <title>CABURE.STORE — Marcas</title>
        <meta name="description" content="Tienda colectiva de marcas jóvenes. Oscuro, urbano, limpio." />
      </Head>

      {/* Hero minimal */}
      <section style={{ margin: "28px 0 16px" }}>
        <h1 style={{ marginBottom: 8 }}>Marcas</h1>
        <p style={{ color: "var(--text-dim)" }}>
          Descubrí colecciones curadas de marcas jóvenes.
        </p>
      </section>

      {/* Buscador */}
      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <input
          className="input"
          placeholder="Buscar marca…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar marca"
        />
        <div />
        <div />
      </div>

      {/* Estados */}
      {!filtered && <div className="skel" style={{ height: 120, borderRadius: 12 }} />}
      {filtered && filtered.length === 0 && (
        <div className="card" role="status">Aún no hay marcas activas.</div>
      )}

      {/* Grid de marcas */}
      <div className="grid grid-3">
        {filtered &&
          filtered.map((b) => (
            <Link href={`/marcas/${b.slug}`} key={b.id} className="card" aria-label={`Abrir ${b.name}`}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
                  }}
                >
                  {b.logo_url ? (
                    <Image src={b.logo_url} alt="" width={48} height={48} />
                  ) : (
                    <span className="badge">LOGO</span>
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>{b.name}</div>
                  <div style={{ color: "var(--text-dim)", fontSize: ".9rem" }}>
                    {b.description || "—"}
                  </div>
                </div>
              </div>
            </Link>
          ))}
      </div>
    </>
  );
}
