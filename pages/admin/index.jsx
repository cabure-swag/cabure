// pages/admin/index.jsx
import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// Helpers
const nowIso = () => new Date().toISOString();
const slugify = (s) =>
  (s || "")
    .toString()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);

function AdminInner() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [err, setErr] = useState("");

  const [brands, setBrands] = useState(null);
  const [brandId, setBrandId] = useState(null);
  const [loadingBrands, setLoadingBrands] = useState(false);

  const [showCreate, setShowCreate] = useState(false);

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

  useEffect(() => { loadBrands(); /* eslint-disable-line */ }, [role]);

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
            <button className="btn" onClick={() => setShowCreate(true)}>Nueva marca</button>
            <button className="btn ghost" onClick={loadBrands} disabled={loadingBrands}>
              {loadingBrands ? "Actualizando…" : "Refrescar"}
            </button>
          </div>

          {/* Crear marca (solo si se abre) */}
          {showCreate && (
            <CreateBrandCard
              onCancel={() => setShowCreate(false)}
              onCreated={async (newId) => {
                setShowCreate(false);
                await loadBrands();
                if (newId) setBrandId(newId);
              }}
            />
          )}

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
                    {b.deleted_at ? "🗑️ " : ""}{b.name} — /marcas/{b.slug}
                  </option>
                ))}
              </select>
            )}
          </section>

          {/* Editor de marca + Vendedores */}
          {currentBrand && (
            <>
              <BrandEditor
                brand={currentBrand}
                onSaved={loadBrands}
                onDeleted={async () => { await loadBrands(); }}
                onRestored={async () => { await loadBrands(); }}
              />
              <BrandVendors brandId={currentBrand.id} />
            </>
          )}
        </>
      )}
    </div>
  );
}

function CreateBrandCard({ onCancel, onCreated }) {
  const [name, setName] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [description, setDescription] = useState("");
  const [instagram, setInstagram] = useState("");
  const [color, setColor] = useState("#111827");
  const [saving, setSaving] = useState(false);

  function handleName(v) {
    setName(v);
    if (!slugInput) setSlugInput(slugify(v));
  }

  async function createBrand(e) {
    e.preventDefault();
    const s = slugify(slugInput || name);
    if (!name.trim() || !s) { alert("Nombre y slug son obligatorios."); return; }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        slug: s,
        description: description.trim() || null,
        instagram_url: instagram.trim() || null,
        color,
        active: true,
      };
      const { data, error } = await supabase
        .from("brands")
        .insert(payload)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      alert("Marca creada");
      onCreated?.(data?.id || null);
    } catch (e2) {
      alert(e2.message || "No se pudo crear la marca.");
    } finally {
      setSaving(false);
    }
  }

  const computedSlug = slugify(slugInput || name);

  return (
    <section className="card" style={{ padding:16, marginTop:12, border:"1px dashed var(--border)" }}>
      <div className="row" style={{ alignItems:"center" }}>
        <h2 style={{ margin:0 }}>Nueva marca</h2>
        <div style={{ flex:1 }} />
        <button className="btn ghost" onClick={onCancel}>Cancelar</button>
      </div>

      <form onSubmit={createBrand} className="grid grid-2" style={{ gap:12, marginTop:12 }}>
        <div>
          <label className="input-label">Nombre *</label>
          <input className="input" value={name} onChange={(e)=>handleName(e.target.value)} />
        </div>
        <div>
          <label className="input-label">Slug *</label>
          <input className="input" value={slugInput} onChange={(e)=>setSlugInput(slugify(e.target.value))} />
          <div style={{ fontSize:12, opacity:0.7, marginTop:4 }}>Quedará como /marcas/{computedSlug || "slug"}</div>
        </div>
        <div style={{ gridColumn:"1 / -1" }}>
          <label className="input-label">Descripción</label>
          <textarea className="input" rows={3} value={description} onChange={(e)=>setDescription(e.target.value)} />
        </div>
        <div>
          <label className="input-label">Instagram (URL)</label>
          <input className="input" type="url" value={instagram} onChange={(e)=>setInstagram(e.target.value)} placeholder="https://instagram.com/tumarca" />
        </div>
        <div>
          <label className="input-label">Color</label>
          <input className="input" type="color" value={color} onChange={(e)=>setColor(e.target.value)} />
        </div>
        <div style={{ gridColumn:"1 / -1", textAlign:"right" }}>
          <button className="btn" type="submit" disabled={saving}>{saving ? "Creando…" : "Crear marca"}</button>
        </div>
      </form>
    </section>
  );
}

