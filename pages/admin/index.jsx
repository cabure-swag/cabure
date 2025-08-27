// pages/admin/index.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// ============== Utils ==============
function slugify(s) {
  return (s || "")
    .toString()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .trim();
}

function toPublicURL(input) {
  if (!input) return null;
  const v = String(input).trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  if (!base) return null;
  const clean = v.replace(/^\/+/, "");
  if (clean.startsWith("brand-logos/")) {
    return `${base}/storage/v1/object/public/${clean}`;
  }
  return `${base}/storage/v1/object/public/brand-logos/${clean}`;
}

function useAuthProfile() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription?.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session?.user?.id) return;
    supabase.from("profiles").select("user_id,email,role").eq("user_id", session.user.id).maybeSingle()
      .then(({ data }) => setProfile(data || null));
  }, [session?.user?.id]);
  return { session, profile };
}

// ============== Uploader ==============
function Uploader({ accept = "image/*", onPick, children, disabled }) {
  const ref = useRef(null);
  return (
    <>
      <button className="btn" disabled={disabled} onClick={() => ref.current?.click()}>
        {children || "Subir"}
      </button>
      <input
        ref={ref}
        type="file"
        hidden
        accept={accept}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          onPick?.(f);
          e.target.value = "";
        }}
      />
      <style jsx>{`
        .btn { padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#161616; color:#fff; cursor:pointer; }
        .btn:disabled { opacity:.5; cursor:not-allowed; }
      `}</style>
    </>
  );
}

// ============== Página Admin ==============
export default function AdminPage() {
  const { session, profile } = useAuthProfile();
  const isAdmin = profile?.role === "admin";

  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState({}); // id -> bool

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("brands")
        .select("id,name,slug,description,logo_url,color,active,bank_alias,bank_cbu,mp_access_token,instagram_url,deleted_at,created_at")
        .order("created_at", { ascending: false });
      if (!error) setBrands(data || []);
      setLoading(false);
    })();
  }, [isAdmin]);

  if (!session) {
    return (
      <div className="container">
        <Head><title>Admin — CABURE.STORE</title></Head>
        <h1>Admin</h1>
        <p>Necesitás iniciar sesión.</p>
        <style jsx>{`.container { padding:16px; }`}</style>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container">
        <Head><title>Admin — CABURE.STORE</title></Head>
        <h1>Admin</h1>
        <p>No tenés permisos de administrador.</p>
        <style jsx>{`.container { padding:16px; }`}</style>
      </div>
    );
  }

  return (
    <div className="container">
      <Head><title>Admin — CABURE.STORE</title></Head>

      {/* Header */}
      <div className="row" style={{ alignItems:"center", gap:12, marginBottom:12 }}>
        <h1 style={{ margin:0 }}>Admin</h1>
        <div style={{ flex:1 }} />
        <Link href="/admin/support" className="btn ghost">Soporte</Link>
        <Link href="/admin/metrics" className="btn ghost">Métricas</Link>
        <button className="btn" onClick={() => setShowCreate(true)}>Crear marca</button>
      </div>

      {/* Crear Marca (toggle) */}
      {showCreate && (
        <section className="card" style={{ padding:16, marginBottom:12, border:"1px dashed #333" }}>
          <CreateBrandCard
            onCancel={() => setShowCreate(false)}
            onCreated={(newId) => {
              setShowCreate(false);
              // refrescar lista
              supabase
                .from("brands")
                .select("id,name,slug,description,logo_url,color,active,bank_alias,bank_cbu,mp_access_token,instagram_url,deleted_at,created_at")
                .order("created_at", { ascending: false })
                .then(({ data }) => setBrands(data || []));
              if (newId) setExpanded((e) => ({ ...e, [newId]: true }));
            }}
          />
        </section>
      )}

      {/* Lista de marcas */}
      <section className="card" style={{ padding: 8 }}>
        {loading && <div className="skeleton" style={{ height: 80 }} />}
        {!loading && brands.length === 0 && <div className="empty">Aún no hay marcas.</div>}

        {!loading && brands.length > 0 && (
          <div className="list">
            {brands.map((b) => (
              <BrandRow
                key={b.id}
                brand={b}
                expanded={!!expanded[b.id]}
                onToggle={() => setExpanded((m) => ({ ...m, [b.id]: !m[b.id] }))}
                onChangeLocal={(patch) =>
                  setBrands((prev) => prev.map((x) => (x.id === b.id ? { ...x, ...patch } : x)))
                }
                onDeleted={() => setBrands((prev) => prev.filter((x) => x.id !== b.id))}
              />
            ))}
          </div>
        )}
      </section>

      <style jsx>{`
        .container { padding: 16px; }
        .row { display:flex; }
        .card { border:1px solid #1a1a1a; border-radius:14px; background:#0a0a0a; }
        .btn { padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#161616; color:#fff; cursor:pointer; }
        .btn.ghost { background:#0f0f0f; }
        .skeleton { background:linear-gradient(90deg,#0f0f0f,#151515,#0f0f0f); animation:pulse 1.5s infinite; border-radius:10px; }
        @keyframes pulse { 0%{opacity:.6} 50%{opacity:1} 100%{opacity:.6} }
        .empty { padding:12px; border:1px dashed #2a2a2a; border-radius:12px; text-align:center; opacity:.9; margin:8px; }
        .list { display:grid; gap:8px; }
      `}</style>
    </div>
  );
}

