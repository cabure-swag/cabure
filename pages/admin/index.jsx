// pages/admin/index.jsx
import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// ⚠️ Usamos <img> en lugar de next/image para evitar configs de dominios durante la integración.
function AdminInner() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [err, setErr] = useState("");

  const [brands, setBrands] = useState(null);
  const [brandId, setBrandId] = useState(null);
  const [loadingBrands, setLoadingBrands] = useState(false);

  // sesión + rol
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!alive) return;
        const s = data?.session ?? null;
        setSession(s);
        if (s?.user?.id) {
          const { data: prof, error } = await supabase
            .from("profiles")
            .select("role")
            .eq("user_id", s.user.id)
            .maybeSingle();
          if (error) throw error;
          setRole(prof?.role ?? null);
        } else {
          setRole(null);
        }
      } catch (e) {
        setErr(e.message || "No se pudo cargar el perfil.");
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  // cargar marcas (solo admin)
  async function loadBrands() {
    if (role !== "admin") return;
    setLoadingBrands(true);
    setErr("");
    try {
      const { data, error } = await supabase
        .from("brands")
        .select("id,name,slug,description,instagram_url,logo_url,color,active,deleted_at,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setBrands(data || []);
      if (!brandId && (data || []).length) setBrandId(data[0].id);
    } catch (e) {
      setBrands([]);
      setErr(e.message || "No se pudieron cargar las marcas.");
    } finally {
      setLoadingBrands(false);
    }
  }

  useEffect(() => { loadBrands(); /*eslint-disable-next-line*/ }, [role]);

  const currentBrand = useMemo(
    () => (brands || []).find((b) => b.id === brandId) || null,
    [brands, brandId]
  );

  return (
    <div className="container">
      <Head><title>Admin — CABURE.STORE</title><meta name="robots" content="noindex"/></Head>
      <h1>Admin</h1>
      {err && <div className="card" style={{ padding:12, border:"1px solid #a33" }}>{err}</div>}

      {!session && (
        <div className="card" style={{ padding:16 }}>
          <p>Necesitás iniciar sesión.</p>
          <Link className="btn" href="/soporte">Iniciar sesión</Link>
        </div>
      )}

      {session && role !== "admin" && (
        <div className="card" style={{ padding:16 }}>
          <p>Tu usuario no es admin.</p>
          <Link className="btn" href="/">Volver</Link>
        </div>
      )}

      {session && role === "admin" && (
        <>
          <div className="row" style={{ alignItems:"center", gap:8 }}>
            <Link href="/admin/metrics" className="btn ghost">Métricas</Link>
            <Link href="/admin/support" className="btn ghost">Soporte</Link>
            <div style={{ flex:1 }} />
            <button className="btn ghost" onClick={loadBrands} disabled={loadingBrands}>
              {loadingBrands ? "Actualizando…" : "Refrescar"}
            </button>
          </div>

          {/* Selector de marca */}
          <section className="card" style={{ padding:12, marginTop:12 }}>
            <label className="input-label">Marca</label>
            {!brands ? (
              <div className="skel" style={{ height: 48, borderRadius: 8 }} />
            ) : brands.length === 0 ? (
              <div>No hay marcas todavía.</div>
            ) : (
              <select
                className="input"
                value={brandId || ""}
                onChange={(e) => setBrandId(e.target.value)}
                aria-label="Seleccionar marca"
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — /marcas/{b.slug}
                  </option>
                ))}
              </select>
            )}
          </section>

          {/* Editor de marca */}
          {currentBrand && (
            <BrandEditor
              brand={currentBrand}
              onSaved={loadBrands}
            />
          )}
        </>
      )}
    </div>
  );
}

