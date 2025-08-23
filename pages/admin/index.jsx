// pages/admin/index.jsx
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const fmtDT = (iso) => (iso ? new Date(iso).toLocaleString("es-AR") : "—");

export default function AdminPage() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [brands, setBrands] = useState(null);
  const [filter, setFilter] = useState("actives"); // actives|deleted|all
  const [uiError, setUiError] = useState("");

  // Sesión y rol
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

  // Cargar marcas
  async function loadBrands() {
    try {
      setUiError("");
      let q = supabase
        .from("brands")
        .select("id,name,slug,description,logo_url,color,active,bank_alias,bank_cbu,mp_access_token,created_at,deleted_at")
        .order("created_at", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      setBrands(data || []);
    } catch (e) {
      console.error(e);
      setBrands([]);
      setUiError(e.message || "No se pudieron cargar las marcas.");
    }
  }

  useEffect(() => {
    loadBrands();
  }, []);

  const filtered = useMemo(() => {
    if (!brands) return null;
    if (filter === "actives") return brands.filter((b) => b.active && !b.deleted_at);
    if (filter === "deleted") return brands.filter((b) => !!b.deleted_at);
    return brands;
  }, [brands, filter]);

  if (!session) {
    return (
      <div className="container">
        <div className="card" style={{ padding: 24 }}>
          <h2>Admin</h2>
          <p>Necesitás iniciar sesión.</p>
          <Link href="/soporte" className="btn">Iniciar sesión</Link>
        </div>
      </div>
    );
  }
  if (role !== "admin") {
    return (
      <div className="container">
        <div className="card" style={{ padding: 24 }}>
          <h2>Sin permiso</h2>
          <p>Tu usuario no es admin.</p>
          <Link href="/" className="btn">Volver</Link>
        </div>
      </div>
    );
  }

  async function createBrand(e) {
    e.preventDefault();
    try {
      setUiError("");
      const form = new FormData(e.currentTarget);
      const payload = {
        name: form.get("name")?.trim(),
        slug: form.get("slug")?.trim(),
        description: form.get("description")?.trim() || null,
        color: form.get("color")?.trim() || null,
        active: form.get("active") === "on",
        bank_alias: form.get("bank_alias")?.trim() || null,
        bank_cbu: form.get("bank_cbu")?.trim() || null,
        mp_access_token: form.get("mp_access_token")?.trim() || null,
      };
      if (!payload.name || !payload.slug) {
        alert("Completá nombre y slug");
        return;
      }
      const { data, error } = await supabase.from("brands").insert(payload).select("id").maybeSingle();
      if (error) throw error;
      e.currentTarget.reset();
      await loadBrands();
      alert("Marca creada");
    } catch (e2) {
      setUiError(e2.message || "No se pudo crear la marca.");
    }
  }

  async function uploadLogo(brandId, file) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${brandId}/${Date.now()}.${ext}`;
    const up = await supabase.storage.from("brand-logos").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/png",
    });
    if (up.error) throw up.error;
    const { data } = supabase.storage.from("brand-logos").getPublicUrl(path);
    return data?.publicUrl || null;
  }

  async function saveBrand(b, partial) {
    try {
      setUiError("");
      const payload = { ...partial };
      const { error } = await supabase.from("brands").update(payload).eq("id", b.id);
      if (error) throw error;
      await loadBrands();
    } catch (e) {
      setUiError(e.message || "No se pudo guardar la marca.");
    }
  }

  async function softDelete(b) {
    if (!confirm(`¿Eliminar (soft) la marca “${b.name}”?`)) return;
    try {
      const { error } = await supabase.from("brands").update({ deleted_at: new Date().toISOString() }).eq("id", b.id);
      if (error) throw error;
      await loadBrands();
    } catch (e) {
      setUiError(e.message || "No se pudo eliminar.");
    }
  }

  async function restore(b) {
    try {
      const { error } = await supabase.from("brands").update({ deleted_at: null }).eq("id", b.id);
      if (error) throw error;
      await loadBrands();
    } catch (e) {
      setUiError(e.message || "No se pudo restaurar.");
    }
  }

  return (
    <div className="container">
      <Head>
        <title>Admin — CABURE.STORE</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="row" style={{ alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Panel de Admin</h1>
        <div style={{ flex: 1 }} />
        <Link className="btn ghost" href="/admin/support">Soporte</Link>
        <Link className="btn ghost" href="/admin/metrics">Métricas</Link>
      </div>

      {uiError ? <div className="card" style={{ padding: 12, border: "1px solid #a33", marginTop: 12 }}>{uiError}</div> : null}

      {/* Crear Marca */}
      <section className="card" style={{ padding: 16, marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Crear marca</h2>
        <form onSubmit={createBrand} className="grid grid-3" style={{ gap: 12 }}>
          <input name="name" className="input" placeholder="Nombre *" />
          <input name="slug" className="input" placeholder="slug-ejemplo *" />
          <input name="color" className="input" placeholder="Color (opcional, ej #111111)" />
          <textarea name="description" className="input" rows={2} placeholder="Descripción" style={{ gridColumn: "1 / -1" }} />
          <input name="bank_alias" className="input" placeholder="Alias bancario (opcional)" />
          <input name="bank_cbu" className="input" placeholder="CBU/CVU (opcional)" />
          <input name="mp_access_token" className="input" placeholder="MP access token (opcional)" />
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" name="active" /> Activa
          </label>
          <div style={{ gridColumn: "1 / -1", textAlign: "right" }}>
            <button className="btn" type="submit">Crear</button>
          </div>
        </form>
      </section>

      {/* Filtro */}
      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <button className={filter === "actives" ? "chip chip-active" : "chip"} onClick={() => setFilter("actives")}>Activas</button>
        <button className={filter === "deleted" ? "chip chip-active" : "chip"} onClick={() => setFilter("deleted")}>Eliminadas</button>
        <button className={filter === "all" ? "chip chip-active" : "chip"} onClick={() => setFilter("all")}>Todas</button>
      </div>

      {/* Lista */}
      {!filtered ? (
        <div className="skel" style={{ height: 160, borderRadius: 12, marginTop: 12 }} />
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 16, marginTop: 12 }}>No hay marcas.</div>
      ) : (
        <div className="grid grid-2" style={{ marginTop: 12 }}>
          {filtered.map((b) => (
            <BrandAdminCard key={b.id} b={b} onSave={saveBrand} onDelete={softDelete} onRestore={restore} />
          ))}
        </div>
      )}
    </div>
  );
}

function BrandAdminCard({ b, onSave, onDelete, onRestore }) {
  const [vendors, setVendors] = useState(null);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function loadVendors() {
    const { data, error } = await supabase
      .from("brand_users")
      .select("id, user_id, profiles:user_id(email, role)")
      .eq("brand_id", b.id);
    if (error) {
      setVendors([]);
      return;
    }
    setVendors(data || []);
  }
  useEffect(() => { loadVendors(); }, [b.id]);

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
      const publicUrl = data?.publicUrl || null;
      await onSave(b, { logo_url: publicUrl });
    } catch (e2) {
      alert(e2.message || "No se pudo subir el logo.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    await onSave(b, { active: !b.active });
  }

  async function assignVendor() {
    try {
      setErr("");
      setSaving(true);
      const mail = email.trim().toLowerCase();
      if (!mail) { setErr("Ingresá un email."); return; }
      // El usuario debe existir (haberse logueado al menos una vez)
      const { data: prof, error: e1 } = await supabase
        .from("profiles")
        .select("user_id,email,role")
        .eq("email", mail)
        .maybeSingle();
      if (e1) throw e1;
      if (!prof?.user_id) { setErr("Ese email aún no se registró en el sitio."); return; }
      // Insert brand_users (único por brand+user)
      const ins = await supabase.from("brand_users").insert({ brand_id: b.id, user_id: prof.user_id });
      if (ins.error && !String(ins.error.message).includes("duplicate")) throw ins.error;
      await loadVendors();
      setEmail("");
      alert("Vendedor asignado.");
    } catch (e) {
      setErr(e.message || "No se pudo asignar.");
    } finally {
      setSaving(false);
    }
  }

  async function removeVendor(linkId) {
    if (!confirm("¿Quitar vendedor de esta marca?")) return;
    const del = await supabase.from("brand_users").delete().eq("id", linkId);
    if (del.error) {
      alert(del.error.message || "No se pudo quitar.");
      return;
    }
    await loadVendors();
  }

  return (
    <article className="card" style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,.08)", position: "relative", background: "#0E1012" }}>
          {b.logo_url && <Image src={b.logo_url} alt={`${b.name} logo`} fill sizes="64px" style={{ objectFit: "cover" }} unoptimized />}
        </div>
        <div style={{ flex: 1 }}>
          <strong>{b.name}</strong> <span style={{ color: "var(--text-dim)" }}>/marcas/{b.slug}</span>
          <div style={{ color: "var(--text-dim)", fontSize: ".9rem" }}>
            Creada: {fmtDT(b.created_at)} · {b.deleted_at ? <span style={{ color: "#f77" }}>Eliminada</span> : (b.active ? "Activa" : "Inactiva")}
          </div>
        </div>
        <Link href={`/marcas/${b.slug}`} className="btn ghost" target="_blank" rel="noreferrer">Ver</Link>
      </div>

      {/* Datos editables */}
      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
        <label className="input-label">Descripción</label>
        <textarea className="input" rows={3} defaultValue={b.description || ""} onBlur={(e) => onSave(b, { description: e.target.value })} />

        <label className="input-label">Color (hex)</label>
        <input className="input" defaultValue={b.color || ""} onBlur={(e) => onSave(b, { color: e.target.value })} />

        <label className="input-label">Alias bancario</label>
        <input className="input" defaultValue={b.bank_alias || ""} onBlur={(e) => onSave(b, { bank_alias: e.target.value || null })} />

        <label className="input-label">CBU/CVU</label>
        <input className="input" defaultValue={b.bank_cbu || ""} onBlur={(e) => onSave(b, { bank_cbu: e.target.value || null })} />

        <label className="input-label">MP access token (opcional)</label>
        <input className="input" defaultValue={b.mp_access_token || ""} onBlur={(e) => onSave(b, { mp_access_token: e.target.value || null })} />

        <div className="row" style={{ gap: 8, alignItems: "center", marginTop: 6 }}>
          <label className="chip">
            <input type="checkbox" checked={!!b.active} onChange={toggleActive} /> Activa
          </label>
          <label className="input-label" style={{ marginLeft: "auto" }}>
            Logo <input type="file" className="input" accept="image/*" onChange={handleLogo} disabled={saving} />
          </label>
        </div>
      </div>

      {/* Asignación de vendedores */}
      <div style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Vendedores</h3>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            placeholder="email del vendedor (debe haber iniciado sesión al menos una vez)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
        {err ? <div className="card" style={{ padding: 8, border: "1px solid #a33", marginTop: 8 }}>{err}</div> : null}
        <div style={{ marginTop: 8 }}>
          <button className="btn" onClick={assignVendor} disabled={saving}>Asignar</button>
        </div>

        <div className="card" style={{ padding: 0, marginTop: 12 }}>
          {!vendors ? (
            <div className="skel" style={{ height: 120 }} />
          ) : vendors.length === 0 ? (
            <div style={{ padding: 12 }}>No hay vendedores asignados.</div>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Email</th><th>Rol actual</th><th>Acción</th></tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id}>
                    <td>{v.profiles?.email || v.user_id}</td>
                    <td>{v.profiles?.role || "—"}</td>
                    <td><button className="btn ghost" onClick={() => removeVendor(v.id)}>Quitar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Acciones destructivas */}
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        {!b.deleted_at ? (
          <button className="btn danger" onClick={() => onDelete(b)}>Eliminar (soft)</button>
        ) : (
          <button className="btn" onClick={() => onRestore(b)}>Restaurar</button>
        )}
      </div>
    </article>
  );
}
