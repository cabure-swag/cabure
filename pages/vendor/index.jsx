import Head from "next/head";
import { withRoleGuard } from "@/utils/roleGuards";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { money, yyyyMm, downloadCSV } from "@/utils/formatters";

function Vendor(){
  const [brands, setBrands] = useState([]);
  const [sel, setSel] = useState(null);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ name:'', price:'', category:'Otros', subcategory:'', image_url:'' });
  const [month, setMonth] = useState(yyyyMm());

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: bs } = await supabase.from('brand_users').select('brands(*)').eq('user_id', session.user.id);
      setBrands((bs||[]).map(x => x.brands));
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!sel) return setProducts([]);
      const { data } = await supabase.from('products').select('*').eq('brand_id', sel.id).is('deleted_at', null);
      setProducts(data || []);
    })();
  }, [sel]);

  const uploadImage = async (file) => {
    if (!file) return;
    const filename = `${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from('product-images').upload(filename, file, { upsert:false });
    if (error) return alert('No se pudo subir');
    const { data } = await supabase.storage.from('product-images').getPublicUrl(filename);
    setForm(f => ({ ...f, image_url: data.publicUrl }));
  };

  const createProduct = async (e) => {
    e.preventDefault();
    if (!sel) return;
    const { error } = await supabase.from('products').insert({ ...form, price: Number(form.price||0), brand_id: sel.id });
    if (error) return alert('Error al crear');
    setForm({ name:'', price:'', category:'Otros', subcategory:'', image_url:'' });
    const { data } = await supabase.from('products').select('*').eq('brand_id', sel.id).is('deleted_at', null);
    setProducts(data || []);
  };

  const removeProduct = async (p) => {
    await supabase.from('products').update({ deleted_at: new Date().toISOString(), active:false }).eq('id', p.id);
    const { data } = await supabase.from('products').select('*').eq('brand_id', sel.id).is('deleted_at', null);
    setProducts(data || []);
    await supabase.from('audit_logs').insert({ action:'delete', entity:'product', entity_id:p.id });
  };

  const exportMonth = async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, total, created_at, order_items:order_items(qty, unit_price, product_id)')
      .eq('brand_id', sel.id)
      .gte('created_at', `${month}-01`).lte('created_at', `${month}-31`);
    const rows = [];
    (data||[]).forEach(o => {
      (o.order_items||[]).forEach(i => {
        rows.push({ order_id:o.id, date:o.created_at, product_id:i.product_id, qty:i.qty, unit_price:i.unit_price, total:o.total });
      });
    });
    downloadCSV(rows, `ventas-${sel.slug}-${month}.csv`);
  };

  return (
    <div className="container">
      <Head><title>Vendedor — CABURE.STORE</title></Head>
      <h1>Panel de vendedor</h1>
      <div className="row">
        <label className="label" htmlFor="brandSel">Marca</label>
        <select id="brandSel" className="input" onChange={e=>setSel(brands.find(b => b.id===e.target.value))}>
          <option>Elegí…</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {!sel && <div className="status-empty">Seleccioná una marca donde seas vendedor.</div>}

      {sel && (
        <>
          <h3 style={{marginTop:12}}>Productos</h3>
          <form onSubmit={createProduct} className="card" style={{padding:14}}>
            <div className="row">
              <div style={{flex:1}}><label className="label" htmlFor="pname">Nombre</label><input id="pname" required className="input" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} /></div>
              <div><label className="label" htmlFor="price">Precio</label><input id="price" className="input" type="number" value={form.price} onChange={e=>setForm({...form, price:e.target.value})} /></div>
              <div><label className="label" htmlFor="cat">Categoría</label><select id="cat" className="input" value={form.category} onChange={e=>setForm({...form, category:e.target.value})}><option>Remera</option><option>Pantalon</option><option>Buzo</option><option>Campera</option><option>Gorra</option><option>Otros</option></select></div>
              <div><label className="label" htmlFor="subcat">Subcategoría</label><input id="subcat" className="input" value={form.subcategory} onChange={e=>setForm({...form, subcategory:e.target.value})} /></div>
            </div>
            <div className="row" style={{marginTop:8}}>
              <div><label className="label" htmlFor="img">Imagen</label><input id="img" type="file" onChange={e=>uploadImage(e.target.files[0])} /></div>
              <div style={{flex:1}} />
              <button className="btn btn-primary" type="submit">Crear</button>
            </div>
          </form>

          <div className="grid">
            {products.map(p => (
              <div key={p.id} className="card">
                <img src={p.image_url || '/cabure-logo.png'} alt={p.name} />
                <div className="card-body">
                  <div className="row" style={{justifyContent:'space-between'}}>
                    <div className="card-title">{p.name}</div>
                    <div>{money(p.price)}</div>
                  </div>
                  <button className="btn btn-danger" onClick={()=>removeProduct(p)}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>

          <h3 style={{marginTop:12}}>Métricas</h3>
          <div className="row" style={{alignItems:'end'}}>
            <div>
              <label className="label" htmlFor="month">Mes</label>
              <input id="month" className="input" type="month" value={month} onChange={e=>setMonth(e.target.value)} />
            </div>
            <button className="btn" onClick={exportMonth}>Exportar CSV</button>
          </div>
        </>
      )}
    </div>
  );
}
export default withRoleGuard(Vendor, { requireVendor: true });