// ============== Fila de marca (acordeón) ==============
function BrandRow({ brand, expanded, onToggle, onChangeLocal, onDeleted }) {
  const [saving, setSaving] = useState(false);
  const [assignEmail, setAssignEmail] = useState("");
  const [vendors, setVendors] = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(false);

  // cargar vendors asignados
  useEffect(() => {
    if (!expanded) return;
    (async () => {
      setLoadingVendors(true);
      const { data, error } = await supabase
        .from("brand_users")
        .select("id,user_id, profiles: user_id (email)")
        .eq("brand_id", brand.id);
      setLoadingVendors(false);
      if (!error) setVendors(data || []);
    })();
  }, [expanded, brand.id]);

  async function saveField(patch) {
    setSaving(true);
    const { error } = await supabase.from("brands").update(patch).eq("id", brand.id);
    setSaving(false);
    if (!error) onChangeLocal?.(patch);
    else alert(error.message || "No se pudo guardar.");
  }

  async function uploadLogo(file) {
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${brand.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("brand-logos").upload(path, file, {
      upsert: true,
      cacheControl: "3600",
    });
    if (upErr) { alert("No se pudo subir el logo."); return; }
    await saveField({ logo_url: `brand-logos/${path}` });
  }

  async function softDeleteBrand() {
    if (!confirm("¿Seguro que querés eliminar (soft delete) esta marca?")) return;
    const { error } = await supabase.from("brands").update({ deleted_at: new Date().toISOString() }).eq("id", brand.id);
    if (error) { alert(error.message || "No se pudo eliminar"); return; }
    onDeleted?.();
  }

  async function assignVendor() {
    const email = assignEmail.trim().toLowerCase();
    if (!email) return alert("Ingresá un email.");
    // El usuario debe existir en profiles (se crea al loguearse por primera vez)
    const { data: prof } = await supabase.from("profiles").select("user_id,email").eq("email", email).maybeSingle();
    if (!prof?.user_id) { alert("Ese email todavía no tiene perfil (debe iniciar sesión al menos una vez)."); return; }
    const { error } = await supabase
      .from("brand_users")
      .insert({ brand_id: brand.id, user_id: prof.user_id });
    if (error) { alert(error.message || "No se pudo asignar."); return; }
    setAssignEmail("");
    // refrescar
    const { data } = await supabase
      .from("brand_users")
      .select("id,user_id, profiles: user_id (email)")
      .eq("brand_id", brand.id);
    setVendors(data || []);
  }

  async function removeVendor(id) {
    if (!confirm("¿Eliminar vendedor de esta marca?")) return;
    const { error } = await supabase.from("brand_users").delete().eq("id", id);
    if (error) { alert(error.message || "No se pudo eliminar"); return; }
    setVendors((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <div className="rowWrap">
      <button className="accordion" onClick={onToggle}>
        <div className="accRow">
          <div className="logo">
            {brand.logo_url ? (
              <img src={toPublicURL(brand.logo_url)} alt={brand.name} />
            ) : (
              <div className="placeholder" />
            )}
          </div>
          <div className="meta">
            <div className="title">{brand.name}</div>
            <div className="sub">
              <span className={`badge ${brand.active ? "ok" : ""}`}>{brand.active ? "Activa" : "Inactiva"}</span>
              {brand.deleted_at && <span className="badge warn">Eliminada</span>}
              <span className="slug">/{brand.slug}</span>
            </div>
          </div>
          <div style={{ flex:1 }} />
          <div className="carats">{expanded ? "▾" : "▸"}</div>
        </div>
      </button>

      {expanded && (
        <div className="panel">
          {/* Campos básicos */}
          <div className="grid">
            <div className="block">
              <label>Nombre</label>
              <input className="inp" defaultValue={brand.name || ""} onBlur={(e) => {
                const v = e.target.value.trim(); if (v && v !== brand.name) saveField({ name: v });
              }} />
            </div>
            <div className="block">
              <label>Slug</label>
              <input className="inp" defaultValue={brand.slug || ""} onBlur={(e) => {
                const v = slugify(e.target.value); if (v && v !== brand.slug) saveField({ slug: v });
              }} />
            </div>
            <div className="block">
              <label>Color</label>
              <input className="inp" type="color" defaultValue={brand.color || "#111827"} onBlur={(e) => {
                const v = e.target.value || "#111827"; if (v !== brand.color) saveField({ color: v });
              }} />
            </div>
            <div className="block">
              <label>Activa</label>
              <input type="checkbox" defaultChecked={!!brand.active} onChange={(e) => {
                const v = !!e.target.checked; if (v !== brand.active) saveField({ active: v });
              }} />
            </div>
          </div>

          <div className="block">
            <label>Descripción</label>
            <textarea className="inp" rows={3} defaultValue={brand.description || ""} onBlur={(e) => {
              const v = e.target.value.trim() || null; if (v !== (brand.description || null)) saveField({ description: v });
            }} />
          </div>

          <div className="grid">
            <div className="block">
              <label>Instagram (URL)</label>
              <input className="inp" placeholder="https://instagram.com/tu_marca" defaultValue={brand.instagram_url || ""} onBlur={(e) => {
                const v = e.target.value.trim() || null; if (v !== (brand.instagram_url || null)) saveField({ instagram_url: v });
              }} />
            </div>
            <div className="block">
              <label>Alias (Transferencia)</label>
              <input className="inp" defaultValue={brand.bank_alias || ""} onBlur={(e) => {
                const v = e.target.value.trim() || null; if (v !== (brand.bank_alias || null)) saveField({ bank_alias: v });
              }} />
            </div>
            <div className="block">
              <label>CBU / CVU</label>
              <input className="inp" defaultValue={brand.bank_cbu || ""} onBlur={(e) => {
                const v = e.target.value.trim() || null; if (v !== (brand.bank_cbu || null)) saveField({ bank_cbu: v });
              }} />
            </div>
            <div className="block">
              <label>Mercado Pago Access Token</label>
              <input className="inp" type="password" placeholder="opcional" defaultValue={brand.mp_access_token || ""} onBlur={(e) => {
                const v = e.target.value.trim() || null; if (v !== (brand.mp_access_token || null)) saveField({ mp_access_token: v });
              }} />
            </div>
          </div>

          {/* Logo */}
          <div className="block">
            <label>Logo</label>
            <div className="row" style={{ gap:12, alignItems:"center" }}>
              <div className="logo big">
                {brand.logo_url ? (
                  <img src={toPublicURL(brand.logo_url)} alt="logo" />
                ) : (
                  <div className="placeholder" />
                )}
              </div>
              <Uploader onPick={uploadLogo}>Subir logo</Uploader>
            </div>
          </div>

          {/* Vendors */}
          <div className="block">
            <div className="row" style={{ alignItems:"center", gap:8 }}>
              <h3 style={{ margin:0 }}>Vendedores</h3>
              {loadingVendors && <span className="hint">cargando…</span>}
            </div>
            {vendors.length === 0 && <div className="empty">Sin vendedores asignados.</div>}
            {vendors.length > 0 && (
              <ul className="vendors">
                {vendors.map((v) => (
                  <li key={v.id}>
                    <span>{v.profiles?.email || v.user_id}</span>
                    <button className="btn danger" onClick={() => removeVendor(v.id)}>Quitar</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="row" style={{ gap:8, marginTop:8 }}>
              <input
                className="inp"
                placeholder="email del vendedor…"
                value={assignEmail}
                onChange={(e) => setAssignEmail(e.target.value)}
              />
              <button className="btn" onClick={assignVendor}>Agregar</button>
            </div>
            <p className="hint" style={{ marginTop:6 }}>
              * El usuario debe haber iniciado sesión al menos una vez para tener perfil.
            </p>
          </div>

          {/* Acciones */}
          <div className="row" style={{ gap:8, marginTop:12 }}>
            <Link href={`/marcas/${brand.slug}`} className="btn ghost">Ver catálogo público</Link>
            <button className="btn danger" onClick={softDeleteBrand}>Eliminar (soft)</button>
            {saving && <span className="hint">Guardando…</span>}
          </div>
        </div>
      )}

      <style jsx>{`
        .rowWrap { border:1px solid #1a1a1a; border-radius:12px; overflow:hidden; background:#0f0f0f; }
        .accordion { width:100%; text-align:left; padding:0; background:#0f0f0f; color:#fff; border:0; border-bottom:1px solid #1a1a1a; cursor:pointer; }
        .accRow { display:flex; align-items:center; gap:12px; padding:10px; }
        .logo { width:44px; height:44px; border-radius:8px; overflow:hidden; border:1px solid #222; background:#0a0a0a; display:flex; align-items:center; justify-content:center; }
        .logo img { width:100%; height:100%; object-fit:cover; }
        .logo.big { width:88px; height:88px; }
        .placeholder { width:100%; height:100%; background:#0b0b0b; }
        .meta { display:grid; }
        .title { font-weight:700; }
        .sub { display:flex; gap:8px; align-items:center; opacity:.85; }
        .slug { opacity:.7; }
        .carats { opacity:.7; font-size:1.2rem; }
        .panel { padding:12px; display:grid; gap:12px; }
        .grid { display:grid; gap:12px; grid-template-columns: repeat(2, 1fr); }
        @media (max-width: 900px){ .grid { grid-template-columns: 1fr; } }
        .block { display:grid; gap:6px; }
        .inp {
          padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#0f0f0f; color:#fff;
        }
        .hint { opacity:.7; font-size:.9rem; }
        .badge { padding:2px 8px; border-radius:999px; border:1px solid #333; font-size:.8rem; }
        .badge.ok { background:#102012; color:#c6f6d5; border-color:#1f3f26; }
        .badge.warn { background:#2a1717; color:#f8b4b4; border-color:#422; }
        .vendors { list-style:none; padding:0; margin:8px 0; display:grid; gap:8px; }
        .vendors li { display:flex; align-items:center; justify-content:space-between; gap:8px; border:1px solid #222; border-radius:10px; padding:8px 10px; }
        .btn { padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#161616; color:#fff; cursor:pointer; }
        .btn.ghost { background:#0f0f0f; }
        .btn.danger { background:#1c1313; border-color:#3a2222; }
      `}</style>
    </div>
  );
}

// ============== Crear marca (form colapsable) ==============
function CreateBrandCard({ onCancel, onCreated }) {
  const [name, setName] = useState("");
  const [slugState, setSlugState] = useState("");
  const [description, setDescription] = useState("");
  const [instagram, setInstagram] = useState("");
  const [color, setColor] = useState("#111827");
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState(null);

  function handleName(v) {
    setName(v);
    if (!slugState) setSlugState(slugify(v));
  }

  async function createBrand(e) {
    e.preventDefault();
    const s = slugify(slugState || name);
    if (!name.trim() || !s) { alert("Nombre y slug son obligatorios."); return; }
    setSaving(true);
    try {
      // 1) insertar marca
      const payload = {
        name: name.trim(),
        slug: s,
        description: description.trim() || null,
        instagram_url: instagram.trim() || null,
        color,
        active: true,
      };
      const { data: ins, error: e1 } = await supabase
        .from("brands")
        .insert(payload)
        .select("id")
        .maybeSingle();
      if (e1) throw e1;

      // 2) opcional subir logo
      if (logoFile && ins?.id) {
        const ext = (logoFile.name.split(".").pop() || "png").toLowerCase();
        const path = `${ins.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("brand-logos").upload(path, logoFile, {
          upsert: true,
          cacheControl: "3600",
        });
        if (upErr) throw upErr;
        const { error: updErr } = await supabase
          .from("brands").update({ logo_url: `brand-logos/${path}` }).eq("id", ins.id);
        if (updErr) throw updErr;
      }

      alert("Marca creada");
      onCreated?.(ins?.id || null);
    } catch (err) {
      alert(err.message || "No se pudo crear la marca.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={createBrand}>
      <h2 style={{ marginTop: 0 }}>Crear marca</h2>
      <div className="grid">
        <div className="block">
          <label>Nombre</label>
          <input className="inp" value={name} onChange={(e)=>handleName(e.target.value)} />
        </div>
        <div className="block">
          <label>Slug</label>
          <input className="inp" value={slugState} onChange={(e)=>setSlugState(e.target.value)} />
        </div>
        <div className="block">
          <label>Color</label>
          <input className="inp" type="color" value={color} onChange={(e)=>setColor(e.target.value)} />
        </div>
        <div className="block">
          <label>Instagram (URL)</label>
          <input className="inp" placeholder="https://instagram.com/tu_marca" value={instagram} onChange={(e)=>setInstagram(e.target.value)} />
        </div>
      </div>

      <div className="block" style={{ marginTop:8 }}>
        <label>Descripción</label>
        <textarea className="inp" rows={3} value={description} onChange={(e)=>setDescription(e.target.value)} />
      </div>

      <div className="block" style={{ marginTop:8 }}>
        <label>Logo (opcional)</label>
        <input type="file" accept="image/*" onChange={(e)=>setLogoFile(e.target.files?.[0] || null)} />
      </div>

      <div className="row" style={{ gap:8, marginTop:12 }}>
        <button className="btn" type="submit" disabled={saving}>Crear</button>
        <button className="btn ghost" type="button" onClick={onCancel}>Cancelar</button>
        {saving && <span className="hint">Guardando…</span>}
      </div>

      <style jsx>{`
        .grid { display:grid; gap:12px; grid-template-columns: repeat(2, 1fr); }
        @media (max-width: 900px){ .grid { grid-template-columns: 1fr; } }
        .block { display:grid; gap:6px; }
        .inp {
          padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#0f0f0f; color:#fff;
        }
        .btn { padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#161616; color:#fff; cursor:pointer; }
        .btn.ghost { background:#0f0f0f; }
        .hint { opacity:.7; font-size:.9rem; }
      `}</style>
    </form>
  );
}
