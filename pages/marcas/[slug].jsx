import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { money } from "@/utils/formatters";

const CATS = ['Todas','Remera','Pantalon','Buzo','Campera','Gorra','Otros'];

export default function BrandPage(){
  const router = useRouter();
  const { slug } = router.query;
  const [brand, setBrand] = useState(null);
  const [products, setProducts] = useState([]);
  const [cat, setCat] = useState('Todas');
  const [q, setQ] = useState('');

  useEffect(() => {
    if(!slug) return;
    (async () => {
      const { data: b } = await supabase.from('brands').select('*').eq('slug', slug).limit(1).maybeSingle();
      setBrand(b);
      const { data: p } = await supabase.from('products').select('*').eq('brand_id', b?.id).eq('active', true).is('deleted_at', null).order('created_at', { ascending: false });
      setProducts(p || []);
    })();
  }, [slug]);

  const filtered = useMemo(() => {
    return products.filter(p => (cat==='Todas' || p.category===cat || p.subcategory===cat) && (q.trim()==='' || p.name.toLowerCase().includes(q.toLowerCase())));
  }, [products, cat, q]);

  if (!brand) return <div className="container"><div className="status-loading skeleton" style={{height:80}}/></div>;

  return (
    <div className="container">
      <Head>
        <title>{brand.name} — CABURE.STORE</title>
        <meta name="description" content={brand.description || brand.name} />
        <meta property="og:title" content={`${brand.name} — CABURE.STORE`} />
        <meta property="og:image" content={brand.logo_url || '/cabure-logo.png'} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify({
          "@context":"https://schema.org",
          "@type":"Brand",
          name: brand.name,
          url: (process.env.NEXT_PUBLIC_SITE_URL || 'https://cabure.store') + `/marcas/${brand.slug}`,
          logo: brand.logo_url || '/cabure-logo.png'
        })}} />
      </Head>
      <div className="card" style={{display:'flex', alignItems:'center', gap:12, padding:14}}>
        <Image src={brand.logo_url || '/cabure-logo.png'} alt={`Logo ${brand.name}`} width={80} height={80} />
        <div>
          <h1 style={{margin:'8px 0'}}>{brand.name}</h1>
          <p style={{color:'var(--muted)'}}>{brand.description}</p>
        </div>
      </div>

      <div className="row" style={{marginTop:12}}>
        <div style={{flex:1}}>
          <label className="label" htmlFor="search">Buscar</label>
          <input id="search" className="input" placeholder="Buscar producto…" value={q} onChange={e=>setQ(e.target.value)} />
        </div>
      </div>

      <div className="chips" role="tablist" aria-label="Filtros">
        {CATS.map(c => (
          <button key={c} role="tab" aria-selected={cat===c} className="chip" onClick={()=>setCat(c)}>{c}</button>
        ))}
      </div>

      {filtered.length===0 && <div className="status-empty">No hay productos para mostrar.</div>}

      <div className="grid" role="list">
        {filtered.map(p => (
          <div key={p.id} className="card" role="listitem">
            <Image src={p.image_url || '/cabure-logo.png'} alt={p.name} width={600} height={600} />
            <div className="card-body">
              <div className="card-title">{p.name}</div>
              <div style={{color:'var(--muted)'}}>{p.subcategory || p.category}</div>
              <div style={{marginTop:6,fontWeight:700}}>{money(p.price)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}