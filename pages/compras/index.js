import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { money } from '../../utils/money';

export default function Orders(){
  const [orders, setOrders] = useState([]);
  useEffect(()=>{
    async function load(){
      const { data: s } = await supabase.auth.getSession();
      const u = s?.session?.user;
      if (!u) return setOrders([]);
      const { data } = await supabase
        .from('orders')
        .select('id,brand_slug,subtotal,total,pay,shipping,created_at')
        .order('created_at', { ascending: false });
      setOrders(data || []);
    }
    load();
  },[]);

  return (
    <main className="container">
      <h1 className="h1">Mis Compras</h1>
      {orders.length===0 ? <p className="small">No tenés pedidos aún.</p> : (
        <div className="grid">
          {orders.map(o => (
            <div className="card" key={o.id}>
              <div className="row">
                <strong>{o.id}</strong>
                <span className="small">{new Date(o.created_at).toLocaleString('es-AR')}</span>
              </div>
              <div className="small">Marca: {o.brand_slug}</div>
              <div className="small">Pago: {o.pay}</div>
              <div className="small">Envío: {o.shipping}</div>
              <div className="row"><span>Subtotal: {money(o.subtotal)}</span><strong>{money(o.total)}</strong></div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
