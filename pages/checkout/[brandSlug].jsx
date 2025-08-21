// pages/checkout/[brandSlug].jsx
import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";
import { useCart } from "../_app";

const PAYMENT_OPTIONS = [
  { key: "mp", label: "Mercado Pago (tarjeta/QR)" },
  { key: "transfer", label: "Transferencia bancaria" },
  // { key: "otro", label: "Otro método (próximamente)" },
];

export default function CheckoutBrand() {
  const router = useRouter();
  const { brandSlug } = router.query;
  const { cart, setQty, removeItem, clearCart } = useCart() || {};

  const [brand, setBrand] = useState(null); // info de la marca
  const [step, setStep] = useState(1); // 1: método de pago, 2: envío, 3: review
  const [payment, setPayment] = useState(null); // 'mp' | 'transfer'
  const [loading, setLoading] = useState(false);
  const [uiError, setUiError] = useState("");

  // Form envío (Correo Argentino)
  const [ship, setShip] = useState({
    nombre: "",
    dni: "",
    email: "",
    telefono: "",
    cp: "",
    provincia: "",
    ciudad: "",
    calle: "",
    altura: "",
    piso: "",
    depto: "",
    entre_calles: "",
    observaciones: "",
  });

  // 1) Cargar marca (para decidir si hay MP y ver CBU/ALIAS)
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
    return () => {
      alive = false;
    };
  }, [brandSlug]);

  // 2) Validar carrito corresponda a la misma marca
  const sameBrand = useMemo(() => {
    if (!cart?.brandSlug || !brandSlug) return false;
    return cart.brandSlug === brandSlug;
  }, [cart?.brandSlug, brandSlug]);

  const canUseMP = !!brand?.mp_access_token;

  // Helpers
  function updateShip(field, val) {
    setShip((s) => ({ ...s, [field]: val }));
  }

  function validateShip() {
    const req = ["nombre", "dni", "email", "telefono", "cp", "provincia", "ciudad", "calle", "altura"];
    for (const k of req) {
      if (!String(ship[k] || "").trim()) return false;
    }
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
        status, // 'created' | 'pending' | 'paid'
        payment_method, // 'mp' | 'transfer'
        mp_preference_id,
        mp_payment_id,
      })
      .select("id")
      .maybeSingle();
    if (error) throw error;

    // items
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

    // (opcional) guardar datos de envío en audit_logs o en una columna JSON si tenés
    // Por simplicidad, lo omitimos. Podés crear una tabla shipping_addresses ligada a orders.id.

    return order.id;
  }

  // 3) Flujo de confirmación
  async function onConfirm() {
    try {
      setUiError("");
      if (!cart?.items?.length || !sameBrand) {
        setUiError("El carrito está vacío o corresponde a otra marca.");
        return;
      }
      if (!payment) {
        setUiError("Elegí un método de pago.");
        return;
      }
      if (!validateShip()) {
        setUiError("Completá los datos de envío obligatorios.");
        return;
      }

      setLoading(true);

      if (payment === "mp") {
        // Crear orden en estado 'pending' y preferencia en backend
        const orderId = await createOrder("pending", "mp");

        // Llamada a serverless para crear preferencia con el token de la marca
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
        if (!res.ok || !data?.init_point) {
          throw new Error(data?.error || "No se pudo crear la preferencia de pago.");
        }

        // Redirigir a MP
        window.location.href = data.init_point;
        return;
      }

      if (payment === "transfer") {
        // Creamos orden 'created' y llevamos a soporte para coordinar
        await createOrder("created", "transfer");
        clearCart?.();
        router.push("/soporte");
        return;
      }
    } catch (e) {
      console.error(e);
      setUiError(e.message || "No se pudo completar la compra.");
    } finally {
      setLoading(false);
    }
  }

  // UI
  if (brand === false) {
    return (
      <div className="container">
        <div className="card" style={{ padding: 24 }}>
          La marca no existe o no está pública.
        </div>
      </div>
    );
  }

  const items = sameBrand ? cart?.items || [] : [];

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
        {!items.length ? (
          <div className="card" style={{ padding: 16 }}>No hay items en el carrito.</div>
        ) : (
          <>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {items.map((it) => (
                <li
                  key={it.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto auto",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 0",
                    borderBottom: "1px solid rgba(255,255,255,.08)",
                  }}
                >
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                  <div style={{ color: "var(--text-dim)" }}>${Number(it.price || 0).toLocaleString("es-AR")}</div>
                  <div>
                    <input
                      type="number"
                      min={1}
                      value={it.qty}
                      onChange={(e) => setQty?.(it.id, Number(e.target.value || 1))}
                      className="input"
                      style={{ width: 72 }}
                      aria-label={`Cantidad de ${it.name}`}
                    />
                  </div>
                  <button className="btn ghost" onClick={() => removeItem?.(it.id)} aria-label={`Quitar ${it.name}`}>
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
              <button className="btn ghost" onClick={() => clearCart?.()}>Vaciar carrito</button>
              <div style={{ textAlign: "right" }}>
                <div>Total</div>
                <strong>
                  ${Number(cart?.totals?.amount || 0).toLocaleString("es-AR")}
                </strong>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Wizard */}
      {uiError ? (
        <div className="card" style={{ padding: 12, border: "1px solid #a33", marginBottom: 12 }}>
          {uiError}
        </div>
      ) : null}

      {/* STEP 1: Método de pago (siempre preguntar, aunque MP no esté disponible) */}
      <section className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>1) Elegí el método de pago</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {PAYMENT_OPTIONS.map((opt) => {
            const disabled = opt.key === "mp" && !canUseMP;
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
                {opt.label}
                {opt.key === "mp" && !canUseMP ? " (no disponible)" : ""}
              </label>
            );
          })}
        </div>
        <div style={{ marginTop: 12 }}>
          <button
            className="btn secondary"
            onClick={() => setStep(2)}
            disabled={!payment}
            aria-label="Continuar a datos de envío"
          >
            Continuar a envío
          </button>
        </div>
      </section>

      {/* STEP 2: Envío Correo Argentino */}
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
          <textarea
            className="input"
            rows={3}
            placeholder="Observaciones"
            value={ship.observaciones}
            onChange={(e) => updateShip("observaciones", e.target.value)}
            style={{ marginTop: 12 }}
          />
          <div style={{ marginTop: 12 }}>
            <button
              className="btn secondary"
              onClick={() => setStep(3)}
              aria-label="Revisar y confirmar"
              disabled={!validateShip()}
            >
              Revisar y confirmar
            </button>
          </div>
        </section>
      )}

      {/* STEP 3: Review + confirm */}
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
                Luego de transferir, por favor compartí el comprobante en el chat de soporte.
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={onConfirm} disabled={loading || !items.length}>
              {payment === "mp" ? "Pagar con Mercado Pago" : "Crear pedido"}
            </button>
            <Link href={`/marcas/${brandSlug}`} className="btn ghost">Volver al catálogo</Link>
          </div>
        </section>
      )}
    </div>
  );
}
