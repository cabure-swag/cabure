// pages/marcas/[slug].jsx
import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import CartSidebar from "@/components/CartSidebar"; // si no lo tenés aún, podés comentar esta línea y el uso

function money(v){ const n = Number(v||0); return isNaN(n) ? "$0" : n.toLocaleString("es-AR"); }

export default function BrandPage(){
  const router = useRouter();
  const { slug } = router.query || {};
  const [brand, setBrand] = useState(null);
  const [loadingBrand, setLoadingBrand] = useState(true);

  const [products, setProducts] = useState([]);
  const [loadingProds, setLoadingProds] = useState(true);

  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("Todas");
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancel = false;
    (async () => {
      setLoadingBrand(true);
      const { data: b } = await supabase
        .from("brands")
        .select("id,name,slug,description,logo_url,color,instagram_url,bank_alias,bank_cbu")
        .eq("slug", slug)
        .is("deleted_at", null)
        .eq("active", true)
        .maybeSingle();
      if (!cancel) { setBrand(b || null); setLoadingBrand(false); }
    })();
    return () => { cancel = true; };
  }, [slug]);

  useEffect(() => {
    if (!brand?.id) return;
    let cancel = false;
    (async () => {
      setLoadingProds(true);
      // Traemos productos públicos de la marca
      const { data: prods, error } = await supabase
        .from("products")
        .select("id,brand_id,name,price,stock,category,subcategory,active,image_url,created_at")
        .eq("brand_id", brand.id)
        .eq("active", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) { console.error(error); if (!cancel) { setProducts([]); setLoadingProds(false); } return; }

      let list = prods || [];

      // Intentamos traer imágenes múltiples
      let imgsByProduct = {};
      if (list.length) {
        const ids = list.map(p => p.id);
        const { data: imgs, error: eImg } = await supabase
          .from("product_images")
          .select("id,product_id,url,position")
          .in("product_id", ids)
          .order("position", { ascending: true });
        if (!eImg && imgs) {
          imgsByProduct = imgs.reduce((acc, it)=>{
            (acc[it.product_id] ||= []).push({ id: it.id, url: it.url, position: it.position });
            return acc;
          }, {});
        }
      }

      list = list.map(p => ({
        ...p,
        images: (imgsByProduct[p.id] && imgsByProduct[p.id].length)
          ? imgsByProduct[p.id]
          : (p.image_url ? [{ id: "legacy", url: p.image_url, position: 0 }] : [])
      }));

      if (!cancel) { setProducts(list); setLoadingProds(false); }
    })();
    return () => { cancel = true; };
  }, [brand?.id]);

  const categories = useMemo(() => {
    const set = new Set();
    products.forEach(p => { if (p.category) set.add(p.category.trim()); });
    return ["Todas", ...Array.from(set)];
  }, [products]);

  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    return products.filter(p => {
      if (activeCat !== "Todas" && (p.category || "") !== activeCat) return false;
      if (!q) return true;
      return (p.name || "").toLowerCase().includes(q) || (p.subcategory || "").toLowerCase().includes(q);
    });
  }, [products, activeCat, search]);

  function ProductCard({ p }){
    const cover = p.images?.[0]?.url || null;
    return (
      <div className="card" style={{ padding: 8 }}>
        <div style={{
          width:"100%", aspectRatio:"1 / 1", borderRadius:12, overflow:"hidden",
          border:"1px solid var(--border)", background:"#0d0f12", display:"grid", placeItems:"center"
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {cover ? <img src={cover} alt={p.name} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                 : <div style={{ color:"#89a", fontSize:12 }}>Sin imagen</div>}
        </div>
        <div style={{ marginTop:8, display:"grid", gap:4 }}>
          <div style={{ fontWeight:600 }}>{p.name}</div>
          <div style={{ color:"#9aa", fontSize:13 }}>{p.subcategory || p.category || "—"}</div>
          <div style={{ fontSize:14 }}>${money(p.price)}</div>
          <button className="btn btn-primary" onClick={()=>setCartOpen(true)} aria-label="Agregar al carrito">
            Agregar
          </button>
        </div>
      </div>
    );
  }

  if (loadingBrand) {
    return <div className="container"><div className="skeleton" style={{ height: 160, borderRadius: 12, marginTop: 16 }}/></div>;
  }
  if (!brand) {
    return <div className="container"><div className="status-empty">Marca no encontrada.</div></div>;
  }

  return (
    <div className="container">
      <Head>
        <title>{brand.name} — CABURE.STORE</title>
        <meta name="description" content={brand.description || brand.name} />
        <link rel="canonical" href={`https://cabure.store/marcas/${encodeURIComponent(brand.slug)}`} />
      </Head>

      {/* Header de marca */}
      <section className="row" style={{ gap:16, alignItems:"center", marginTop:12 }}>
        <div style={{
          width:120, aspectRatio:"1 / 1", borderRadius:16, overflow:"hidden",
          border:"1px solid var(--border)", background:"#0d0f12", display:"grid", placeItems:"center"
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {brand.logo_url
            ? <img src={brand.logo_url} alt={brand.name} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
            : <div style={{ color:"#89a", fontSize:12 }}>Sin logo</div>}
        </div>
        <div>
          <h1 style={{ margin:"0 0 6px 0" }}>{brand.name}</h1>
          <div style={{ color:"#9aa" }}>{brand.description || "—"}</div>
          {brand.instagram_url && (
            <div style={{ marginTop:8 }}>
              <Link href={brand.instagram_url} target="_blank" className="btn btn-ghost" aria-label="Instagram de la marca">
                Instagram
              </Link>
            </div>
          )}
        </div>
        <div style={{ flex:1 }} />
        {/* Carrito a la derecha del perfil */}
        <button className="btn" onClick={()=>setCartOpen(true)} aria-label="Abrir carrito">Carrito</button>
      </section>

      {/* Filtros + búsqueda SOBRE el catálogo */}
      <section className="row" style={{ gap:12, marginTop:16, flexWrap:"wrap" }}>
        <div className="row" style={{ gap:8, flexWrap:"wrap" }}>
          {categories.map(cat => (
            <button key={cat} className={`chip ${cat===activeCat ? "chip--active" : ""}`} onClick={()=>setActiveCat(cat)}>{cat}</button>
          ))}
        </div>
        <div style={{ flex:1 }} />
        <input className="input" placeholder="Buscar producto…" value={search} onChange={e=>setSearch(e.target.value)} style={{ maxWidth: 320 }}/>
      </section>

      {/* Grilla catálogo */}
      <section style={{ marginTop:12 }}>
        {loadingProds ? (
          <div className="row" style={{ gap:12 }}>
            <div className="skeleton" style={{ height: 260, borderRadius: 14, flex:1 }} />
            <div className="skeleton" style={{ height: 260, borderRadius: 14, flex:1 }} />
            <div className="skeleton" style={{ height: 260, borderRadius: 14, flex:1 }} />
            <div className="skeleton" style={{ height: 260, borderRadius: 14, flex:1 }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="status-empty">No hay productos para mostrar.</div>
        ) : (
          <div style={{ display:"grid", gap:12, gridTemplateColumns:"repeat(4, minmax(0, 1fr))" }}>
            {filtered.map(p => <ProductCard key={p.id} p={p} />)}
          </div>
        )}
      </section>

      {/* Sidebar de carrito (si usás CartSidebar) */}
      {cartOpen && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"grid", placeItems:"center", zIndex:50
        }}
          onClick={()=>setCartOpen(false)}
          aria-label="Cerrar carrito"
        >
          <div className="card" style={{ width: 420, maxWidth:"calc(100% - 24px)", padding:12 }} onClick={e=>e.stopPropagation()}>
            <div className="row" style={{ alignItems:"center" }}>
              <h3 style={{ margin:0 }}>Carrito</h3>
              <div style={{ flex:1 }} />
              <button className="btn btn-ghost" onClick={()=>setCartOpen(false)} aria-label="Cerrar">✕</button>
            </div>
            {/* Si ya tenés el componente real, renderizalo acá.
                <CartSidebar brandId={brand.id} />
            */}
            <div className="status-empty" style={{ marginTop:12 }}>Integrá tu carrito aquí.</div>
          </div>
        </div>
      )}
    </div>
  );
}
