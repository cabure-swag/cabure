// pages/admin/index.jsx
import React, { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// ============= Error Boundary (evita pantallas negras) =============
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "Error desconocido" };
  }
  componentDidCatch(error, info) {
    // Podés loguear a Supabase audit_logs si querés
    // console.error("Admin crash:", error, info);
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
              <button className="btn ghost" onClick={() => location.reload()}>
                Reintentar
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============= Admin Page =============
export default function AdminPage() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null); // 'admin' | 'vendor' | null
  const [loading, setLoading] = useState(true);

  // Datos demo seguros para que no rompa si falla la DB
  const [brands, setBrands] = useState([]);
  const [loadingBrands, setLoadingBrands] = useState(false);

  useEffect(() => {
    let alive = true;

    async function bootstrap() {
      try {
        const { data } = await supabase.auth.getSession();
        const s = data?.session ?? null;
        if (!alive) return;
        setSession(s);

        if (s?.user?.id) {
          const { data: prof, error } = await supabase
            .from("profiles")
            .select("role")
            .eq("user_id", s.user.id)
            .maybeSingle();
          if (error) {
            // Si falla profiles, asumimos no admin para no romper
            setRole(null);
          } else {
            setRole(prof?.role ?? null);
          }
        } else {
          setRole(null);
        }
      } catch (_e) {
        setRole(null);
      } finally {
        if (alive) setLoading(false);
      }
    }

    bootstrap();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
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

  // Traer marcas (solo si sos admin)
  useEffect(() => {
    if (!session || role !== "admin") return;
    let alive = true;
    setLoadingBrands(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("brands")
          .select("id,name,slug,description,logo_url,active,deleted_at,instagram_url")
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (alive) setBrands(data ?? []);
      } catch (_e) {
        if (alive) setBrands([]);
      } finally {
        if (alive) setLoadingBrands(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [session, role]);

  // Acciones
  const logout = async () => {
    await supabase.auth.signOut();
  };

  // UI States
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

  // Panel admin mínimo y seguro
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

        {/* Bloque: Marcas */}
        <section className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <h2 style={{ margin: 0 }}>Marcas</h2>
            <Link href="/admin/support" className="btn secondary">Ver Soporte</Link>
          </div>

          {loadingBrands ? (
            <div className="skel" style={{ height: 120, borderRadius: 12, marginTop: 12 }} />
          ) : brands.length === 0 ? (
            <div className="card" style={{ padding: 16, marginTop: 12 }}>
              Aún no hay marcas creadas.
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
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <strong>{b.name}</strong>
                        {!b.active && (
                          <span className="badge" aria-label="inactiva">inactiva</span>
                        )}
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

                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <Link className="btn ghost" href={`/marcas/${b.slug}`} target="_blank">
                      Ver pública
                    </Link>
                    {/* Botones futuro: Editar/Eliminar (soft delete) */}
                    {/* <button className="btn secondary">Editar</button>
                    <button className="btn danger">Eliminar</button> */}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Tips/links rápidos */}
        <section className="card" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Atajos</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              <Link href="/admin/metrics">Métricas</Link>
            </li>
            <li>
              <Link href="/vendor">Vendor</Link>
            </li>
          </ul>
        </section>
      </div>
    </ErrorBoundary>
  );
}

// Evitamos cualquier prerender no deseado que pueda romper con objetos del browser
export async function getServerSideProps() {
  return { props: {} };
}
