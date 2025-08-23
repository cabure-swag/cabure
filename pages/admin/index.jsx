// pages/admin/index.jsx
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";

export default function AdminHome() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [brands, setBrands] = useState(null);
  const [brandId, setBrandId] = useState(null);
  const [uiError, setUiError] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const s = data?.session ?? null;
      setSession(s);
      if (s?.user?.id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", s.user.id)
          .maybeSingle();
        setRole(prof?.role ?? null);
      } else setRole(null);
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
        } else setRole(null);
      })();
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    if (role !== "admin") return;
    (async () => {
      try {
        setUiError("");
        const { data, error } = await supabase
          .from("brands")
          .select("id,name,slug,description,instagram_url,logo_url,color,active,deleted_at")
          .order("created_at", { ascending: false });
        if (error) throw error;
        setBrands(data || []);
        if (!brandId && (data || []).length) setBrandId(data[0].id);
      } catch (e) {
        setBrands([]);
        setUiError(e.message || "No se pudieron cargar marcas.");
      }
    })();
  }, [role]);

  if (!session) {
    return (
      <div className="container">
        <Head><title>Admin — CABURE.STORE</title></Head>
        <div className="card" style={{ padding: 24 }}>
          <h2>Panel Admin</h2>
          <p>Necesitás iniciar sesión.</p>
          <Link href="/soporte" className="btn">Iniciar sesión</Link>
        </div>
      </div>
    );
  }
  if (role !== "admin") {
    return (
      <div className="container">
        <Head><title>Admin — CABURE.STORE</title></Head>
        <div className="card" style={{ padding: 24 }}>
          <h2>Sin permiso</h2>
          <p>Tu usuario no es admin.</p>
        </div>
      </div>
    );
  }

  const currentBrand = useMemo(
    () => (brands || []).find((b) => b.id === brandId) || null,
    [brands, brandId]
  );

  return (
    <div className="container">
      <Head><title>Admin — CABURE.STORE</title></Head>
      <div className="row" style={{ alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Admin</h1>
        <div style={{ flex: 1 }} />
        <Link href="/admin/metrics" className="btn ghost">Métricas</Link>
        <Link href="/admin/support" className="btn ghost" style={{ marginLeft: 8 }}>Soporte</Link>
      </div>

      {uiError ? <div className="card" style={{ padding: 12, border: "1px solid #a33" }}>{uiError}</div> : null}

      {!brands ? (
        <div className="skel" style={{ height: 160, borderRadius: 12, marginTop: 12 }} />
      ) : brands.length === 0 ? (
        <div className="card" style={{ padding: 16, marginTop: 12 }}>No hay marcas todavía.</div>
      ) : (
        <>
          <section className="card" style={{ padding: 12, marginTop: 12 }}>
            <label className="input-label">Marca</label>
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
          </section>

          {currentBrand ? (
            <>
              <BrandEditor b={currentBrand} />
              <BrandVendors brandId={currentBrand.id} />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

/** ===== Edición básica de marca (admin) ===== */
function BrandEditor({ b }) {
  const [saving, setSaving] = useState(false);
  async function update(partial) {
    try {
      setSaving(true);
      const { error } = await supabase.from("brands").update(partial).eq("id", b.id);
      if (error) throw error;
      alert("Guardado");
    } catch (e) {
      alert(e.message || "No se pudo guardar");
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
      const path = `${b.id}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("brand-logos").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/png",
      });
      if (up.error) throw up.error;
      const { data } = supabase.storage.from("brand-logos").getPublicUrl(path);
      await update({ logo_url: data?.publicUrl || null });
    } catch (e2) {
      alert(e2.message || "No se pudo subir el logo.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="card" style={{ padding: 16, marginTop: 12 }}>
      <h2 style={{ marginTop: 0 }}>Marca: {b.name}</h2>
      <div className="grid grid-2" style={{ gap: 8 }}>
        <div>
          <label className="input-label">Descripción</label>
          <textarea className="input" rows={3} defaultValue={b.description || ""} onBlur={(e) => update({ description: e.target.value })} />
          <label className="input-label" style={{ marginTop: 8 }}>Activa</label>
          <label className="chip">
            <input type="checkbox" defaultChecked={!!b.active} onChange={(e) => update({ active: e.target.checked })} /> pública
          </label>
        </div>
        <div>
          <label className="input-label">Instagram (URL)</label>
          <input className="input" type="url" defaultValue={b.instagram_url || ""} onBlur={(e) => update({ instagram_url: e.target.value || null })} />
          <label className="input-label" style={{ marginTop: 8 }}>Logo</label>
          <input type="file" className="input" accept="image/*" onChange={handleLogo} disabled={saving} />
          <div style={{ width: 120, height: 120, position: "relative", marginTop: 8, background: "#0E1012", borderRadius: 12 }}>
            {b.logo_url && <Image src={b.logo_url} alt={b.name} fill sizes="120px" style={{ objectFit: "contain" }} unoptimized />}
          </div>
        </div>
      </div>
      {saving ? <div className="badge" style={{ marginTop: 8 }}>Guardando…</div> : null}
    </section>
  );
}

/** ===== Vendedores asignados (admin) ===== */
function BrandVendors({ brandId }) {
  const [links, setLinks] = useState(null); // [{id, user_id}]
  const [profiles, setProfiles] = useState({}); // user_id -> {email, role}
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
        setProfiles(map);
      } else {
        setProfiles({});
      }
    } catch (e) {
      setLinks([]);
      setProfiles({});
      setUiError(e.message || "No se pudo cargar vendedores.");
    }
  }

  useEffect(() => { load(); }, [brandId]);

  async function addVendorByEmail(e) {
    e.preventDefault();
    const email = emailToAdd.trim().toLowerCase();
    if (!email) return;

    try {
      // 1) buscar profile por email
      const { data: prof, error: e1 } = await supabase
        .from("profiles")
        .select("user_id, role")
        .eq("email", email)
        .maybeSingle();
      if (e1) throw e1;
      if (!prof?.user_id) { alert("Ese email no tiene perfil aún (debe haber iniciado sesión al menos una vez)."); return; }

      // 2) asegurar rol vendor
      if (prof.role !== "vendor") {
        const { error: e2 } = await supabase
          .from("profiles")
          .update({ role: "vendor" })
          .eq("user_id", prof.user_id);
        if (e2) throw e2;
      }

      // 3) insertar en brand_users (único)
      const { error: e3 } = await supabase
        .from("brand_users")
        .insert({ brand_id: brandId, user_id: prof.user_id });
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
      alert(e.message || "No se pudo quitar (RLS/policies).");
    }
  }

  return (
    <section className="card" style={{ padding: 16, marginTop: 12 }}>
      <div className="row" style={{ alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Vendedores</h2>
      </div>

      {uiError ? <div className="card" style={{ padding: 12, border: "1px solid #a33", marginTop: 8 }}>{uiError}</div> : null}

      {/* Agregar por email */}
      <form onSubmit={addVendorByEmail} className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <input
          className="input"
          type="email"
          placeholder="email@ejemplo.com"
          value={emailToAdd}
          onChange={(e) => setEmailToAdd(e.target.value)}
          style={{ minWidth: 260 }}
        />
        <button className="btn" type="submit">Agregar vendedor</button>
      </form>

      {/* Lista */}
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
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {links.map((l) => {
                const p = profiles[l.user_id];
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
