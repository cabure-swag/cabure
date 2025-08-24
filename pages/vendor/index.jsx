// pages/vendor/index.jsx
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

function VendorInner() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [err, setErr] = useState("");

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

  return (
    <div className="container">
      <Head><title>Vendor — CABURE.STORE</title><meta name="robots" content="noindex"/></Head>
      <h1>Vendor</h1>
      {err && <div className="card" style={{ padding:12, border:"1px solid #a33" }}>{err}</div>}

      {!session && (
        <div className="card" style={{ padding:16 }}>
          <p>Necesitás iniciar sesión.</p>
          <Link className="btn" href="/soporte">Iniciar sesión</Link>
        </div>
      )}

      {session && role !== "vendor" && role !== "admin" && (
        <div className="card" style={{ padding:16 }}>
          <p>Tu usuario no tiene rol de vendedor.</p>
          <Link className="btn" href="/">Volver</Link>
        </div>
      )}

      {session && (role === "vendor" || role === "admin") && (
        <div className="card" style={{ padding:16 }}>
          <p>OK: estás como <b>{role}</b>. La ruta funciona.</p>
          <p>Próximo paso: re-agregar CRUD de catálogo/pedidos por bloques.</p>
        </div>
      )}
    </div>
  );
}

export default dynamic(() => Promise.resolve(VendorInner), { ssr: false });