function BrandEditor({ brand, onSaved, onDeleted, onRestored }) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(brand.name || "");
  const [slug, setSlug] = useState(brand.slug || "");
  const [description, setDescription] = useState(brand.description || "");
  const [instagram, setInstagram] = useState(brand.instagram_url || "");
  const [active, setActive] = useState(!!brand.active);
  const [color, setColor] = useState(brand.color || "#111827");
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
        slug: slugify(slug),
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

  async function softDelete() {
    if (!confirm(`¿Eliminar la marca “${brand.name}”? Es soft delete (se puede restaurar).`)) return;
    try {
      const { error } = await supabase
        .from("brands")
        .update({ deleted_at: nowIso(), active: false })
        .eq("id", brand.id);
      if (error) throw error;
      alert("Marca eliminada (soft).");
      onDeleted?.();
    } catch (e) {
      alert(e.message || "No se pudo eliminar.");
    }
  }

  async function restore() {
    try {
      const { error } = await supabase
        .from("brands")
        .update({ deleted_at: null, active: true })
        .eq("id", brand.id);
      if (error) throw error;
      alert("Marca restaurada.");
      onRestored?.();
    } catch (e) {
      alert(e.message || "No se pudo restaurar.");
    }
  }

  return (
    <section className="card" style={{ padding:16, marginTop:12 }}>
      <div className="row" style={{ alignItems:"center", gap:8 }}>
        <h2 style={{ margin:0 }}>Editar marca</h2>
        <div style={{ flex:1 }} />
        <Link href={`/marcas/${brand.slug}`} className="btn ghost" target="_blank" rel="noreferrer">Ver pública</Link>
        {!brand.deleted_at ? (
          <button className="btn danger" onClick={softDelete}>Eliminar</button>
        ) : (
          <button className="btn" onClick={restore}>Restaurar</button>
        )}
      </div>

      <div className="grid grid-2" style={{ gap:12, marginTop:12 }}>
        <div>
          <label className="input-label">Nombre</label>
          <input className="input" value={name} onChange={(e)=>setName(e.target.value)} onBlur={()=>save()} />

          <label className="input-label" style={{ marginTop:8 }}>Slug</label>
          <input className="input" value={slug} onChange={(e)=>setSlug(e.target.value)} onBlur={()=>save()} />

          <label className="input-label" style={{ marginTop:8 }}>Descripción</label>
          <textarea className="input" rows={4} value={description} onChange={(e)=>setDescription(e.target.value)} onBlur={()=>save()} />

          <div style={{ marginTop:8, display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
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

function BrandVendors({ brandId }) {
  const [links, setLinks] = useState(null);
  const [profilesMap, setProfilesMap] = useState({});
  const [emailToAdd, setEmailToAdd] = useState("");
  const [uiError, setUiError] = useState("");

  async function load() {
    setUiError("");
    try {
      const { data: bu, error: e1 } = await supabase
        .from("brand_users")
        .select("id, user_id")
        .eq("brand_id", brandId)
        .order("id", { ascending: true });
      if (e1) throw e1;
      setLinks(bu || []);

      const userIds = [...new Set((bu || []).map((x) => x.user_id))];
      if (userIds.length) {
        const { data: profs, error: e2 } = await supabase
          .from("profiles")
          .select("user_id, email, role")
          .in("user_id", userIds);
        if (e2) throw e2;
        const map = {};
        for (const p of profs || []) map[p.user_id] = { email: p.email, role: p.role };
        setProfilesMap(map);
      } else setProfilesMap({});
    } catch (e) {
      setLinks([]);
      setProfilesMap({});
      setUiError(e.message || "No se pudo cargar vendedores.");
    }
  }
  useEffect(() => { load(); }, [brandId]);

  async function addVendorByEmail(e) {
    e.preventDefault();
    const email = emailToAdd.trim().toLowerCase();
    if (!email) return;
    try {
      const { data: prof, error: e1 } = await supabase
        .from("profiles")
        .select("user_id, role")
        .eq("email", email)
        .maybeSingle();
      if (e1) throw e1;

      if (!prof?.user_id) {
        alert("Ese email no tiene perfil aún (debe iniciar sesión al menos una vez).");
        return;
      }
      if (prof.role !== "vendor") {
        const { error: e2 } = await supabase.from("profiles").update({ role: "vendor" }).eq("user_id", prof.user_id);
        if (e2) throw e2;
      }
      const { error: e3 } = await supabase.from("brand_users").insert({ brand_id: brandId, user_id: prof.user_id });
      if (e3) throw e3;

      setEmailToAdd("");
      await load();
    } catch (err) {
      alert(err.message || "No se pudo asignar vendedor.");
    }
  }

  async function removeVendor(linkId) {
    if (!confirm("¿Quitar este vendedor de la marca?")) return;
    try {
      const { error } = await supabase.from("brand_users").delete().eq("id", linkId);
      if (error) throw error;
      await load();
    } catch (e) {
      alert(e.message || "No se pudo quitar (verificar RLS/policies).");
    }
  }

  return (
    <section className="card" style={{ padding: 16, marginTop: 12 }}>
      <div className="row" style={{ alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Vendedores</h2>
      </div>

      {uiError ? <div className="card" style={{ padding: 12, border: "1px solid #a33", marginTop: 8 }}>{uiError}</div> : null}

      <form onSubmit={addVendorByEmail} className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <input className="input" type="email" placeholder="email@ejemplo.com" value={emailToAdd} onChange={(e) => setEmailToAdd(e.target.value)} style={{ minWidth: 260 }} />
        <button className="btn" type="submit">Agregar vendedor</button>
      </form>

      <div className="card" style={{ padding: 0, marginTop: 12, overflowX: "auto" }}>
        {!links ? (
          <div className="skel" style={{ height: 120 }} />
        ) : links.length === 0 ? (
          <div style={{ padding: 16 }}>No hay vendedores asignados todavía.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th style={{ width: 120 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {links.map((l) => {
                const p = profilesMap[l.user_id];
                return (
                  <tr key={l.id}>
                    <td>{p?.email || l.user_id}</td>
                    <td>{p?.role || "—"}</td>
                    <td>
                      <button className="btn danger" onClick={() => removeVendor(l.id)}>Quitar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export default dynamic(() => Promise.resolve(AdminInner), { ssr: false });
