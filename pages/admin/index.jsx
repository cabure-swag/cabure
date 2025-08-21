// pages/admin/index.jsx
import React, { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "Error desconocido" };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="container">
          <div className="card" style={{ padding: 24 }}>
            <h2 style={{ marginTop: 0 }}>Ocurrió un error en Admin</h2>
            <p style={{ color: "var(--text-dim)" }}>{this.state.message}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <Link href="/" className="btn secondary">Volver al inicio</Link>
              <button className="btn ghost" onClick={() => location.reload()}>Reintentar</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AdminPage() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const [brands, setBrands] = useState([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    let alive = true;
    async function bootstrap() {
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
      setLoading(false);
    }
    bootstrap();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!alive) return;
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

  async function loadBrands() {
    setLoadingBrands(true);
    try {
      const { data, error } = await supabase
        .from("brands")
        .select("id,name,slug,description,logo_url,instagram_url,active,deleted_at,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setBrands(data ?? []);
    } catch {
      setBrands([]);
    } finally {
      setLoadingBrands(false);
    }
  }

  useEffect(() => {
    if (session && role === "admin") loadBrands();
  }, [session, role]);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const togglePublic = async (brand) => {
    try {
      setSavingId(brand.id);
      // si activamos, borramos deleted_at; si desactivamos, sólo active=false
      const updates = brand.active
        ? { active: false }
        : { active: true, deleted_at: null };
      const { error } = await supabase
        .from("brands")
        .update(updates)
        .eq("id", brand.id);
      if (error) throw error;
      // refrescar lista (o actualizar optimist)
      setBrands((prev) => prev.map((b) => (b.id === brand.id ? { ...b, ...updates } : b)));
    } catch (e) {
      // noop, podríamos mostrar toast si tenés sistema
      console.error("No se pudo actualizar la marca:", e.message);
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="skel" style={{ height: 80, borderRadius: 12, marginTop: 16 }} />
        <div className="skel" style={{ height: 200, borderRadius: 12, marginTop: 16 }} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container">
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>Admin</h2>
          <p>Necesitás iniciar sesión para entrar al panel.</p>
          <Link href="/soporte" className="btn">Iniciar sesión</Link>
        </div>
      </div>
    );
  }

  if (role !== "admin") {
    return (
      <div className="container">
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>Sin permiso</h2>
          <p>Tu usuario no tiene rol de administrador.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/" className="btn secondary">Volver</Link>
            <button className="btn ghost" onClick={logout}>Cerrar sesión</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="container">
        <Head>
          <title>Admin — CABURE.STORE</title>
          <meta name="robots" content="noindex" />
        </Head>

        <div
          className="row"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}
        >
          <h1 style={{ margin: 0 }}>Panel de Admin</h1>
          <button className="btn ghost" onClick={logout}>Cerrar sesión</button>
        </div>

        <section className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <h2 style={{ margin: 0 }}>Marcas</h2>
            <Link href="/admin/support" className="btn secondary">Ver Soporte</Link>
          </div>

          {loadingBrands ? (
            <div className="skel" style={{ height: 120, borderRadius: 12, marginTop: 12 }} />
          ) : brands.length === 0 ? (
            <div className="card" style={{ padding: 16, marginTop: 12 }}>
              No hay marcas para mostrar.
            </div>
          ) : (
            <div className="grid grid-3" style={{ marginTop: 12 }}>
              {brands.map((b) => (
                <article key={b.id} className="card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 10,
                        background: "#0E1012",
                        border: "1px solid rgba(255,255,255,.08)",
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      {b.logo_url ? (
                        <Image
                          src={b.logo_url}
                          alt={`${b.name} logo`}
                          fill
                          sizes="48px"
                          style={{ objectFit: "cover" }}
                        />
                      ) : null}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <strong>{b.name}</strong>
                        {!b.active && <span className="badge">inactiva</span>}
                      </div>
                      <div style={{ color: "var(--text-dim)", fontSize: ".9rem" }}>
                        /marcas/{b.slug}
                      </div>
                    </div>
                  </div>

                  <p
                    style={{
                      marginTop: 8,
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

                  <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                    <label className="chip" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={!!b.active}
                        disabled={savingId === b.id}
                        onChange={() => togglePublic(b)}
                        aria-label={b.active ? "Despublicar" : "Publicar"}
                      />
                      {savingId === b.id ? "Guardando..." : b.active ? "Pública" : "Privada"}
                    </label>

                    <Link className="btn ghost" href={`/marcas/${b.slug}`} target="_blank">
                      Ver pública
                    </Link>

                    {b.instagram_url ? (
                      <a href={b.instagram_url} target="_blank" rel="noreferrer" className="btn ghost">
                        Instagram
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </ErrorBoundary>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
