// pages/marcas/[slug].jsx
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

// ----------------------------- Utils -----------------------------
function currency(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

function coerceImages(images) {
  // Acepta: array JSON | string URL única | string con URLs separadas por coma/espacio
  if (!images) return [];
  if (Array.isArray(images)) return images.filter(Boolean);
  if (typeof images === "string") {
    const trimmed = images.trim();
    if (!trimmed) return [];
    if (trimmed.includes("http")) {
      // separa por coma o espacios
      return trimmed
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter((s) => s.startsWith("http"));
    }
    return [];
  }
  return [];
}

function normalizeBrand(b) {
  if (!b) return null;
  const logo =
    b.logo_url || b.logo || b.image || b.avatar_url || b.logoUrl || null;
  const instagram =
    b.instagram_url || b.instagram || b.ig || b.instagramUrl || null;
  return {
    id: b.id,
    name: b.name || b.title || "Marca",
    description: b.description || b.bio || "",
    slug: b.slug,
    logo,
    instagram,
    color: b.color || null,
    bank_alias: b.bank_alias || null,
    bank_cbu: b.bank_cbu || null,
    mp_access_token: b.mp_access_token || null,
  };
}

// ----------------------------- Carrito por marca (localStorage) -----------------------------
function useBrandCart(brandId) {
  const key = brandId ? `cabure_cart_${brandId}` : null;

  const [items, setItems] = useState(() => {
    if (!key) return [];
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch {}
  }, [key, items]);

  const add = useCallback((p, qty = 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.productId === p.id);
      const next = [...prev];
      if (idx >= 0) {
        next[idx] = {
          ...next[idx],
          qty: Math.min((next[idx].qty || 0) + qty, Number(p.stock || 0)),
        };
      } else {
        next.push({
          productId: p.id,
          name: p.name,
          price: Number(p.price || 0),
          qty: Math.min(qty, Number(p.stock || 0) || 1),
          image: coerceImages(p.images)[0] || null,
        });
      }
      return next;
    });
  }, []);

  const remove = useCallback((productId) => {
    setItems((prev) => prev.filter((it) => it.productId !== productId));
  }, []);

  const setQty = useCallback((productId, qty) => {
    setItems((prev) =>
      prev.map((it) =>
        it.productId === productId ? { ...it, qty: Math.max(1, Number(qty || 1)) } : it
      )
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const total = useMemo(
    () => items.reduce((acc, it) => acc + Number(it.price || 0) * Number(it.qty || 0), 0),
    [items]
  );

  return { items, add, remove, setQty, clear, total };
}

// ----------------------------- Checkout Modal -----------------------------
function CheckoutModal({ open, onClose, brand, cart, onCreated }) {
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
      setFullName("");
      setDni("");
      setEmail("");
      setPhone("");
      setAddress("");
      setPostal("");
      setCity("");
      setProvince("");
      setPayMethod("");
      setSaving(false);
    }
  }, [open]);

  if (!open) return null;

  const canConfirm =
    fullName.trim() &&
    dni.trim() &&
    email.trim() &&
    phone.trim() &&
    address.trim() &&
    postal.trim() &&
    city.trim() &&
    province.trim() &&
    payMethod &&
    cart.items.length > 0;

  async function confirm() {
    if (!canConfirm || !brand?.id) return;
    try {
      setSaving(true);

      // 1) Insert order
      const payloadOrder = {
        brand_id: brand.id,
        total: cart.total,
        status: "created",
        payment_method: payMethod === "mp" ? "mercadopago" : "transfer",
      };
      const { data: order, error: eo } = await supabase
        .from("orders")
        .insert(payloadOrder)
        .select("id")
        .maybeSingle();
      if (eo) throw eo;

      // 2) Insert order_items
      const itemsRows = cart.items.map((it) => ({
        order_id: order.id,
        product_id: it.productId,
        qty: it.qty,
        unit_price: it.price,
      }));
      const { error: ei } = await supabase.from("order_items").insert(itemsRows);
      if (ei) throw ei;

      // 3) Crear hilo de soporte (por marca) + primer mensaje con los datos y pedido
      const { data: sessionData } = await supabase.auth.getSession();
      const buyer_id = sessionData?.session?.user?.id || null;

      const { data: thread, error: et } = await supabase
        .from("support_threads")
        .insert({
          user_id: buyer_id, // si no hay sesión, quedará null; RLS podría bloquear; lo intentamos igual
          brand_id: brand.id,
          status: "open",
        })
        .select("id")
        .maybeSingle();
      if (et) throw et;

      const summaryLines = [
        `Nuevo pedido #${order.id}`,
        `Marca: ${brand.name}`,
        `Total: ${currency(cart.total)}`,
        `Pago: ${payMethod === "mp" ? "Mercado Pago" : "Transferencia"}`,
        `Envio (Correo Arg.):`,
        `  Nombre: ${fullName}`,
        `  DNI: ${dni}`,
        `  Email: ${email}`,
        `  Tel: ${phone}`,
        `  Dirección: ${address}`,
        `  CP: ${postal} - ${city}, ${province}`,
        `Items:`,
        ...cart.items.map(
          (it) => `  - ${it.name} x${it.qty} — ${currency(it.price)}`
        ),
      ].join("\n");

      const { error: em } = await supabase.from("support_messages").insert({
        thread_id: thread.id,
        sender_role: "user",
        message: summaryLines,
      });
      if (em) throw em;

      onCreated?.(order.id);
    } catch (e) {
      console.error("checkout error:", e);
      alert("No se pudo crear el pedido. Revisá que estés logueado y probá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="card"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 40,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: 620, padding: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>Datos de envío y pago</h2>

        <div className="row" style={{ gap: 8 }}>
          <input className="input" placeholder="Nombre y Apellido" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <input className="input" placeholder="DNI" value={dni} onChange={(e) => setDni(e.target.value)} />
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" placeholder="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <input className="input" placeholder="Dirección" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <input className="input" placeholder="Código Postal" value={postal} onChange={(e) => setPostal(e.target.value)} />
          <input className="input" placeholder="Ciudad" value={city} onChange={(e) => setCity(e.target.value)} />
          <input className="input" placeholder="Provincia" value={province} onChange={(e) => setProvince(e.target.value)} />
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 6, color: "#9aa" }}>Método de pago</div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {mpAvailable && (
              <label className="chip" style={{ cursor: "pointer" }}>
                <input
                  type="radio"
                  name="pay"
                  checked={payMethod === "mp"}
                  onChange={() => setPayMethod("mp")}
                  style={{ marginRight: 8 }}
                />
                Mercado Pago
              </label>
            )}
            <label className="chip" style={{ cursor: "pointer" }}>
              <input
                type="radio"
                name="pay"
                checked={payMethod === "transfer"}
                onChange={() => setPayMethod("transfer")}
                style={{ marginRight: 8 }}
              />
              Transferencia (Alias/CBU)
            </label>
          </div>
        </div>

        {payMethod === "transfer" && (
          <div
            className="card"
            style={{
              marginTop: 12,
              padding: 12,
              border: "1px dashed var(--border)",
            }}
          >
            <div><strong>Alias:</strong> {brand?.bank_alias || "—"}</div>
            <div><strong>CBU/CVU:</strong> {brand?.bank_cbu || "—"}</div>
            <div style={{ marginTop: 6, color: "#9aa", fontSize: 12 }}>
              Luego de transferir, el vendedor te confirmará por chat.
            </div>
          </div>
        )}

        <div className="row" style={{ marginTop: 16, alignItems: "center" }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <div style={{ flex: 1 }} />
          <strong style={{ marginRight: 12 }}>{currency(cart.total)}</strong>
          <button className="btn btn-primary" onClick={confirm} disabled={!canConfirm || saving}>
            {saving ? "Creando pedido..." : "Confirmar pedido"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------- Página -----------------------------
export default function BrandPage() {
  const router = useRouter();
  const { slug } = router.query;

  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState(null);
  const [productsRaw, setProductsRaw] = useState([]);

  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("Todas");

  // Checkout modal
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // Carga marca + productos
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // Marca
        const { data: b, error: e1 } = await supabase
          .from("brands")
          .select("*")
          .eq("slug", slug)
          .maybeSingle();
        if (e1) throw e1;
        if (!cancelled) setBrand(normalizeBrand(b));

        // Productos (sin filtrar SQL para evitar problemas de tipos)
        if (b?.id) {
          const { data: ps, error: e2 } = await supabase
            .from("products")
            .select("*")
            .eq("brand_id", b.id)
            .order("id", { ascending: false });
          if (e2) throw e2;
          if (!cancelled) setProductsRaw(Array.isArray(ps) ? ps : []);
        } else {
          if (!cancelled) setProductsRaw([]);
        }
      } catch (err) {
        console.error("[/marcas/[slug]] error:", err);
        if (!cancelled) {
          setBrand(null);
          setProductsRaw([]);
        }
      } finally {
        !cancelled && setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const cart = useBrandCart(brand?.id);

  // Filtro en cliente
  const products = useMemo(() => {
    const base = Array.isArray(productsRaw) ? productsRaw : [];
    let data = base.filter((p) => Boolean(p?.active) && Number(p?.stock || 0) > 0);
    if (activeCat && activeCat !== "Todas") {
      data = data.filter(
        (p) => (p?.category || "").trim() === (activeCat || "").trim()
      );
    }
    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter((p) => p?.name?.toLowerCase().includes(q));
    }
    return data;
  }, [productsRaw, activeCat, search]);

  const categories = useMemo(() => {
    const s = new Set();
    (Array.isArray(productsRaw) ? productsRaw : []).forEach((p) => {
      const c = (p?.category || "").trim();
      if (c) s.add(c);
    });
    return ["Todas", ...Array.from(s)];
  }, [productsRaw]);

  const handleAdd = useCallback(
    (p) => {
      cart.add(p, 1);
    },
    [cart]
  );

  function handleOrderCreated(orderId) {
    cart.clear();
    setCheckoutOpen(false);
    alert(`Pedido creado (#${orderId}). Se abrió un chat con el vendedor.`);
    // Podés redirigir si querés: router.push("/soporte");
  }

  return (
    <>
      <Head>
        <title>{brand?.name ? `${brand.name} — CABURE.STORE` : "CABURE.STORE"}</title>
      </Head>

      <div className="container" style={{ paddingBottom: 56 }}>
        {/* HEADER (logo izq, datos centro, carrito der) */}
        <section
          className="card"
          style={{
            display: "grid",
            gridTemplateColumns: "160px 1fr 360px",
            gap: 16,
            alignItems: "center",
            padding: 16,
          }}
        >
          {/* LOGO */}
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: 16,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--panel)",
              border: "1px dashed var(--border)",
            }}
          >
            {brand?.logo ? (
              <img
                src={brand.logo}
                alt={brand?.name || "logo"}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <div style={{ color: "#999", fontSize: 12 }}>Sin logo</div>
            )}
          </div>

          {/* DATOS */}
          <div>
            <h1 style={{ margin: 0 }}>{brand?.name || "Marca"}</h1>
            {brand?.description && (
              <p style={{ margin: "6px 0 12px 0", color: "#bbb" }}>
                {brand.description}
              </p>
            )}
            <div className="row" style={{ gap: 8 }}>
              {brand?.instagram && (
                <a
                  href={brand.instagram}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost"
                  aria-label="Instagram"
                >
                  <span style={{ marginRight: 6 }}>📸</span>
                  Instagram
                </a>
              )}
              {/* Se quitó "Perfil público" como pediste */}
            </div>
          </div>

          {/* CARRITO (derecha) */}
          <aside className="card" style={{ padding: 12 }}>
            <div className="row" style={{ alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1rem" }}>Carrito</h3>
              <div style={{ flex: 1 }} />
              <strong>{currency(cart.total)}</strong>
            </div>

            {cart.items.length === 0 ? (
              <div
                style={{
                  marginTop: 8,
                  padding: 12,
                  borderRadius: 10,
                  background: "var(--panel)",
                  border: "1px dashed var(--border)",
                  color: "#9aa",
                  fontSize: 14,
                }}
              >
                Tu carrito está vacío.
              </div>
            ) : (
              <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                {cart.items.map((it) => (
                  <div
                    key={it.productId}
                    className="row"
                    style={{
                      gap: 8,
                      alignItems: "center",
                      borderBottom: "1px solid var(--border)",
                      paddingBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        overflow: "hidden",
                        background: "var(--panel)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {it.image ? (
                        <img
                          src={it.image}
                          alt={it.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : null}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {it.name}
                      </div>
                      <div style={{ fontSize: 12, color: "#9aa" }}>
                        {currency(it.price)}
                      </div>
                    </div>
                    <div style={{ flex: 1 }} />
                    <input
                      type="number"
                      min={1}
                      value={it.qty}
                      onChange={(e) => cart.setQty(it.productId, e.target.value)}
                      className="input"
                      style={{ width: 64, padding: "6px 8px" }}
                      aria-label="Cantidad"
                    />
                    <button className="btn btn-ghost" onClick={() => cart.remove(it.productId)}>
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="row" style={{ gap: 8, marginTop: 10, alignItems: "center" }}>
              <button className="btn btn-ghost" onClick={cart.clear} disabled={cart.items.length === 0}>
                Vaciar
              </button>
              <div style={{ flex: 1 }} />
              <button
                className="btn btn-primary"
                onClick={() => setCheckoutOpen(true)}
                disabled={cart.items.length === 0}
              >
                Finalizar compra
              </button>
            </div>
          </aside>
        </section>

        {/* CONTROLES SOBRE EL CATÁLOGO */}
        <section className="row" style={{ gap: 12, marginTop: 16 }}>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`chip ${cat === activeCat ? "chip--active" : ""}`}
                onClick={() => setActiveCat(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto…"
            className="input"
            style={{ maxWidth: 320 }}
            aria-label="Buscar producto"
          />
        </section>

        {/* GRID DEL CATÁLOGO */}
        <section
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card skeleton" style={{ height: 380 }} />
            ))
          ) : products.length === 0 ? (
            <div
              className="card"
              style={{
                gridColumn: "1 / -1",
                padding: 24,
                textAlign: "center",
                border: "1px dashed var(--border)",
              }}
            >
              No hay productos para mostrar.
            </div>
          ) : (
            products.map((p) => <ProductCard key={p.id} product={p} onAdd={() => handleAdd(p)} />)
          )}
        </section>
      </div>

      {/* Modal de Checkout */}
      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        brand={brand}
        cart={cart}
        onCreated={handleOrderCreated}
      />

      <style jsx>{`
        .chip {
          background: var(--panel);
          color: var(--text);
          border: 1px solid var(--border);
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 0.9rem;
        }
        .chip--active {
          background: var(--brand);
          color: #000;
          border-color: var(--brand);
        }
        .input {
          width: 100%;
          background: var(--panel);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 10px 12px;
          border-radius: 10px;
          outline: none;
        }
        .skeleton {
          opacity: 0.5;
        }
      `}</style>
    </>
  );
}

// ----------------------------- Product Card -----------------------------
function ProductCard({ product, onAdd }) {
  const imgs = coerceImages(product?.images);
  const [idx, setIdx] = useState(0);

  const prev = () => setIdx((i) => (imgs.length ? (i - 1 + imgs.length) % imgs.length : 0));
  const next = () => setIdx((i) => (imgs.length ? (i + 1) % imgs.length : 0));

  return (
    <article className="card" style={{ padding: 12 }}>
      <div
        style={{
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 12,
          overflow: "hidden",
          position: "relative",
          background: "var(--panel)",
          border: "1px dashed var(--border)",
        }}
      >
        {imgs.length ? (
          <img
            src={imgs[idx]}
            alt={product?.name || "producto"}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#888",
              fontSize: 12,
            }}
          >
            Sin imagen
          </div>
        )}

        {imgs.length > 1 && (
          <>
            <button
              onClick={prev}
              className="btn btn-ghost"
              style={{ position: "absolute", left: 8, top: "calc(50% - 18px)" }}
              aria-label="Anterior"
            >
              ◀
            </button>
            <button
              onClick={next}
              className="btn btn-ghost"
              style={{ position: "absolute", right: 8, top: "calc(50% - 18px)" }}
              aria-label="Siguiente"
            >
              ▶
            </button>
          </>
        )}
      </div>

      <h3 style={{ margin: "8px 0 0 0", fontSize: "1rem" }}>
        {product?.name || "Producto"}
      </h3>
      <div style={{ color: "#9aa", fontSize: 12, marginTop: 2 }}>
        {(product?.category || "").trim() || "—"}
      </div>

      <div className="row" style={{ alignItems: "center", marginTop: 8 }}>
        <strong>{currency(product?.price)}</strong>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={onAdd}>
          Agregar
        </button>
      </div>
    </article>
  );
}
