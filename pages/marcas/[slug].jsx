// pages/marcas/[slug].jsx
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

// ------- helpers -------
function currency(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}
function toPublicUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  let clean = String(path).replace(/^public\//, "");
  if (!clean.includes("/")) clean = `product-images/${clean}`;
  return `${SUPABASE_URL}/storage/v1/object/public/${clean}`;
}
function collectProductImages(p) {
  const out = [];
  if (p?.images) {
    if (Array.isArray(p.images)) out.push(...p.images.filter(Boolean));
    else if (typeof p.images === "string") p.images.split(/[,\s]+/).forEach(x => x && out.push(x.trim()));
  }
  ["image_url","image_url2","image_url3","image_url4","image_url5"].forEach(k => { if (p?.[k]) out.push(p[k]); });
  return Array.from(new Set(out.filter(Boolean))).map(toPublicUrl);
}
function normalizeBrand(b) {
  if (!b) return null;
  const logoSrc = b.logo_url || b.logo || b.avatar_url || null;
  const instagram = b.instagram_url || b.instagram || null;
  return {
    id: b.id, name: b.name || "Marca", description: b.description || "", slug: b.slug,
    logo: logoSrc ? toPublicUrl(logoSrc) : null, instagram,
    color: b.color || null, bank_alias: b.bank_alias || null, bank_cbu: b.bank_cbu || null,
    mp_access_token: b.mp_access_token || null,
  };
}

// ------- carrito por marca (localStorage) -------
function useBrandCart(brandId) {
  const storageKey = brandId ? `cabure_cart_${brandId}` : null;
  const [items, setItems] = useState(() => {
    if (!storageKey) return [];
    try { return JSON.parse(localStorage.getItem(storageKey) || "[]"); } catch { return []; }
  });
  useEffect(() => { if (storageKey) try { localStorage.setItem(storageKey, JSON.stringify(items)); } catch {} }, [storageKey, items]);

  const add = useCallback((p, qty = 1) => {
    const max = Math.max(0, Number(p.stock ?? 1)) || 1;
    const images = collectProductImages(p);
    const thumb = images[0] || null;
    setItems(prev => {
      const idx = prev.findIndex(it => it.productId === p.id);
      const next = [...prev];
      if (idx >= 0) next[idx] = { ...next[idx], qty: Math.min(Number(next[idx].qty || 0) + qty, max) };
      else next.push({ productId: p.id, name: p.name, price: Number(p.price || 0), qty: Math.min(qty, max), image: thumb });
      return next;
    });
  }, []);
  const remove = useCallback((productId) => setItems(prev => prev.filter(it => it.productId !== productId)), []);
  const setQty = useCallback((productId, qty) => {
    const q = Math.max(1, Number(qty || 1));
    setItems(prev => prev.map(it => (it.productId === productId ? { ...it, qty: q } : it)));
  }, []);
  const clear = useCallback(() => setItems([]), []);
  const total = useMemo(() => items.reduce((acc, it) => acc + Number(it.price || 0) * Number(it.qty || 0), 0), [items]);
  return { items, add, remove, setQty, clear, total };
}

