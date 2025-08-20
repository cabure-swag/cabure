import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function withRoleGuard(PageComponent, { requireAdmin=false, requireVendor=false } = {}) {
  const Guarded = (props) => {
    const [state, setState] = useState({ loading: true, allowed: false, role: null });

    useEffect(() => {
      let mounted = true;
      (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setState({ loading:false, allowed:false, role:null }); return; }
        const { data: profile } = await supabase.from('profiles').select('user_id, email, role').eq('user_id', session.user.id).single();
        const role = profile?.role ?? null;
        const allowed = (requireAdmin && role==='admin') || (requireVendor && (role==='vendor'||role==='admin')) || (!requireAdmin && !requireVendor);
        if (mounted) setState({ loading:false, allowed, role });
      })();
      return () => { mounted=false; };
    }, []);

    if (state.loading) return <div className="container"><div className="status-loading skeleton" style={{height:80}} aria-busy="true" aria-live="polite">Cargando…</div></div>;
    if (!state.allowed) return <div className="container"><div className="status-error" role="alert">Necesitás permisos para ver esta sección.</div></div>;
    return <PageComponent {...props} />;
  };
  return Guarded;
}