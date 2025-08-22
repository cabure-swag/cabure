// pages/checkout/[brandSlug].jsx
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";

const PAYMENT_OPTIONS = [
  { key: "mp", label: "Mercado Pago (tarjeta/QR)" },
  { key: "transfer", label: "Transferencia bancaria" },
];

function useBrandCart(slug) {
  const key = slug ? `cabure_cart_${slug}` : null;
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      setItems(raw ? JSON.parse(raw) : []);
    } catch {
      setItems([]);
    }
  }, [key]);

  useEffect(() => {
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(items));
  }, [key, items]);

  const totals = useMemo(() => {
    const qty = items.reduce((s, it) => s + it.qty, 0);
    const amount = items.reduce((s, it) => s + (Number(it.price) || 0) * it.qty, 0);
    return { qty, amount };
  }, [items]);

  function setQty(id, qty) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, qty: Math.max(1, qty) } : i)));
  }
  function removeItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }
  function clear() {
    setItems([]);
  }

  return { items, totals, setQty, removeItem, clear };
}

export default function CheckoutBrand() {
  const router = useRouter();
  const { brandSlug } = router.query;
  const cart = useBrandCart(brandSlug);

  const [brand, setBrand] = useState(null);
  const [step, setStep] = useState(1);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uiError, setUiError] = useState("");

  const [ship, setShip] = useState({
    nombre: "", dni: "", email: "", telefono: "",
    cp: "", provincia: "", ciudad: "",
    calle: "", altura: "", piso: "", depto: "",
    entre_calles: "", observaciones: "",
  });

  useEffect(() => {
    if (!brandSlug) return;
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id,slug,name,mp_access_token,bank_alias,bank_cbu,active,deleted_at")
        .eq("slug", brandSlug)
        .maybeSingle();
      if (!alive) return;

      if (error || !data || !data.active || data.deleted_at) {
        setBrand(false);
      } else {
        setBrand(data);
      }
    })();
    return () => { alive = false; };
  }, [brandSlug]);

  const canUseMP = !!brand?.mp_access_token;

  function updateShip(field, val) { setShip((s) => ({ ...s, [field]: val })); }
  function validateShip() {
    const req = ["nombre","dni","email","telefono","cp","provincia","ciudad","calle","altura"];
    for (const k of req) { if (!String(ship[k] || "").trim()) return false; }
    return true;
  }

  async function createOrder(status, payment_method, mp_preference_id = null, mp_payment_id = null) {
    const total = cart?.totals?.amount || 0;
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        brand_id: brand.id,
        buyer_id: (await supabase.auth.getUser()).data?.user?.id ?? null,
        total,
        status,
        payment_method,
        mp_preference_id,
        mp_payment_id,
      })
      .select("id")
      .maybeSingle();
    if (error) throw error;

    const itemsPayload = (cart?.items || []).map((it) => ({
      order_id: order.id,
      product_id: it.id,
      qty: it.qty,
      unit_price: it.price || 0,
    }));
    if (itemsPayload.length) {
      const { error: itErr } = await supabase.from("order_items").insert(itemsPayload);
      if (itErr) throw itErr;
    }
    return order.id;
  }

  async function onConfirm() {
    try {
      setUiError("");
      if (!cart.items.length) { setUiError("El carrito está vacío."); return; }
      if (!payment) { setUiError("Elegí un método de pago."); return; }
      if (!validateShip()) { setUiError("Completá los datos de envío obligatorios."); return; }

      setLoading(true);

      if (payment === "mp") {
        const orderId = await createOrder("pending", "mp");
        const res = await fetch("/api/mp/create-preference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandSlug,
            orderId,
            items: cart.items.map((it) => ({
              title: it.name,
              quantity: it.qty,
              unit_price: Number(it.price) || 0,
            })),
            back_urls: {
              success: typeof window !== "undefined" ? `${window.location.origin}/checkout/${brandSlug}?ok=1` : "",
              failure: typeof window !== "undefined" ? `${window.location.origin}/checkout/${brandSlug}?fail=1` : "",
              pending: typeof window !== "undefined" ? `${window.location.origin}/checkout/${brandSlug}?pend=1` : "",
            },
          }),
        });
        const data = await res.json();
        if (!res.ok || !data?.init_point) throw new Error(data?.error || "No se pudo crear la preferencia.");
        window.location.href = data.init_point;
        return;
      }

      if (payment === "transfer") {
        await createOrder("created", "transfer");
        cart.clear();
        router.push("/soporte");
        return;
      }
    } catch (e) {
      setUiError(e.message || "No se pudo completar la compra.");
    } finally {
      setLoading(false);
    }
  }

  if (brand === false) {
    return (
      <div className="container">
        <div className="card" style={{ padding: 24 }}>La marca no existe o no está pública.</div>
      </div>
    );
  }

  return (
    <div className="container">
      <Head>
        <title>Checkout — {brandSlug} — CABURE.STORE</title>
        <meta name="robots" content="noindex" />
      </Head>

      <h1>Checkout</h1>

      {/* Carrito */}
      <section className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Tu carrito</h2>
        {!cart.items.length ? (
          <div className="card" style={{ padding: 16 }}>No hay items.</div>
        ) : (
          <>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {cart.items.map((it) => (
                <li key={it.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                  <div style={{ color: "var(--text-dim)" }}>${Number(it.price || 0).toLocaleString("es-AR")}</div>
                  <input type="number" min={1} value={it.qty} onChange={(e) => cart.setQty(it.id, Number(e.target.value || 1))} className="input" style={{ width: 72 }} aria-label={`Cantidad de ${it.name}`} />
                  <button className="btn ghost" onClick={() => cart.removeItem(it.id)}>Quitar</button>
                </li>
              ))}
            </ul>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
              <button className="btn ghost" onClick={() => cart.clear()}>Vaciar carrito</button>
              <div style={{ textAlign: "right" }}>
                <div>Total</div>
                <strong>${Number(cart.totals.amount || 0).toLocaleString("es-AR")}</strong>
              </div>
            </div>
          </>
        )}
      </section>

      {uiError ? (
        <div className="card" style={{ padding: 12, border: "1px solid #a33", marginBottom: 12 }}>
          {uiError}
        </div>
      ) : null}

      {/* 1) Método de pago (siempre preguntamos) */}
      <section className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>1) Elegí el método de pago</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {PAYMENT_OPTIONS.map((opt) => {
            const disabled = opt.key === "mp" && !brand?.mp_access_token;
            return (
              <label
                key={opt.key}
                className={payment === opt.key ? "chip chip-active" : "chip"}
                style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
              >
                <input
                  type="radio"
                  name="payment"
                  value={opt.key}
                  disabled={disabled}
                  checked={payment === opt.key}
                  onChange={() => !disabled && setPayment(opt.key)}
                  aria-label={opt.label}
                />
                {opt.label}{disabled ? " (no disponible)" : ""}
              </label>
            );
          })}
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn secondary" onClick={() => setStep(2)} disabled={!payment}>Continuar a envío</button>
        </div>
      </section>

      {/* 2) Envío Correo Argentino */}
      {step >= 2 && (
        <section className="card" style={{ padding: 16, marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>2) Datos de envío — Correo Argentino</h2>
          <div className="grid grid-3" style={{ gap: 12 }}>
            <input className="input" placeholder="Nombre y Apellido *" value={ship.nombre} onChange={(e) => updateShip("nombre", e.target.value)} />
            <input className="input" placeholder="DNI *" value={ship.dni} onChange={(e) => updateShip("dni", e.target.value)} />
            <input className="input" placeholder="Email *" value={ship.email} onChange={(e) => updateShip("email", e.target.value)} />
            <input className="input" placeholder="Teléfono *" value={ship.telefono} onChange={(e) => updateShip("telefono", e.target.value)} />
            <input className="input" placeholder="Código Postal *" value={ship.cp} onChange={(e) => updateShip("cp", e.target.value)} />
            <input className="input" placeholder="Provincia *" value={ship.provincia} onChange={(e) => updateShip("provincia", e.target.value)} />
            <input className="input" placeholder="Ciudad *" value={ship.ciudad} onChange={(e) => updateShip("ciudad", e.target.value)} />
            <input className="input" placeholder="Calle *" value={ship.calle} onChange={(e) => updateShip("calle", e.target.value)} />
            <input className="input" placeholder="Altura *" value={ship.altura} onChange={(e) => updateShip("altura", e.target.value)} />
            <input className="input" placeholder="Piso" value={ship.piso} onChange={(e) => updateShip("piso", e.target.value)} />
            <input className="input" placeholder="Depto" value={ship.depto} onChange={(e) => updateShip("depto", e.target.value)} />
            <input className="input" placeholder="Entre calles" value={ship.entre_calles} onChange={(e) => updateShip("entre_calles", e.target.value)} />
          </div>
          <textarea className="input" rows={3} placeholder="Observaciones" value={ship.observaciones} onChange={(e) => updateShip("observaciones", e.target.value)} style={{ marginTop: 12 }} />
          <div style={{ marginTop: 12 }}>
            <button className="btn secondary" onClick={() => setStep(3)} disabled={!validateShip()}>Revisar y confirmar</button>
          </div>
        </section>
      )}

      {/* 3) Review + confirm */}
      {step >= 3 && (
        <section className="card" style={{ padding: 16, marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>3) Confirmación</h2>
          <p style={{ marginTop: 0 }}>
            Método de pago: <strong>{payment === "mp" ? "Mercado Pago" : payment === "transfer" ? "Transferencia" : payment}</strong>
          </p>
          {payment === "transfer" && (
            <div className="card" style={{ padding: 12, marginBottom: 12 }}>
              <div><strong>Alias:</strong> {brand?.bank_alias || "—"}</div>
              <div><strong>CBU/CVU:</strong> {brand?.bank_cbu || "—"}</div>
              <div style={{ marginTop: 8, color: "var(--text-dim)" }}>
                Luego de transferir, compartí el comprobante en el chat de soporte.
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={onConfirm} disabled={loading || !cart.items.length}>
              {payment === "mp" ? "Pagar con Mercado Pago" : "Crear pedido"}
            </button>
            <Link href={`/marcas/${brandSlug}`} className="btn ghost">Volver al catálogo</Link>
          </div>
        </section>
      )}
    </div>
  );
}
