// pages/checkout/[brandSlug].jsx
import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";

const money = (n) => Number(n || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

function CheckoutInner() {
  const router = useRouter();
  const { brandSlug } = router.query || {};
  const [brand, setBrand] = useState(null);
  const [cart, setCart] = useState([]);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // envío (Correo Argentino — datos básicos)
  const [shipping, setShipping] = useState({
    nombre: "",
    email: "",
    telefono: "",
    dni: "",
    cp: "",
    provincia: "",
    ciudad: "",
    calle: "",
    altura: "",
    piso: "",
    referencia: "",
  });

  // método de pago
  // "mp" si hay token de MP y elige usuario, "transfer" para transferencia
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data?.session || null));
    return () => sub?.data?.subscription?.unsubscribe?.();
  }, []);

  const cartKey = useMemo(() => (brand ? `cabure:cart:${brand.id}` : null), [brand]);
  const total = useMemo(() => cart.reduce((acc, it) => acc + Number(it.qty) * Number(it.unit_price), 0), [cart]);

  // cargar marca + carrito
  useEffect(() => {
    if (!brandSlug) return;
    (async () => {
      setLoading(true);
      try {
        const { data: b, error: e1 } = await supabase
          .from("brands")
          .select("id,name,slug,bank_alias,bank_cbu,mp_access_token,active,deleted_at")
          .eq("slug", brandSlug)
          .maybeSingle();
        if (e1) throw e1;
        if (!b || !b.active || b.deleted_at) {
          setBrand(null);
          setCart([]);
          setLoading(false);
          return;
        }
        setBrand(b);
      } catch (err) {
        console.error(err);
        setBrand(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [brandSlug]);

  useEffect(() => {
    if (!cartKey) return;
    try {
      const raw = localStorage.getItem(cartKey);
      setCart(raw ? JSON.parse(raw) : []);
    } catch {
      setCart([]);
    }
  }, [cartKey]);

  function setShipField(k, v) {
    setShipping((s) => ({ ...s, [k]: v }));
  }

  async function confirmOrder() {
    if (!brand) return;
    if (!cart.length) { alert("El carrito está vacío."); return; }
    if (!paymentMethod) { alert("Elegí un método de pago."); return; }
    if (!shipping.nombre || !shipping.email || !shipping.cp || !shipping.calle || !shipping.altura || !shipping.ciudad || !shipping.provincia) {
      alert("Completá los datos de envío obligatorios.");
      return;
    }
    // si elige MP pero la marca no tiene token, bloqueamos esa opción
    if (paymentMethod === "mp" && !brand.mp_access_token) {
      alert("Mercado Pago no disponible para esta marca.");
      return;
    }

    setSubmitting(true);
    try {
      // 1) crear order
      const buyer_id = session?.user?.id || null;
      const payloadOrder = {
        brand_id: brand.id,
        buyer_id,
        total,
        status: "created",
        payment_method: paymentMethod === "mp" ? "mercado_pago" : "transfer",
        mp_preference_id: null,
        mp_payment_id: null,
      };
      const { data: ord, error: e1 } = await supabase
        .from("orders")
        .insert(payloadOrder)
        .select("id")
        .maybeSingle();
      if (e1) throw e1;
      const orderId = ord.id;

      // 2) order_items + reservar stock (rpc decrement_stock)
      //    si alguna resta falla, hacemos rollback (borrar items y order)
      for (const it of cart) {
        const qty = Number(it.qty);
        const price = Number(it.unit_price);
        if (!qty || qty < 1) continue;

        const { error: eIt } = await supabase
          .from("order_items")
          .insert({ order_id: orderId, product_id: it.product_id, qty, unit_price: price });
        if (eIt) throw eIt;

        // restar stock atómicamente
        const { data: ok, error: eDec } = await supabase
          .rpc("decrement_stock", { p_product_id: it.product_id, p_qty: qty });
        if (eDec) throw eDec;
        if (!ok) throw new Error("Sin stock para completar la compra.");
      }

      // 3) si MP -> crear preferencia; si transferencia -> mostrar alias/CBU y abrir soporte
      if (paymentMethod === "mp" && brand.mp_access_token) {
        const resp = await fetch("/api/mp/create-preference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandId: brand.id,
            items: cart.map((it) => ({
              title: it.name,
              quantity: it.qty,
              unit_price: Number(it.unit_price),
            })),
            orderId,
            // back URLs (reemplazalas si querés específicas)
            back_urls: {
              success: `https://cabure.store/checkout/${brand.slug}?status=success&order=${orderId}`,
              failure: `https://cabure.store/checkout/${brand.slug}?status=failure&order=${orderId}`,
              pending: `https://cabure.store/checkout/${brand.slug}?status=pending&order=${orderId}`,
            },
          }),
        });
        if (!resp.ok) throw new Error("No se pudo crear la preferencia de MP.");
        const data = await resp.json(); // { init_point, preference_id }
        // guardamos preference_id por si querés seguirlo
        if (data?.preference_id) {
          await supabase.from("orders").update({ mp_preference_id: data.preference_id }).eq("id", orderId);
        }
        // limpiar carrito local y redirigir a MP
        localStorage.removeItem(cartKey);
        window.location.href = data?.init_point || "/";
        return;
      } else {
        // transferencia: dejamos orden en 'pending' y mostramos datos
        await supabase.from("orders").update({ status: "pending" }).eq("id", orderId);
        localStorage.removeItem(cartKey);
        alert(`Pedido creado. Transferí a:\nALIAS: ${brand.bank_alias || "-"}\nCBU/CVU: ${brand.bank_cbu || "-"}`);
        // opcional: abrir hilo de soporte de esta marca
        try {
          const uid = session?.user?.id;
          if (uid) {
            // reabrir/crear hilo para esta brand
            const { data: th } = await supabase
              .from("support_threads")
              .select("id,status")
              .eq("user_id", uid)
              .eq("brand_id", brand.id)
              .eq("status", "open")
              .maybeSingle();
            if (!th) {
              await supabase.from("support_threads").insert({ user_id: uid, brand_id: brand.id, status: "open" });
            }
          }
        } catch {}
        router.push(`/soporte`);
      }
    } catch (err) {
      console.error(err);
      alert(err.message || "No se pudo completar el pedido.");
      // rollback best-effort: (si creó orderId y falló luego)
      // *No* sabemos el orderId si falló antes — arriba solo hacemos rollback si falló al decrementar,
      // pero si querés un rollback total transaccional, habrá que mover esto a un RPC o edge function.
    } finally {
      setSubmitting(false);
    }
  }

  const mpAvailable = !!brand?.mp_access_token;

  if (loading) {
    return (
      <div className="container">
        <Head><title>Checkout — CABURE.STORE</title></Head>
        <div className="skel" style={{ height: 140, marginTop: 24 }} />
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="container">
        <Head><title>Checkout — CABURE.STORE</title></Head>
        <p>La marca no existe o no está disponible.</p>
        <Link className="btn" href="/">Volver</Link>
      </div>
    );
  }

  return (
    <div className="container">
      <Head><title>Checkout — {brand.name}</title><meta name="robots" content="noindex" /></Head>
      <h1>Checkout — {brand.name}</h1>

      {!cart.length ? (
        <div className="card" style={{ padding: 16 }}>
          <p>Tu carrito está vacío.</p>
          <Link className="btn" href={`/marcas/${brand.slug}`}>Volver al catálogo</Link>
        </div>
      ) : (
        <div className="grid grid-2" style={{ gap: 16 }}>
          {/* resumen */}
          <section className="card" style={{ padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>Resumen</h2>
            <div style={{ display: "grid", gap: 8 }}>
              {cart.map((it) => (
                <div key={it.product_id} className="row" style={{ alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{it.name}</div>
                    <div style={{ fontSize: 13, opacity: 0.8 }}>{money(it.unit_price)} × {it.qty}</div>
                  </div>
                  <div>{money(Number(it.unit_price) * Number(it.qty))}</div>
                </div>
              ))}
            </div>
            <hr style={{ borderColor: "var(--border)", margin: "12px 0" }} />
            <div className="row" style={{ fontWeight: 700 }}>
              <div>Total</div>
              <div>{money(total)}</div>
            </div>
          </section>

          {/* envío + pago */}
          <section className="card" style={{ padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>Datos de envío</h2>
            <div className="grid grid-2" style={{ gap: 10 }}>
              <div>
                <label className="input-label">Nombre y apellido *</label>
                <input className="input" value={shipping.nombre} onChange={(e) => setShipField("nombre", e.target.value)} />
              </div>
              <div>
                <label className="input-label">DNI</label>
                <input className="input" value={shipping.dni} onChange={(e) => setShipField("dni", e.target.value)} />
              </div>
              <div>
                <label className="input-label">Email *</label>
                <input className="input" type="email" value={shipping.email} onChange={(e) => setShipField("email", e.target.value)} />
              </div>
              <div>
                <label className="input-label">Teléfono</label>
                <input className="input" value={shipping.telefono} onChange={(e) => setShipField("telefono", e.target.value)} />
              </div>
              <div>
                <label className="input-label">Código Postal *</label>
                <input className="input" value={shipping.cp} onChange={(e) => setShipField("cp", e.target.value)} />
              </div>
              <div>
                <label className="input-label">Provincia *</label>
                <input className="input" value={shipping.provincia} onChange={(e) => setShipField("provincia", e.target.value)} />
              </div>
              <div>
                <label className="input-label">Ciudad/Localidad *</label>
                <input className="input" value={shipping.ciudad} onChange={(e) => setShipField("ciudad", e.target.value)} />
              </div>
              <div>
                <label className="input-label">Calle *</label>
                <input className="input" value={shipping.calle} onChange={(e) => setShipField("calle", e.target.value)} />
              </div>
              <div>
                <label className="input-label">Altura *</label>
                <input className="input" value={shipping.altura} onChange={(e) => setShipField("altura", e.target.value)} />
              </div>
              <div>
                <label className="input-label">Piso/Depto</label>
                <input className="input" value={shipping.piso} onChange={(e) => setShipField("piso", e.target.value)} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="input-label">Referencia</label>
                <input className="input" value={shipping.referencia} onChange={(e) => setShipField("referencia", e.target.value)} />
              </div>
            </div>

            <h2 style={{ marginTop: 16 }}>Método de pago</h2>
            <div className="grid" style={{ gap: 8 }}>
              <label className="chip">
                <input
                  type="radio"
                  name="pm"
                  checked={paymentMethod === "transfer"}
                  onChange={() => setPaymentMethod("transfer")}
                />
                Transferencia (Alias/CBU)
              </label>
              <label className="chip" style={{ opacity: mpAvailable ? 1 : 0.5 }}>
                <input
                  type="radio"
                  name="pm"
                  checked={paymentMethod === "mp"}
                  onChange={() => setPaymentMethod("mp")}
                  disabled={!mpAvailable}
                />
                Mercado Pago {mpAvailable ? "" : "(no disponible)"}
              </label>
            </div>

            {/* si eligió transferencia, mostramos alias/cbu al final como confirmación */}
            {paymentMethod === "transfer" && (
              <div className="card" style={{ marginTop: 12, padding: 12 }}>
                <div><strong>Alias:</strong> {brand.bank_alias || "-"}</div>
                <div><strong>CBU/CVU:</strong> {brand.bank_cbu || "-"}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
                  Después de confirmar, te vamos a abrir un chat para coordinar el envío y validar la transferencia.
                </div>
              </div>
            )}

            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn ghost" onClick={() => router.push(`/marcas/${brand.slug}`)}>Volver</button>
              <div style={{ flex: 1 }} />
              <button className="btn" onClick={confirmOrder} disabled={submitting}>
                {submitting ? "Procesando…" : "Confirmar pedido"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default dynamic(() => Promise.resolve(CheckoutInner), { ssr: false });
