import React from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { lines, total, clear } from '../../utils/cart';
import { money } from '../../utils/money';

export default function Checkout(){
  const router = useRouter();
  const { brandSlug } = router.query;
  const [brand, setBrand] = React.useState(null);
  const [shipping, setShipping] = React.useState('domicilio');
  const [pay, setPay] = React.useState('transferencia');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(()=>{
    if (!brandSlug) return;
    supabase.from('brands').select('*').eq('slug', brandSlug).single().then(({data})=> setBrand(data||null));
  },[brandSlug]);

  if (!brandSlug) return null;
  if (!brand) return <main className="container"><h1>Marca no encontrada</h1></main>;

  const cartLines = typeof window !== 'undefined' ? lines(brandSlug) : [];
  const subtotal = typeof window !== 'undefined' ? total(brandSlug) : 0;
  const mpFee = Math.round(subtotal * ((brand?.mp_fee||0)/100));

  async function confirm(e){
    e.preventDefault();
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const user = sess?.session?.user;
      if (!user) { alert('Iniciá sesión con Google para confirmar.'); setBusy(false); return; }

      // 1) crear order
      const totalAmount = subtotal + (pay==='mp' ? mpFee : 0);
      const orderPayload = {
        user_id: user.id,
        brand_slug: brandSlug,
        shipping, pay,
        mp_fee: brand.mp_fee || 0,
        subtotal, total: totalAmount
      };
      const { data: order, error: e1 } = await supabase.from('orders').insert(orderPayload).select('*').single();
      if (e1) throw e1;

      // 2) items
      const itemsPayload = cartLines.map(l => ({
        order_id: order.id,
        product_id: l.id,
        name: l.name,
        price: l.price,
        qty: l.qty
      }));
      const { error: e2 } = await supabase.from('order_items').insert(itemsPayload);
      if (e2) throw e2;

      clear(brandSlug);
      alert('Pedido confirmado: ' + order.id);
      window.location.href='/compras';
    } catch(err){
      alert('Error: ' + (err?.message || String(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container">
      <h1 className="h1">Checkout — {brand.name}</h1>
      <div className="grid" style={{gridTemplateColumns:'1fr 1fr'}}>
        <form className="card" onSubmit={confirm}>
          <div className="mb">
            <label>Método de envío</label>
            <select value={shipping} onChange={e=>setShipping(e.target.value)}>
              <option value="domicilio">Correo Argentino a domicilio</option>
              <option value="sucursal">Correo Argentino a sucursal</option>
            </select>
          </div>
          <div className="mb">
            <label>Pago</label>
            <select value={pay} onChange={e=>setPay(e.target.value)}>
              <option value="transferencia">Transferencia</option>
              <option value="mp">Mercado Pago (+{brand.mp_fee}%)</option>
            </select>
          </div>
          <button className="btn" disabled={cartLines.length===0 || busy}>{busy?'Confirmando...':'Confirmar pedido'}</button>
        </form>
        <div className="card">
          <strong>Resumen</strong>
          <table className="table mt">
            <thead><tr><th>Item</th><th>Cant</th><th>Precio</th></tr></thead>
            <tbody>
              {cartLines.map(l=> <tr key={l.id}><td>{l.name}</td><td>{l.qty}</td><td>{money(l.price*l.qty)}</td></tr>)}
            </tbody>
          </table>
          <div className="row mt"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          {pay==='mp' && <div className="row"><span>Recargo MP</span><span>{money(mpFee)}</span></div>}
          <div className="row"><strong>Total</strong><strong>{money(subtotal + (pay==='mp'? mpFee:0))}</strong></div>
        </div>
      </div>
    </main>
  );
}
