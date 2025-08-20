import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Home(){
  const [brands, setBrands] = useState(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('brands').select('*').eq('active', true).is('deleted_at', null).order('created_at', { ascending: false });
      setBrands(data || []);
    })();
  }, []);

  return (
    <div className="container">
      <Head>
        <title>CABURE.STORE — Marcas</title>
        <meta name="description" content="Tienda colectiva de marcas jóvenes. La casa y los pibes." />
        <meta property="og:title" content="CABURE.STORE — Marcas" />
      </Head>
      <h1 style={{marginTop:18}}>Marcas</h1>
      {!brands && <div className="status-loading skeleton" style={{height:80}} />}
      {brands && brands.length===0 && <div className="status-empty">Aún no hay marcas activas.</div>}
      <div className="grid" role="list">
        {brands?.map(b => (
          <Link key={b.id} href={`/marcas/${b.slug}`} className="card" role="listitem">
            <div className="card-body" style={{display:'flex', alignItems:'center', gap:12}}>
              <Image src={b.logo_url || '/cabure-logo.png'} alt={`Logo ${b.name}`} width={64} height={64} />
              <div>
                <div className="card-title">{b.name}</div>
                <div style={{color:'var(--muted)'}}>{b.description || 'Catálogo'}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}