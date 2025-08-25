// pages/vendor/index.jsx
import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ChatBox from "@/components/ChatBox";

const TABS = ["Chats", "Catálogo", "Pedidos"];

export default function VendorPage() {
  const [session, setSession] = useState(null);

  // pestañas
  const [tab, setTab] = useState("Chats");

  // marcas donde soy vendedor
  const [brands, setBrands] = useState([]);
  const [brandId, setBrandId] = useState(null);

  // hilos de la marca actual
  const [threads, setThreads] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState(null);

  // nombres de compradores
  const [buyerMap, setBuyerMap] = useState({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // cargar marcas asignadas
  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("brand_users")
        .select("brand_id, brands!inner(id,name,slug)")
        .eq("user_id", session.user.id);
      if (error) { console.error(error); return; }
      const bs = (data || []).map(r => r.brands).filter(Boolean);
      if (!cancelled) {
        setBrands(bs);
        if (bs.length && !brandId) setBrandId(bs[0].id);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const activeBrand = useMemo(() => brands.find(b => b.id === brandId) || null, [brands, brandId]);

  // cargar hilos cuando cambia la marca
  useEffect(() => {
    if (!activeBrand?.id) { setThreads([]); setActiveThreadId(null); return; }
    let cancelled = false;
    (async () => {
      setLoadingThreads(true);
      try {
        const { data: ts } = await supabase
          .from("support_threads")
          .select("id,user_id,status,created_at")
          .eq("brand_id", activeBrand.id)
          .order("status", { ascending: true })
          .order("created_at", { ascending: false });
        if (!cancelled) {
          setThreads(ts || []);
          setActiveThreadId(ts?.[0]?.id || null);
        }
      } finally {
        if (!cancelled) setLoadingThreads(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeBrand?.id]);

  // mapa de compradores
  useEffect(() => {
    if (!threads.length) { setBuyerMap({}); return; }
    let cancelled = false;
    (async () => {
      const ids = Array.from(new Set(threads.map(t => t.user_id).filter(Boolean)));
      if (!ids.length) return;
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id,email,full_name,name")
        .in("user_id", ids);
      const map = {};
      (profiles || []).forEach(p => { map[p.user_id] = p.full_name || p.name || p.email || "Cliente"; });
      if (!cancelled) setBuyerMap(map);
    })();
    return () => { cancelled = true; };
  }, [threads]);

  // realtime refresco de lista
  useEffect(() => {
    if (!activeBrand?.id) return;
    const ch = supabase
      .channel(`threads_${activeBrand.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "support_threads", filter: `brand_id=eq.${activeBrand.id}` },
        async () => {
          const { data: ts } = await supabase
            .from("support_threads")
            .select("id,user_id,status,created_at")
            .eq("brand_id", activeBrand.id)
            .order("status", { ascending: true })
            .order("created_at", { ascending: false });
          setThreads(ts || []);
        }
      ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeBrand?.id]);

  if (!session?.user) {
    return (
      <div className="container">
        <Head><title>Vendedor — CABURE.STORE</title></Head>
        <div className="status-empty">
          <p>Ingresá para ver tu panel.</p>
          <button className="btn btn-primary" onClick={() => supabase.auth.signInWithOAuth({ provider: "google" })}>
            Ingresar con Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingBottom: 56 }}>
      <Head><title>Vendedor — CABURE.STORE</title></Head>

      {/* Header */}
      <div className="row" style={{ alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Vendedor</h1>
        <div style={{ flex: 1 }} />
        {brands.length > 0 && (
          <select
            className="input"
            aria-label="Seleccionar marca"
            value={brandId || ""}
            onChange={(e) => setBrandId(e.target.value)}
            style={{ maxWidth: 320 }}
          >
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      {!activeBrand ? (
        <div className="card" style={{ marginTop: 12, padding: 16, border: "1px dashed var(--border)" }}>
          No tenés marcas asignadas todavía.
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="row" role="tablist" aria-label="Secciones del panel" style={{ gap: 8, marginTop: 12 }}>
            {TABS.map(t => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                className={`chip ${tab === t ? "chip--active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <Link href={`/marcas/${encodeURIComponent(activeBrand.slug)}`} className="btn btn-ghost">
              Ver marca
            </Link>
          </div>

          {/* Contenido por tab */}
          {tab === "Chats" && (
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, alignItems: "start" }}>
              <section className="card" style={{ padding: 12 }}>
                <h2 style={{ marginTop: 0 }}>Chats</h2>
                {loadingThreads ? (
                  <div className="skeleton" style={{ marginTop: 12, height: 64, borderRadius: 10 }} />
                ) : threads.length === 0 ? (
                  <div className="card" style={{ marginTop: 12, padding: 12, border: "1px dashed var(--border)", color: "#9aa" }}>
                    No hay tickets por ahora.
                  </div>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0 0", display: "grid", gap: 8 }}>
                    {threads.map(t => {
                      const buyerName = buyerMap[t.user_id] || "Cliente";
                      const active = t.id === activeThreadId;
                      return (
                        <li key={t.id}>
                          <button
                            className="btn"
                            onClick={() => setActiveThreadId(t.id)}
                            aria-label={`Abrir chat con ${buyerName}`}
                            style={{
                              width: "100%",
                              justifyContent: "flex-start",
                              background: active ? "var(--brand)" : "var(--panel)",
                              color: active ? "#000" : "var(--text)",
                              border: "1px solid var(--border)"
                            }}
                          >
                            <div style={{ textAlign: "left" }}>
                              <div style={{ fontWeight: 600 }}>{buyerName}</div>
                              <div style={{ fontSize: 12, opacity: 0.8 }}>
                                {t.status === "open" ? "Abierto" : t.status} · {new Date(t.created_at).toLocaleString("es-AR", { hour12: false })}
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="card" style={{ padding: 12, minHeight: 520 }}>
                {!activeThreadId ? (
                  <div className="status-empty">Seleccioná un chat para comenzar.</div>
                ) : (
                  <ChatBox threadId={activeThreadId} />
                )}
              </section>
            </div>
          )}

          {tab === "Catálogo" && (
            <section className="card" style={{ padding: 16, marginTop: 12 }}>
              <h2 style={{ marginTop: 0 }}>Catálogo</h2>
              <div style={{ color: "#9aa" }}>
                Acá va tu CRUD de productos y stock (sigue funcionando como lo tenías).
              </div>
            </section>
          )}

          {tab === "Pedidos" && (
            <section className="card" style={{ padding: 16, marginTop: 12 }}>
              <h2 style={{ marginTop: 0 }}>Pedidos</h2>
              <div style={{ color: "#9aa" }}>
                Listado de órdenes, detalle y acciones (eliminar, exportar CSV).
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