// ------- modal de checkout (sin botones de login/logout) -------
function CheckoutModal({ open, onClose, brand, cart, onCreated, ensureLogged }) {
  const [fullName, setFullName] = useState("");
  const [dni, setDni] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postal, setPostal] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [payMethod, setPayMethod] = useState(""); // "mp" | "transfer"
  const [saving, setSaving] = useState(false);

  const mpAvailable = !!brand?.mp_access_token;

  useEffect(() => {
    if (!open) {
      setFullName(""); setDni(""); setEmail(""); setPhone("");
      setAddress(""); setPostal(""); setCity(""); setProvince("");
      setPayMethod(""); setSaving(false);
    }
  }, [open]);

  if (!open) return null;

  const canConfirm =
    fullName.trim() && dni.trim() && email.trim() && phone.trim() &&
    address.trim() && postal.trim() && city.trim() && province.trim() &&
    payMethod && cart.items.length > 0;

  async function confirm() {
    if (!canConfirm || !brand?.id) return;
    const ok = await ensureLogged();
    if (!ok) return;

    try {
      setSaving(true);
      const { data: sdata } = await supabase.auth.getSession();
      const buyer_id = sdata?.session?.user?.id;
      if (!buyer_id) throw new Error("no-session");

      // 1) Crear orden
      const { data: order, error: eo } = await supabase
        .from("orders")
        .insert({
          brand_id: brand.id,
          buyer_id,
          total: cart.total,
          status: "created",
          payment_method: payMethod === "mp" ? "mercadopago" : "transfer",
        })
        .select("id,brand_id")
        .maybeSingle();
      if (eo) throw eo;

      // 2) Items
      const rows = cart.items.map(it => ({
        order_id: order.id, product_id: it.productId, qty: it.qty, unit_price: it.price
      }));
      const { error: ei } = await supabase.from("order_items").insert(rows);
      if (ei) throw ei;

      // 3) **Descontar stock** por cada item (y desactivar si llega a 0)
      for (const it of cart.items) {
        const { data: prod } = await supabase.from("products").select("stock").eq("id", it.productId).maybeSingle();
        const current = Number(prod?.stock || 0);
        const newStock = Math.max(current - Number(it.qty || 0), 0);
        await supabase.from("products")
          .update({ stock: newStock, active: newStock > 0 })
          .eq("id", it.productId);
      }

      // 4) Abrir **thread de la marca** (lo ven Vendedores asignados a esa brand + Admin + comprador)
      const { data: thread, error: et } = await supabase
        .from("support_threads")
        .insert({ user_id: buyer_id, brand_id: order.brand_id, status: "open" })
        .select("id,brand_id")
        .maybeSingle();
      if (et) throw et;

      // 5) Mensaje inicial
      const summary = [
        `Nuevo pedido #${order.id}`,
        `Total: ${currency(cart.total)} | Pago: ${payMethod === "mp" ? "Mercado Pago" : "Transferencia"}`,
        `Envío (Correo Arg.)`,
        `- Nombre: ${fullName} | DNI: ${dni}`,
        `- Email: ${email} | Tel: ${phone}`,
        `- Dirección: ${address} | CP: ${postal} | ${city}, ${province}`,
        `Items:`,
        ...cart.items.map(it => `  - ${it.name} x${it.qty} — ${currency(it.price)}`)
      ].join("\n");

      await supabase.from("support_messages").insert({
        thread_id: thread.id, sender_role: "user", message: summary
      });

      onCreated?.(order.id, thread.id); // devolvemos el thread para ir al chat
    } catch (e) {
      console.error("checkout error:", e);
      alert("No se pudo crear el pedido. Revisá que estés logueado y probá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true"
      className="card"
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", padding:16, zIndex:40 }}
      onClick={onClose}
    >
      <div className="card" style={{ width:"100%", maxWidth:620, padding:16 }} onClick={(e)=>e.stopPropagation()}>
        <h2 style={{ marginTop:0 }}>Datos de envío y pago</h2>

        <div className="row" style={{ gap:8 }}>
          <input className="input" placeholder="Nombre y Apellido" value={fullName} onChange={e=>setFullName(e.target.value)}/>
          <input className="input" placeholder="DNI" value={dni} onChange={e=>setDni(e.target.value)}/>
        </div>
        <div className="row" style={{ gap:8, marginTop:8 }}>
          <input className="input" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/>
          <input className="input" placeholder="Teléfono" value={phone} onChange={e=>setPhone(e.target.value)}/>
        </div>
        <div className="row" style={{ gap:8, marginTop:8 }}>
          <input className="input" placeholder="Dirección" value={address} onChange={e=>setAddress(e.target.value)}/>
        </div>
        <div className="row" style={{ gap:8, marginTop:8 }}>
          <input className="input" placeholder="Código Postal" value={postal} onChange={e=>setPostal(e.target.value)}/>
          <input className="input" placeholder="Ciudad" value={city} onChange={e=>setCity(e.target.value)}/>
          <input className="input" placeholder="Provincia" value={province} onChange={e=>setProvince(e.target.value)}/>
        </div>

        <div style={{ marginTop:12 }}>
          <div style={{ marginBottom:6, color:"#9aa" }}>Método de pago</div>
          <div className="row" style={{ gap:8, flexWrap:"wrap" }}>
            {mpAvailable && (
              <label className="chip" style={{ cursor:"pointer" }}>
                <input type="radio" name="pay" checked={payMethod==="mp"} onChange={()=>setPayMethod("mp")} style={{ marginRight:8 }}/>
                Mercado Pago
              </label>
            )}
            <label className="chip" style={{ cursor:"pointer" }}>
              <input type="radio" name="pay" checked={payMethod==="transfer"} onChange={()=>setPayMethod("transfer")} style={{ marginRight:8 }}/>
              Transferencia (Alias/CBU)
            </label>
          </div>
        </div>

        <div className="row" style={{ marginTop:16, alignItems:"center" }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <div style={{ flex:1 }} />
          <strong style={{ marginRight:12 }}>{currency(cart.total)}</strong>
          <button className="btn btn-primary" onClick={confirm} disabled={!canConfirm || saving}>
            {saving ? "Creando pedido..." : "Confirmar pedido"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------- producto -------
function ProductCard({ product, onAdd }) {
  const imgs = collectProductImages(product);
  const [idx, setIdx] = useState(0);
  const prev = () => setIdx(i => (imgs.length ? (i - 1 + imgs.length) % imgs.length : 0));
  const next = () => setIdx(i => (imgs.length ? (i + 1) % imgs.length : 0));
  const disabled = !(Number(product?.stock || 0) > 0) || !product?.active;

  return (
    <article className="card" style={{ padding:12 }}>
      <div style={{ width:"100%", aspectRatio:"1/1", borderRadius:12, overflow:"hidden", position:"relative", background:"var(--panel)", border:"1px dashed var(--border)" }}>
        {imgs.length ? (
          <img src={imgs[idx]} alt={product?.name || "producto"} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
        ) : (
          <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", color:"#888", fontSize:12 }}>
            Sin imagen
          </div>
        )}
        {imgs.length>1 && (
          <>
            <button onClick={prev} className="btn btn-ghost" style={{ position:"absolute", left:8, top:"calc(50% - 18px)" }} aria-label="Anterior">◀</button>
            <button onClick={next} className="btn btn-ghost" style={{ position:"absolute", right:8, top:"calc(50% - 18px)" }} aria-label="Siguiente">▶</button>
          </>
        )}
      </div>

      <h3 style={{ margin:"8px 0 0 0", fontSize:"1rem" }}>{product?.name || "Producto"}</h3>
      <div style={{ color:"#9aa", fontSize:12, marginTop:2 }}>{(product?.category || "").trim() || "—"}</div>

      <div className="row" style={{ alignItems:"center", marginTop:8 }}>
        <strong>{currency(product?.price)}</strong>
        <div style={{ flex:1 }} />
        <button className="btn btn-primary" onClick={onAdd} disabled={disabled}>Agregar</button>
      </div>
    </article>
  );
}

// ------- página -------
export default function BrandPage() {
  const router = useRouter();
  const { slug } = router.query;

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState(null);
  const [productsRaw, setProductsRaw] = useState([]);

  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("Todas");
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: b } = await supabase.from("brands").select("*").eq("slug", slug).maybeSingle();
        !cancelled && setBrand(normalizeBrand(b));
        if (b?.id) {
          const { data: ps } = await supabase.from("products").select("*").eq("brand_id", b.id).order("created_at", { ascending: false });
          !cancelled && setProductsRaw(Array.isArray(ps) ? ps : []);
        } else {
          !cancelled && setProductsRaw([]);
        }
      } catch (err) {
        console.error("[/marcas/[slug]]", err);
        !cancelled && (setBrand(null), setProductsRaw([]));
      } finally {
        !cancelled && setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const cart = useBrandCart(brand?.id);

  const products = useMemo(() => {
    let data = (Array.isArray(productsRaw) ? productsRaw : []).filter(p => !!p?.active && Number(p?.stock || 0) > 0);
    if (activeCat && activeCat !== "Todas") data = data.filter(p => (p?.category || "").trim() === activeCat);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter(p => p?.name?.toLowerCase().includes(q));
    }
    return data;
  }, [productsRaw, activeCat, search]);

  // asegurar login (sin mostrar botones en el carrito)
  const ensureLogged = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) return true;
    await supabase.auth.signInWithOAuth({ provider: "google" });
    const t0 = Date.now();
    while (Date.now() - t0 < 8000) {
      const { data: d2 } = await supabase.auth.getSession();
      if (d2?.session?.user) return true;
      await new Promise(r => setTimeout(r, 400));
    }
    return false;
  }, []);

  const categories = useMemo(() => {
    const s = new Set();
    (Array.isArray(productsRaw) ? productsRaw : []).forEach(p => { const c = (p?.category || "").trim(); if (c) s.add(c); });
    return ["Todas", ...Array.from(s)];
  }, [productsRaw]);

  return (
    <>
      <Head>
        <title>{brand?.name ? `${brand.name} — CABURE.STORE` : "CABURE.STORE"}</title>
      </Head>

      <div className="container" style={{ paddingBottom: 56 }}>
        {/* Header perfil marca + carrito */}
        <section className="card" style={{ display:"grid", gridTemplateColumns:"160px 1fr 360px", gap:16, alignItems:"center", padding:16 }}>
          <div style={{ width:160, height:160, borderRadius:16, overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--panel)", border:"1px dashed var(--border)" }}>
            {brand?.logo ? <img src={brand.logo} alt={brand?.name || "logo"} style={{ width:"100%", height:"100%", objectFit:"contain" }}/> : <div style={{ color:"#999", fontSize:12 }}>Sin logo</div>}
          </div>
          <div>
            <h1 style={{ margin:0 }}>{brand?.name || "Marca"}</h1>
            {brand?.description && <p style={{ margin:"6px 0 12px", color:"#bbb" }}>{brand.description}</p>}
            <div className="row" style={{ gap:8 }}>
              {brand?.instagram && (
                <a href={brand.instagram} target="_blank" rel="noreferrer" className="btn btn-ghost" aria-label="Instagram">
                  <span style={{ marginRight:6 }}>📸</span> Instagram
                </a>
              )}
            </div>
          </div>
          <aside className="card" style={{ padding:12 }}>
            <div className="row" style={{ alignItems:"center" }}>
              <h3 style={{ margin:0, fontSize:"1rem" }}>Carrito</h3>
              <div style={{ flex:1 }} />
              <strong>{currency(cart.total)}</strong>
            </div>
            {cart.items.length === 0 ? (
              <div style={{ marginTop:8, padding:12, borderRadius:10, background:"var(--panel)", border:"1px dashed var(--border)", color:"#9aa", fontSize:14 }}>
                Tu carrito está vacío.
              </div>
            ) : (
              <div style={{ marginTop:8, display:"grid", gap:8 }}>
                {cart.items.map(it => (
                  <div key={it.productId} className="row" style={{ gap:8, alignItems:"center", borderBottom:"1px solid var(--border)", paddingBottom:8 }}>
                    <div style={{ width:44, height:44, borderRadius:8, overflow:"hidden", background:"var(--panel)", border:"1px solid var(--border)" }}>
                      {it.image && <img src={it.image} alt={it.name} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:13, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{it.name}</div>
                      <div style={{ fontSize:12, color:"#9aa" }}>{currency(it.price)}</div>
                    </div>
                    <div style={{ flex:1 }} />
                    <input type="number" min={1} value={it.qty} onChange={e=>cart.setQty(it.productId, e.target.value)} className="input" style={{ width:64, padding:"6px 8px" }} aria-label="Cantidad"/>
                    <button className="btn btn-ghost" onClick={()=>cart.remove(it.productId)}>Quitar</button>
                  </div>
                ))}
              </div>
            )}
            <div className="row" style={{ gap:8, marginTop:10, alignItems:"center" }}>
              <button className="btn btn-ghost" onClick={cart.clear} disabled={cart.items.length===0}>Vaciar</button>
              <div style={{ flex:1 }} />
              <button className="btn btn-primary" onClick={()=>setCheckoutOpen(true)} disabled={cart.items.length===0}>Finalizar compra</button>
            </div>
          </aside>
        </section>

        {/* Filtros + búsqueda */}
        <section className="row" style={{ gap:12, marginTop:16 }}>
          <div className="row" style={{ gap:8, flexWrap:"wrap" }}>
            {categories.map(cat => (
              <button key={cat} className={`chip ${cat===activeCat ? "chip--active":""}`} onClick={()=>setActiveCat(cat)}>{cat}</button>
            ))}
          </div>
          <div style={{ flex:1 }} />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar producto…" className="input" style={{ maxWidth:320 }} aria-label="Buscar producto"/>
        </section>

        {/* Catálogo */}
        <section style={{ marginTop:16, display:"grid", gridTemplateColumns:"repeat(4, minmax(0, 1fr))", gap:16 }}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="card skeleton" style={{ height:380 }} />)
          ) : products.length === 0 ? (
            <div className="card" style={{ gridColumn:"1 / -1", padding:24, textAlign:"center", border:"1px dashed var(--border)" }}>
              No hay productos para mostrar.
            </div>
          ) : (
            products.map(p => <ProductCard key={p.id} product={p} onAdd={()=>cart.add(p,1)} />)
          )}
        </section>
      </div>

      {/* Modal checkout: al crear redirige a chat del pedido */}
      <CheckoutModal
        open={checkoutOpen}
        onClose={()=>setCheckoutOpen(false)}
        brand={brand}
        cart={cart}
        ensureLogged={ensureLogged}
        onCreated={(_orderId, threadId) => {
          cart.clear();
          setCheckoutOpen(false);
          // **chat con vendedores de esa MARCA** (mismo thread; los vendors lo ven por las policies de abajo)
          router.push(`/soporte?thread=${threadId}`);
        }}
      />

      <style jsx>{`
        .chip { background: var(--panel); color: var(--text); border: 1px solid var(--border); padding: 6px 12px; border-radius: 999px; font-size: 0.9rem; }
        .chip--active { background: var(--brand); color: #000; border-color: var(--brand); }
        .input { width: 100%; background: var(--panel); border: 1px solid var(--border); color: var(--text); padding: 10px 12px; border-radius: 10px; outline: none; }
        .skeleton { opacity: 0.5; }
      `}</style>
    </>
  );
}
