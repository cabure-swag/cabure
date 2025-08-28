// pages/checkout/[brandSlug].jsx
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { readCart, clearCart, totalCart } from "@/utils/cart";

export default function CheckoutBrand() {
  const router = useRouter();
  const { brandSlug } = router.query;

  const [session, setSession] = useState(null);
  const [brand, setBrand] = useState(null);
  const [cart, setCart] = useState({ items: [] });
  const [shipping, setShipping] = useState({ nombre: "", dni: "", cp: "", direccion: "", ciudad: "", provincia: "" });
  const [payMethod, setPayMethod] = useState("transferencia");
  const [submitting, setSubmitting] = useState(false);

  // Cargar sesión
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => l.subscription.unsubscribe();
  }, []);

  // Cargar brand + escuchar carrito
  useEffect(() => {
    if (!brandSlug) return;
    (async () => {
      const { data: b } = await supabase
        .from("brands")
        .select("id, name, slug, bank_alias, bank_cbu, mp_access_token")
        .eq("slug", brandSlug)
        .maybeSingle();
      setBrand(b || null);
    })();

    // cargar y escuchar cambios en el carrito
    const load = () => setCart(readCart(brandSlug));
    load();
    const onStorage = (e) => {
      if (e.key === `cabure:cart:${brandSlug}`) load();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [brandSlug]);

  const total = useMemo(() => totalCart(cart), [cart]);

  async function confirmOrder(e) {
    e.preventDefault();
    if (!session?.user?.id) {
      alert("Tenés que iniciar sesión para confirmar el pedido.");
      return;
    }
    if (!brand?.id) {
      alert("Marca inválida.");
      return;
    }
    if (!cart.items.length) {
      alert("Tu carrito está vacío.");
      return;
    }

    try {
      setSubmitting(true);

      // Revalidar productos actuales (precio y stock fresh)
      const ids = cart.items.map((it) => it.id);
      const { data: products } = await supabase
        .from("products")
        .select("id, price, stock_qty, brand_id, active, deleted_at")
        .in("id", ids);

      // Rebuild items para RPC (limita por stock actual)
      const itemsForRpc = cart.items.map((it) => {
        const match = products?.find((p) => p.id === it.id);
        const unit = Number(match?.price ?? it.price ?? 0);
        let qty = Number(it.qty || 0);
        if (Number.isFinite(match?.stock_qty)) {
          qty = Math.min(qty, Math.max(0, match.stock_qty));
        }
        return { product_id: it.id, qty, unit_price: unit };
      }).filter(x => x.qty > 0);

      if (!itemsForRpc.length) {
        alert("Tu carrito quedó sin stock. Actualizá y probá de nuevo.");
        setSubmitting(false);
        return;
      }

      // Llamar RPC transaccional
      const { data: orderId, error } = await supabase.rpc("create_order_with_stock", {
        p_brand_id: brand.id,
        p_buyer_id: session.user.id,
        p_payment_method: payMethod,
        p_items: itemsForRpc
      });

      if (error) throw error;

      // (Opcional) guardar envío como metadata en orders si tenés columnas
      // await supabase.from('orders').update({ shipping_json: shipping }).eq('id', orderId);

      clearCart(brandSlug);
      alert("Pedido creado. Nos vamos al chat con el vendedor para coordinar.");
      router.push(`/vendor-chat/${brand.slug}?order=${orderId}`); // ajustá si tu ruta de chat es otra
    } catch (err) {
      console.error(err);
      alert(err.message || "No se pudo crear el pedido. Revisá que estés logueado y probá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container">
      <Head><title>Checkout — CABURE.STORE</title></Head>

      <h1>Finalizar compra</h1>

      {!cart.items.length ? (
        <p>Tu carrito está vacío.</p>
      ) : (
        <form onSubmit={confirmOrder} className="grid">
          <section className="card">
            <h2>Datos de envío (Correo Argentino)</h2>
            <div className="grid2">
              <label>Nombre y Apellido
                <input required value={shipping.nombre} onChange={e=>setShipping({...shipping, nombre:e.target.value})} />
              </label>
              <label>DNI
                <input required value={shipping.dni} onChange={e=>setShipping({...shipping, dni:e.target.value})} />
              </label>
              <label>Código Postal
                <input required value={shipping.cp} onChange={e=>setShipping({...shipping, cp:e.target.value})} />
              </label>
              <label>Dirección
                <input required value={shipping.direccion} onChange={e=>setShipping({...shipping, direccion:e.target.value})} />
              </label>
              <label>Ciudad
                <input required value={shipping.ciudad} onChange={e=>setShipping({...shipping, ciudad:e.target.value})} />
              </label>
              <label>Provincia
                <input required value={shipping.provincia} onChange={e=>setShipping({...shipping, provincia:e.target.value})} />
              </label>
            </div>
          </section>

          <aside className="card">
            <h2>Resumen</h2>
            <ul className="list">
              {cart.items.map(it => (
                <li key={it.id} className="row">
                  <span>{it.name} × {it.qty}</span>
                  <span>${(Number(it.price)*Number(it.qty)).toLocaleString("es-AR")}</span>
                </li>
              ))}
              <li className="row" style={{ borderTop:"1px solid #222", paddingTop:8, marginTop:8, fontWeight:700 }}>
                <span>Total</span>
                <span>${total.toLocaleString("es-AR")}</span>
              </li>
            </ul>

            <div style={{ marginTop:12 }}>
              <h3>Método de pago</h3>
              <select value={payMethod} onChange={e=>setPayMethod(e.target.value)} className="inp">
                {brand?.mp_access_token && <option value="mercado_pago">Mercado Pago</option>}
                <option value="transferencia">Transferencia</option>
                <option value="otro">Otro</option>
              </select>
              {payMethod === "transferencia" && (
                <p style={{ opacity:.85, marginTop:8 }}>
                  Alias: <b>{brand?.bank_alias || "a definir"}</b><br/>
                  CBU: <b>{brand?.bank_cbu || "a definir"}</b>
                </p>
              )}
            </div>

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Confirmando..." : "Confirmar pedido"}
            </button>
          </aside>
        </form>
      )}

      <style jsx>{`
        .container { padding:16px; }
        .grid { display:grid; grid-template-columns: 1fr 380px; gap:16px; }
        @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
        .card { border:1px solid #1d1d1d; border-radius:14px; padding:14px; background:#0c0c0c; }
        h1, h2 { margin:6px 0 12px; }
        label { display:flex; flex-direction:column; gap:6px; }
        .grid2 { display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
        @media (max-width: 680px) { .grid2 { grid-template-columns: 1fr; } }
        .inp, input, select { padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#0f0f0f; color:#fff; width:100%; }
        .row { display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .list { list-style:none; padding:0; margin:0 0 12px; display:flex; flex-direction:column; gap:6px; }
        .btn { padding:10px 12px; border-radius:10px; border:1px solid #2a2a2a; background:#151515; color:#fff; cursor:pointer; width:100%; }
        .btn[disabled] { opacity:.6; cursor:not-allowed; }
        .btn-primary { background:#2b5cff; border-color:#2b5cff; font-weight:700; }
        .btn-primary:hover { filter:brightness(1.12); }
      `}</style>
    </div>
  );
}
