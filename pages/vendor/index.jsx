// pages/vendor/index.jsx
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function VendorPage() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [brands, setBrands] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [uiError, setUiError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const s = data?.session ?? null;
      if (!alive) return;
      setSession(s);
      if (s?.user?.id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", s.user.id)
          .maybeSingle();
        setRole(prof?.role ?? null);
      } else {
        setRole(null);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      (async () => {
        if (s?.user?.id) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("role")
            .eq("user_id", s.user.id)
            .maybeSingle();
          setRole(prof?.role ?? null);
        } else {
          setRole(null);
        }
      })();
    });
    return () => {
      alive = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      try {
        setUiError("");
        // todas las marcas donde soy vendor
        const { data, error } = await supabase
          .from("brands")
          .select("id,name,slug,description,instagram_url,logo_url,color,active,deleted_at")
          .in("id", supabase.from("brand_users").select("brand_id").eq("user_id", session.user.id)); // NOTA: PostgREST no permite subselect directo.
        // ↑ Como PostgREST no acepta subselect así, hacemos 2 requests:
      } catch (e) {
        // hacemos la versión en dos pasos:
        const { data: links, error: e1 } = await supabase
          .from("brand_users")
          .select("brand_id")
          .eq("user_id", session.user.id);
        if (e1) {
          setUiError("No se pudieron cargar tus marcas.");
          setBrands([]);
          return;
        }
        const ids = (links || []).map((l) => l.brand_id);
        if (!ids.length) {
          setBrands([]);
          return;
        }
        const { data: bs, error: e2 } = await supabase
          .from("brands")
          .select("id,name,slug,description,instagram_url,logo_url,color,active,deleted_at")
          .in("id", ids);
        if (e2) {
          setUiError("No se pudieron cargar tus marcas.");
          setBrands([]);
          return;
        }
        setBrands(bs || []);
      }
    })();
  }, [session?.user?.id]);

  if (!session) {
    return (
      <div className="container">
        <div className="card" style={{ padding: 24 }}>
          <h2>Vendor</h2>
          <p>Necesitás iniciar sesión.</p>
          <Link href="/soporte" className="btn">Iniciar sesión</Link>
        </div>
      </div>
    );
  }
  if (role !== "vendor" && role !== "admin") {
    return (
      <div className="container">
        <div className="card" style={{ padding: 24 }}>
          <h2>Sin permiso</h2>
          <p>Tu usuario no tiene rol de vendedor.</p>
          <Link href="/" className="btn">Volver</Link>
        </div>
      </div>
    );
  }

  async function uploadLogo(brand, file) {
    if (!file) return null;
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${brand.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("brand-logos").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/png",
    });
    if (upErr) throw upErr;
    const { data } = supabase.storage.from("brand-logos").getPublicUrl(path);
    return data?.publicUrl || null;
  }

  async function saveBrand(b, partial) {
    try {
      setUiError("");
      setSavingId(b.id);
      const payload = {
        description: partial.description ?? b.description ?? null,
        instagram_url: partial.instagram_url ?? b.instagram_url ?? null,
        logo_url: partial.logo_url ?? b.logo_url ?? null,
        color: partial.color ?? b.color ?? null,
      };
      const { error } = await supabase.from("brands").update(payload).eq("id", b.id);
      if (error) throw error;
      // actualizar UI
      setBrands((prev) => prev.map((x) => (x.id === b.id ? { ...x, ...payload } : x)));
    } catch (e) {
      setUiError(e.message || "No se pudo guardar la marca.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="container">
      <Head>
        <title>Vendor — CABURE.STORE</title>
        <meta name="robots" content="noindex" />
      </Head>

      <h1>Panel de Vendedor</h1>
      {uiError ? <div className="card" style={{ padding: 12, border: "1px solid #a33" }}>{uiError}</div> : null}

      {!brands ? (
        <div className="skel" style={{ height: 160, borderRadius: 12 }} />
      ) : brands.length === 0 ? (
        <div className="card" style={{ padding: 16 }}>No tenés marcas asignadas todavía.</div>
      ) : (
        <div className="grid grid-2">
          {brands.map((b) => (
            <article key={b.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 64, height: 64, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,.08)", position: "relative", background: "#0E1012" }}>
                  {b.logo_url && (
                    <Image src={b.logo_url} alt={`${b.name} logo`} fill sizes="64px" style={{ objectFit: "cover" }} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <strong>{b.name}</strong>
                  <div style={{ color: "var(--text-dim)" }}>/marcas/{b.slug}</div>
                </div>
                <a href={`/marcas/${b.slug}`} target="_blank" rel="noreferrer" className="btn ghost">Ver</a>
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                <label className="input-label">Descripción</label>
                <textarea
                  className="input"
                  rows={3}
                  defaultValue={b.description || ""}
                  onBlur={(e) => saveBrand(b, { description: e.target.value })}
                />

                <label className="input-label">Instagram (URL)</label>
                <input
                  className="input"
                  type="url"
                  defaultValue={b.instagram_url || ""}
                  placeholder="https://instagram.com/mi_marca"
                  onBlur={(e) => saveBrand(b, { instagram_url: e.target.value })}
                />

                <label className="input-label">Color (hex opcional)</label>
                <input
                  className="input"
                  type="text"
                  defaultValue={b.color || ""}
                  placeholder="#111111"
                  onBlur={(e) => saveBrand(b, { color: e.target.value })}
                />

                <label className="input-label">Logo (PNG/JPG)</label>
                <input
                  className="input"
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setSavingId(b.id);
                      const publicUrl = await uploadLogo(b, file);
                      await saveBrand(b, { logo_url: publicUrl });
                    } catch (err) {
                      setUiError(err.message || "No se pudo subir el logo.");
                      setSavingId(null);
                    }
                  }}
                />
              </div>

              <div style={{ marginTop: 8, color: "var(--text-dim)", fontSize: ".92rem" }}>
                Los cambios se guardan al salir del campo. Campos permitidos para vendedor: descripción, Instagram, logo y color.
              </div>

              <div style={{ marginTop: 12 }}>
                {savingId === b.id ? <span className="badge">Guardando…</span> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
