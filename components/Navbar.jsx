import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Navbar(){
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(()=>{
    const load = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const u = data?.session?.user || null;
        setUser(u);
        if (u) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', u.id)
            .single();
          setRole(prof?.role || 'user');
        } else {
          setRole(null);
        }
      } catch(e){
        setUser(null);
        setRole(null);
      }
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s)=>{
      setUser(s?.user || null);
    });
    return () => { sub?.subscription?.unsubscribe(); };
  },[]);

  const signInGoogle = async ()=>{
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined } });
  };
  const signOut = async ()=>{
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <header className="nav">
      <div className="nav-inner">
        <a href="/" className="brand">CABUREE</a>
        <div className="menu">
          <a className="badge" href="/marcas">Marcas</a>
          <a className="badge" href="/compras">Mis Compras</a>
          <a className="badge" href="/soporte">Soporte</a>
          {(role === 'vendor' || role === 'admin') && <a className="badge" href="/vendedor">Vendedor</a>}
          {role === 'admin' && <a className="badge" href="/admin">Admin</a>}
          {!user ? (
            <button className="btn-ghost" onClick={signInGoogle}>Iniciar sesión (Google)</button>
          ) : (
            <button className="btn-ghost" onClick={signOut}>Salir</button>
          )}
        </div>
      </div>
    </header>
  );
}
