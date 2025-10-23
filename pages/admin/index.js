import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function Admin(){
  const [brands, setBrands] = useState([]);

  useEffect(()=>{
    supabase.from('brands').select('*').order('slug').then(({data})=> setBrands(data||[]));
  },[]);

  async function onCreateBrand(e){
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload = {
      slug: f.get('slug'),
      name: f.get('name'),
      description: f.get('description'),
      instagram: f.get('instagram'),
      mp_fee: Number(f.get('mp_fee')||0),
      logo_url: f.get('logo_url')
    };
    const { error } = await supabase.from('brands').insert(payload);
    if (error) return alert('Error: ' + error.message);
    alert('Marca creada');
    window.location.reload();
  }

  async function onAssignVendor(e){
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = f.get('email');
    const brand_slug = f.get('brand_slug');
    // Find user by email in auth (needs edge function normally). As a simple path, require user to have logged in at least once and be in profiles.
    const { data: prof } = await supabase.from('profiles').select('id').eq('email', email).single();
    if (!prof) return alert('Ese email no tiene perfil. Hacé que se loguee una vez.');
    const { error } = await supabase.from('vendor_brands').insert({ user_id: prof.id, brand_slug });
    if (error) return alert('Error: ' + error.message);
    alert('Vendor asignado');
  }

  return (
    <main className="container">
      <h1 className="h1">Admin</h1>

      <div className="card">
        <strong>Crear marca</strong>
        <form onSubmit={onCreateBrand} className="grid" style={{gridTemplateColumns:'repeat(2, 1fr)'}}>
          <div><label>Slug</label><input className="input" name="slug" placeholder="caburee" required/></div>
          <div><label>Nombre</label><input className="input" name="name" required/></div>
          <div><label>Descripción</label><input className="input" name="description"/></div>
          <div><label>Instagram (URL)</label><input className="input" name="instagram" placeholder="https://instagram.com/..."/></div>
          <div><label>% MP</label><input className="input" name="mp_fee" type="number" min="0" defaultValue="10"/></div>
          <div><label>Logo (URL)</label><input className="input" name="logo_url" placeholder="https://..."/></div>
          <div style={{gridColumn:'1/-1'}}><button className="btn">Crear</button></div>
        </form>
      </div>

      <h2 className="h2">Marcas</h2>
      <div className="grid" style={{gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))'}}>
        {brands.map(b => (
          <div className="card" key={b.slug}>
            <div className="row">
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <img src={b.logo_url || '/logo.png'} alt={b.name} style={{width:34,height:34,objectFit:'contain',borderRadius:8,background:'#111',border:'1px solid #151515'}}/>
                <strong>{b.name}</strong>
              </div>
              <a className="badge" href={`/marcas/${b.slug}`}>Ver</a>
            </div>
            <div className="small">IG: <a href={b.instagram} target="_blank" rel="noreferrer">{b.instagram}</a></div>
            <div className="small">Recargo MP: {b.mp_fee}%</div>
            <form onSubmit={onAssignVendor} className="mt">
              <strong>Asignar vendor</strong>
              <div className="grid" style={{gridTemplateColumns:'2fr 1fr'}}>
                <div><label>Email del vendor</label><input className="input" name="email" type="email" required/></div>
                <input type="hidden" name="brand_slug" value={b.slug}/>
                <div><button className="btn">Asignar</button></div>
              </div>
            </form>
          </div>
        ))}
      </div>
    </main>
  );
}
