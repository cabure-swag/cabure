// pages/checkout/[brandSlug].jsx
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { loadCart, clearCart, cartTotal } from "@/utils/cart";

export default function CheckoutBrand() {
  const router = useRouter();
  const { brandSlug } = router.query;

  const [session, setSession] = useState(null);
  const [brand, setBrand] = useState(null);
  const [items, setItems] = useState([]);
  const [shipping, setShipping] = useState({
    full_name: "",
    email: "",
    phone: "",
    postal_code: "",
    address: "",
    city: "",
    province: "",
  });
  const [paymentMethod, setPaymentMethod] = useState("transfer"); // "mp" o "transfer"
  const [submitting, setSubmitting] = useState(false);

  // auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription?.unsubscribe();
  }, []);

  // cargar brand + carrito de esa brand
  useEffect(() => {
    if (!brandSlug) return;
    (async () => {
      // Brand
      const { data: b } = await supabase
        .from("brands")
        .select("id, name, slug, bank_alias, bank_cbu, mp_access_token")
        .eq("slug", brandSlug)
        .is("deleted_at", null)
        .maybeSingle();
      setBrand(b || null);

      // Cart
      const c = loadCart(brandSlug);
      setItems(c.items);
    })();
  }, [brandSlug]);

  const total = useMemo(() => cartTotal(items), [items]);
  const hasMP = !!brand?.mp_access_token;

  async function createOrder() {
    if (!session?.user?.id) {
      alert("Necesitás iniciar sesión.");
      return;
    }
    if (!brand?.id) {
      alert("Marca no encontrada.");
      return;
    }
    if (!items.length) {
      alert("Tu carrito está vacío.");
      return;
    }
    // Validaciones envío (correo argentino)
    for (const [k, v] of Object.entries(shipping)) {
      if (!String(v || "").trim()) {
        alert("Completá todos los datos de envío.");
        return;
      }
    }

    setSubmitting(true);
    try {
      // 1) Crear order
      const { data: order, error: e1 } = await supabase
        .from("orders")
        .insert({
          brand_id: brand.id,
          buyer_id: session.user.id,
          total,
          status: "created",
          payment_method: hasMP && paymentMethod === "mp" ? "mp" : "transfer",
        })
        .select("id")
        .maybeSingle();
      if (e1) throw e1;
      if (!order?.id) throw new Error("No se pudo crear el pedido.");

      // 2) Insertar order_items
      const orderItemsPayload = items.map((it) => ({
        order_id: order.id,
        product_id: it.id,
        qty: it.qty,
        unit_price: it.price,
      }));
      const { error: e2 } = await supabase.from("order_items").insert(orderItemsPayload);
      if (e2) throw e2;

      // 3) Descontar stock (si existe columna stock_count)
      // Intentar update silencioso; si no existe, no falla la orden
      try {
        for (const it of items) {
          await supabase
            .from("products")
            .update({ stock_count: supabase.rpc ? undefined : undefined }) // placeholder para no romper
            .eq("id", it.id);
          // Mejor: si tienes stock_count, usá un RPC transaccional del lado de supabase
        }
      } catch {
        // ignorar si no hay stock_count
      }

      // 4) Si MP está configurado y eligió MP → crear preferencia (serverless)
      if (hasMP && paymentMethod === "mp") {
        const res = await fetch("/api/mp/create-preference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandSlug,
            orderId: order.id,
            items: items.map((i) => ({
              title: i.name,
              quantity: i.qty,
              unit_price: Number(i.price),
            })),
          }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.init_point) {
            clearCart(brandSlug);
            window.location.href = json.init_point; // redirige a MP
            return;
          }
        }
        alert("No se pudo iniciar el pago con Mercado Pago. Probá con Transferencia.");
      }

      // 5) Si es transferencia → mostrar alias/cbu y abrir chat con vendedor (vendor chat)
      clearCart(brandSlug);
      alert("Pedido creado. Te contactamos por chat para coordinar el pago/envío.");

      // OPCIONAL: redirigir al chat de vendedor de esa marca (si ya tenés /vendor-chat o flujo similar)
      // router.push(`/marcas/${brandSlug}?chat=1`);
      router.push(`/marcas/${brandSlug}`);

    } catch (err) {
      alert(err.message || "No se pudo crear el pedido. Revisá que estés logueado y probá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container">
      <Head><title>Finalizar compra — {brandSlug}</title></Head>
      <h1 style={{ marginBottom: 6 }}>Finalizar compra</h1>
      <p style={{ opacity:.8, marginTop:0 }}>
        Marca: <b>{brand?.name || brandSlug}</b>
      </p>

      <div className="grid">
        <section className="card" style={{ padding:12 }}>
          <h3 style={{ marginTop:0 }}>Datos de envío (Correo Argentino)</h3>
          <div className="form">
            <input className="inp" placeholder="Nombre completo"
              value={shipping.full_name} onChange={e=>setShipping({...shipping, full_name:e.target.value})} />
            <input className="inp" placeholder="Email"
              value={shipping.email} onChange={e=>setShipping({...shipping, email:e.target.value})} />
            <input className="inp" placeholder="Teléfono"
              value={shipping.phone} onChange={e=>setShipping({...shipping, phone:e.target.value})} />
            <input className="inp" placeholder="Código postal"
              value={shipping.postal_code} onChange={e=>setShipping({...shipping, postal_code:e.target.value})} />
            <input className="inp" placeholder="Dirección"
              value={shipping.address} onChange={e=>setShipping({...shipping, address:e.target.value})} />
            <input className="inp" placeholder="Ciudad"
              value={shipping.city} onChange={e=>setShipping({...shipping, city:e.target.value})} />
            <input className="inp" placeholder="Provincia"
              value={shipping.province} onChange={e=>setShipping({...shipping, province:e.target.value})} />
          </div>

          <h3>Método de pago</h3>
          <div className="row" style={{ gap:12, flexWrap:"wrap" }}>
            {hasMP && (
              <label className="radio">
                <input type="radio" name="pay" checked={paymentMethod==="mp"} onChange={()=>setPaymentMethod("mp")} />
                Mercado Pago (Tarjeta/QR)
              </label>
            )}
            <label className="radio">
              <input type="radio" name="pay" checked={paymentMethod==="transfer"} onChange={()=>setPaymentMethod("transfer")} />
              Transferencia
            </label>
          </div>

          {paymentMethod==="transfer" && (
            <div className="hint">
              <div>Alias: <b>{brand?.bank_alias || "—"}</b></div>
              <div>CBU: <b>{brand?.bank_cbu || "—"}</b></div>
              <small>Luego de confirmar, abriremos un chat para coordinar.</small>
            </div>
          )}

          <button className="btn primary" onClick={createOrder} disabled={submitting}>
            {submitting ? "Confirmando…" : "Confirmar pedido"}
          </button>
        </section>

        <section className="card" style={{ padding:12 }}>
          <h3 style={{ marginTop:0 }}>Resumen</h3>
          {items.length === 0 ? (
            <div className="empty">Tu carrito está vacío.</div>
          ) : (
            <ul className="list">
              {items.map(it => (
                <li key={it.id} className="row" style={{ justifyContent:"space-between" }}>
                  <span>{it.name} × {it.qty}</span>
                  <span>${(Number(it.price)*it.qty).toLocaleString("es-AR")}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="row" style={{ justifyContent:"space-between", marginTop:8, fontWeight:600 }}>
            <span>Total</span>
            <span>${total.toLocaleString("es-AR")}</span>
          </div>
        </section>
      </div>

      <style jsx>{`
        .container { padding:16px; }
        .grid { display:grid; grid-template-columns: 1.2fr .8fr; gap:12px; }
        @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
        .card { border:1px solid #1a1a1a; background:#0a0a0a; border-radius:14px; }
        .form { display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:12px; }
        @media (max-width: 700px) { .form { grid-template-columns: 1fr; } }
        .inp { padding:8px 10px; border-radius:10px; border:1px solid #2a2a2a; background:#0f0f0f; color:#fff; width:100%; }
        .row { display:flex; align-items:center; }
        .radio { display:flex; align-items:center; gap:8px; }
        .hint { padding:10px; border:1px dashed #2a2a2a; border-radius:10px; margin:8px 0 12px; }
        .btn { padding:10px 12px; border-radius:10px; border:1px solid #2a2a2a; background:#161616; color:#fff; cursor:pointer; }
        .btn.primary { background:#1a1f2f; border-color:#2a375a; }
        .empty { padding:14px; text-align:center; border:1px dashed #2a2a2a; border-radius:12px; }
        .list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
      `}</style>
    </div>
  );
}
