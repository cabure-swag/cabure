import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { money } from '../utils/money';

export default function Home(){
  const [brands, setBrands] = useState([]);

  useEffect(()=>{
    const load = async () => {
      const { data } = await supabase.from('brands').select('slug,name,logo_url,description');
      setBrands(data || []);
    };
    load();
  },[]);

  return (
    <main className="container">
      <h1 className="h1">Marcas</h1>
      <div className="grid" style={{gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))'}}>
        {brands.map(b => (
          <a key={b.slug} className="card" href={`/marcas/${b.slug}`}>
            <div className="row">
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <img src={b.logo_url || '/logo.png'} alt={b.name} style={{width:40,height:40,objectFit:'contain',borderRadius:8,background:'#111',border:'1px solid #151515'}}/>
                <div>
                  <div style={{fontWeight:800}}>{b.name}</div>
                  <div className="small">{b.description}</div>
                </div>
              </div>
              <div className="badge">Ver</div>
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}
