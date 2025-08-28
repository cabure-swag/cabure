// components/CartSidebar.jsx
import { useEffect, useMemo, useState } from "react";

function readCart(brandSlug) {
  if (typeof window === "undefined") return { items: [] };
  try {
    const raw = localStorage.getItem("cabure_cart") || "{}";
    const all = JSON.parse(raw);
    return all[brandSlug] || { items: [] };
  } catch {
    return { items: [] };
  }
}

function writeCart(brandSlug, cart) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem("cabure_cart") || "{}";
    const all = JSON.parse(raw || "{}");
    all[brandSlug] = cart;
    localStorage.setItem("cabure_cart", JSON.stringify(all));
    window.dispatchEvent(new Event("cart:updated"));
  } catch {}
}

export default function CartSidebar({ brandSlug }) {
  const [ready, setReady] = useState(false);
  const [cart, setCart] = useState({ items: [] });

  useEffect(() => {
    setReady(true);
    setCart(readCart(brandSlug));
    function onUpd() { setCart(readCart(brandSlug)); }
    window.addEventListener("cart:updated", onUpd);
    return () => window.removeEventListener("cart:updated", onUpd);
  }, [brandSlug]);

  const total = useMemo(
    () => (cart.items || []).reduce((acc, it) => acc + (Number(it.price) * Number(it.qty || 1)), 0),
    [cart]
  );

  function inc(i) {
    const c = readCart(brandSlug);
    const it = c.items[i];
    if (!it) return;
    const max = Number.isFinite(it.max) ? it.max : Infinity;
    const next = Math.min((it.qty || 1) + 1, max);
    it.qty = next;
    writeCart(brandSlug, c);
    setCart(c);
  }
  function dec(i) {
    const c = readCart(brandSlug);
    const it = c.items[i];
    if (!it) return;
    const next = Math.max((it.qty || 1) - 1, 1);
    it.qty = next;
    writeCart(brandSlug, c);
    setCart(c);
  }
  function rm(i) {
    const c = readCart(brandSlug);
    c.items.splice(i, 1);
    writeCart(brandSlug, c);
    setCart(c);
  }
  function clear() {
    writeCart(brandSlug, { items: [] });
    setCart({ items: [] });
  }

  if (!ready) return <div className="card" style={{ padding: 12 }}>Cargando…</div>;

  return (
    <aside className="card" style={{ padding: 12 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Tu carrito</h3>
        {(cart.items?.length || 0) > 0 && (
          <button className="btn btn-ghost" onClick={clear}>Vaciar</button>
        )}
      </div>

      {(cart.items?.length || 0) === 0 ? (
        <p style={{ opacity: .8 }}>Todavía no agregaste productos.</p>
      ) : (
        <>
          <ul className="list">
            {cart.items.map((it, i) => (
              <li key={i} className="item">
                <div className="left">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {it.image ? <img src={it.image} alt="" /> : <div className="ph" />}
                </div>
                <div className="mid">
                  <div className="name">{it.name}</div>
                  <div className="sub">${Number(it.price).toLocaleString("es-AR")}</div>
                  <div className="qty">
                    <button onClick={() => dec(i)} aria-label="Menos">–</button>
                    <span>{it.qty || 1}</span>
                    <button onClick={() => inc(i)} aria-label="Más">+</button>
                    {Number.isFinite(it.max) && <small style={{ marginLeft: 6, opacity: .7 }}>max {it.max}</small>}
                  </div>
                </div>
                <div className="right">
                  <button className="btn btn-ghost" onClick={() => rm(i)}>Quitar</button>
                </div>
              </li>
            ))}
          </ul>

          <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
            <strong>Total</strong>
            <strong>${total.toLocaleString("es-AR")}</strong>
          </div>

          <a className="btn btn-primary" href={`/checkout/${brandSlug}`} style={{ marginTop: 10 }}>
            Finalizar compra
          </a>
        </>
      )}

      <style jsx>{`
        .row { display:flex; align-items:center; gap: 8px; }
        .list { list-style:none; padding:0; margin:12px 0 0; display:flex; flex-direction:column; gap:10px; }
        .item { display:grid; grid-template-columns: 56px 1fr auto; gap:10px; border:1px solid #1d1d1d; border-radius:10px; padding:8px; }
        .left img, .ph { width:56px; height:56px; object-fit:cover; border-radius:8px; background:#0f0f0f; display:block; }
        .name { font-weight:600; }
        .sub { opacity:.8; }
        .qty { display:flex; align-items:center; gap:6px; margin-top: 6px; }
        .qty button { width:24px; height:24px; border-radius:6px; border:1px solid #2a2a2a; background:#121212; color:#fff; cursor:pointer; }
        .btn { padding:8px 12px; border-radius:10px; border:1px solid #2a2a2a; background:#151515; color:#fff; cursor:pointer; }
        .btn-ghost { background:transparent; }
        .btn-primary { background:#2b5cff; border-color:#2b5cff; text-align:center; display:block; text-decoration:none; }
        .btn-primary:hover { filter:brightness(1.15); }
      `}</style>
    </aside>
  );
}
