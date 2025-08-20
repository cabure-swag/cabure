import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Checkout(){
  const router = useRouter();
  const { brandSlug } = router.query;
  const [brand, setBrand] = useState(null);
  const [method, setMethod] = useState('transfer');

  useEffect(() => {
    if (!brandSlug) return;
    (async () => {
      const { data } = await supabase.from('brands').select('*').eq('slug', brandSlug).maybeSingle();
      setBrand(data);
      if (data?.mp_access_token) setMethod('mp');
    })();
  }, [brandSlug]);

  const createPreference = async () => {
    const res = await fetch('/api/mp/create-preference', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ brandSlug, items: [{ title: 'Pedido', quantity: 1, currency_id: 'ARS', unit_price: 1000 }] })
    });
    const out = await res.json();
    if (out.init_point) window.location.href = out.init_point;
    else alert('No se pudo crear preferencia');
  };

  if (!brand) return <div className="container"><div className="status-loading skeleton" style={{height:80}}/></div>;

  return (
    <div className="container">
      <Head><title>Checkout — {brand.name}</title></Head>
      <h1>Pago — {brand.name}</h1>
      <p style={{color:'var(--muted)'}}>Elegí cómo pagar:</p>
      <div className="chips">
        {brand.mp_access_token && <button className="chip" onClick={()=>setMethod('mp')} aria-pressed={method==='mp'}>Tarjeta/QR (Mercado Pago)</button>}
        <button className="chip" onClick={()=>setMethod('transfer')} aria-pressed={method==='transfer'}>Transferencia</button>
      </div>

      {method==='mp' && brand.mp_access_token && (
        <div className="card" style={{padding:14}}>
          <p>Te vamos a redirigir a Mercado Pago.</p>
          <button className="btn btn-primary" onClick={createPreference}>Pagar con Mercado Pago</button>
        </div>
      )}

      {method==='transfer' && (
        <div className="card" style={{padding:14}}>
          <p>Transferí a:</p>
          <ul>
            <li><strong>Alias:</strong> {brand.bank_alias || '—'}</li>
            <li><strong>CBU:</strong> {brand.bank_cbu || '—'}</li>
          </ul>
          <p>Luego <a href="/soporte">escribinos por chat</a> con el comprobante.</p>
        </div>
      )}
    </div>
  );
}