function BrandEditor({ brand, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(brand.name || "");
  const [slug, setSlug] = useState(brand.slug || "");
  const [description, setDescription] = useState(brand.description || "");
  const [instagram, setInstagram] = useState(brand.instagram_url || "");
  const [active, setActive] = useState(!!brand.active);
  const [color, setColor] = useState(brand.color || "#111827"); // gris oscuro por defecto
  const [logoUrl, setLogoUrl] = useState(brand.logo_url || "");

  useEffect(() => {
    setName(brand.name || "");
    setSlug(brand.slug || "");
    setDescription(brand.description || "");
    setInstagram(brand.instagram_url || "");
    setActive(!!brand.active);
    setColor(brand.color || "#111827");
    setLogoUrl(brand.logo_url || "");
  }, [brand.id]);

  async function save(fieldPatch) {
    try {
      setSaving(true);
      const patch = fieldPatch ?? {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        instagram_url: instagram.trim() || null,
        active,
        color,
        logo_url: logoUrl || null,
      };
      const { error } = await supabase.from("brands").update(patch).eq("id", brand.id);
      if (error) throw error;
      onSaved?.();
    } catch (e) {
      alert(e.message || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setSaving(true);
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${brand.id}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("brand-logos").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/png",
      });
      if (up.error) throw up.error;
      const { data } = supabase.storage.from("brand-logos").getPublicUrl(path);
      setLogoUrl(data?.publicUrl || "");
      await save({ logo_url: data?.publicUrl || null });
    } catch (e2) {
      alert(e2.message || "No se pudo subir el logo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card" style={{ padding:16, marginTop:12 }}>
      <div className="row" style={{ alignItems:"center" }}>
        <h2 style={{ margin:0 }}>Editar marca</h2>
        <div style={{ flex:1 }} />
        <Link href={`/marcas/${brand.slug}`} className="btn ghost" target="_blank" rel="noreferrer">Ver pública</Link>
      </div>

      <div className="grid grid-2" style={{ gap:12, marginTop:12 }}>
        <div>
          <label className="input-label">Nombre</label>
          <input className="input" value={name} onChange={(e)=>setName(e.target.value)} onBlur={()=>save()} />

          <label className="input-label" style={{ marginTop:8 }}>Slug</label>
          <input className="input" value={slug} onChange={(e)=>setSlug(e.target.value)} onBlur={()=>save()} />

          <label className="input-label" style={{ marginTop:8 }}>Descripción</label>
          <textarea className="input" rows={4} value={description} onChange={(e)=>setDescription(e.target.value)} onBlur={()=>save()} />

          <div style={{ marginTop:8, display:"flex", gap:12, alignItems:"center" }}>
            <label className="chip">
              <input type="checkbox" checked={active} onChange={(e)=>{ setActive(e.target.checked); save({ active: e.target.checked }); }} /> pública
            </label>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:12, opacity:0.8 }}>Color</span>
              <input type="color" value={color} onChange={(e)=>{ setColor(e.target.value); save({ color: e.target.value }); }} />
            </div>
          </div>

          <label className="input-label" style={{ marginTop:8 }}>Instagram (URL)</label>
          <input className="input" type="url" placeholder="https://instagram.com/tumarca"
                 value={instagram} onChange={(e)=>setInstagram(e.target.value)} onBlur={()=>save()} />
        </div>

        <div>
          <label className="input-label">Logo</label>
          <input className="input" type="file" accept="image/*" onChange={handleLogo} />
          <div style={{ width:180, height:180, display:"grid", placeItems:"center", background:"#0E1012", border:"1px solid var(--border)", borderRadius:12, marginTop:8 }}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={name} style={{ maxWidth:"100%", maxHeight:"100%", objectFit:"contain", borderRadius:10 }} />
            ) : (
              <div style={{ opacity:0.6, fontSize:12 }}>Sin logo</div>
            )}
          </div>
          {saving ? <div className="badge" style={{ marginTop:8 }}>Guardando…</div> : null}
        </div>
      </div>
    </section>
  );
}

export default dynamic(() => Promise.resolve(AdminInner), { ssr: false });
