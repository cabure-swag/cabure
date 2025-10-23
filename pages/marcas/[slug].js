import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { add, lines, total, clear } from '../../utils/cart';
import { money } from '../../utils/money';

export default function Brand(){
  const router = useRouter();
  const { slug } = router.query;
  const [brand, setBrand] = useState(null);
  const [products, setProducts] = useState([]);
  const [role, setRole] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(()=>{
    if (!slug) return;
    async function load(){
      const { data: b } = await supabase.from('brands').select('*').eq('slug', slug).single();
      setBrand(b || null);
      const { data: ps } = await supabase.from('products').select('*').eq('brand_slug', slug).order('name');
      setProducts(ps || []);
      const { data: s } = await supabase.auth.getSession();
      const u = s?.session?.user || null;
      setUser(u);
      if (u){
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', u.id).single();
        setRole(prof?.role || 'user');
      }
    }
    load();
  },[slug]);

  if (!slug) return null;
  if (!brand) return <main className="container"><h1>Marca no encontrada</h1></main>;

  const cartLines = typeof window !== 'undefined' ? lines(slug) : [];
  const cartTotal = typeof window !== 'undefined' ? total(slug) : 0;

  const goCheckout = ()=> window.location.href = `/pedido/${slug}`;
  const empty = ()=> { clear(slug); window.location.reload(); };

  // Admin/vendor forms (simple)
  async function onAddProduct(e){
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      brand_slug: slug,
      name: form.get('name'),
      price: Number(form.get('price')||0),
      stock: Number(form.get('stock')||0),
      image_url: form.get('image_url') || null
    };
    const { error } = await supabase.from('products').insert(payload);
    if (error) return alert('Error: ' + error.message);
    alert('Producto creado');
    window.location.reload();
  }

  return (
    <main className="container">
      <div className="card">
        <div className="row">
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <img src={brand.logo_url || '/logo.png'} alt={brand.name} style={{width:60,height:60,objectFit:'contain',borderRadius:8,background:'#111',border:'1px solid #151515'}}/>
            <div>
              <h1 style={{margin:0}}>{brand.name}</h1>
              <div className="small">{brand.description}</div>
              {brand.instagram && <a className="small" href={brand.instagram} target="_blank" rel="noreferrer">IG</a>}
            </div>
          </div>
          <div className="badge">MP fee {brand.mp_fee}%</div>
        </div>
      </div>

      <h2 className="h2">Productos</h2>
      <div className="grid" style={{gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))'}}>
        {products.map(p => (
          <div key={p.id} className="card">
            <div className="row">
              <strong>{p.name}</strong>
              <span>{money(p.price)}</span>
            </div>
            <button className="btn" disabled={p.stock<=0} onClick={()=>{ add(slug, {id:p.id,name:p.name,price:p.price}, 1); alert('Agregado'); }}>
              {p.stock>0 ? 'Agregar' : 'Sin stock'}
            </button>
          </div>
        ))}
      </div>

      {(role==='admin' || role==='vendor') && (
        <div className="card" style={{marginTop:16}}>
          <strong>Agregar producto (admin/vendor)</strong>
          <form onSubmit={onAddProduct} className="grid" style={{gridTemplateColumns:'repeat(2, 1fr)'}}>
            <div><label>Nombre</label><input className="input" name="name" required/></div>
            <div><label>Precio</label><input className="input" name="price" type="number" min="0" required/></div>
            <div><label>Stock</label><input className="input" name="stock" type="number" min="0" required/></div>
            <div><label>Imagen (URL)</label><input className="input" name="image_url" placeholder="https://..."/></div>
            <div style={{gridColumn:'1 / -1'}}><button className="btn">Crear</button></div>
          </form>
        </div>
      )}

      <div className="card" style={{marginTop:16}}>
        <div className="row">
          <strong>Carrito ({cartLines.length} items)</strong>
          <div>{money(cartTotal)}</div>
        </div>
        <div className="row" style={{marginTop:12}}>
          <button className="btn" onClick={goCheckout} disabled={cartLines.length===0}>Ir al Checkout</button>
          <button className="btn-ghost" onClick={empty} disabled={cartLines.length===0}>Vaciar</button>
        </div>
      </div>
    </main>
  );
}
