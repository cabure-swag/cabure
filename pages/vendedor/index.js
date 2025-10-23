import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { money } from '../../utils/money';

export default function Vendedor(){
  const [orders, setOrders] = useState([]);
  const [brands, setBrands] = useState([]);

  useEffect(()=>{
    async function load(){
      const { data: s } = await supabase.auth.getSession();
      const u = s?.session?.user;
      if (!u) return;

      // brands for this vendor
      const { data: vb } = await supabase
        .from('vendor_brands')
        .select('brand_slug')
        .eq('user_id', u.id);
      const slugs = (vb||[]).map(x=>x.brand_slug);

      setBrands(slugs);

      if (slugs.length === 0) return setOrders([]);

      const { data } = await supabase
        .from('orders')
        .select('id,brand_slug,subtotal,total,pay,shipping,created_at')
        .in('brand_slug', slugs)
        .order('created_at', { ascending: false });
      setOrders(data||[]);
    }
    load();
  },[]);

  return (
    <main className="container">
      <h1 className="h1">Panel Vendedor</h1>
      <p className="small">Marcas asignadas: {brands.join(', ') || 'ninguna'}</p>
      <div className="grid">
        {orders.map(o => (
          <div className="card" key={o.id}>
            <div className="row">
              <strong>{o.id}</strong>
              <span className="small">{new Date(o.created_at).toLocaleString('es-AR')}</span>
            </div>
            <div className="small">Marca: {o.brand_slug}</div>
            <div className="row"><span>Pago: {o.pay}</span><strong>{money(o.total)}</strong></div>
          </div>
        ))}
      </div>
    </main>
  );
}
