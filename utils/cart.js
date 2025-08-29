// utils/cart.js
// Carrito por marca, con sincronización en tiempo real y límites de stock

const KEY = (slug) => `cabure:cart:${slug}`;

// --- Pub/Sub muy simple para notificar cambios en el carrito ---
function notifyCart(brandSlug) {
  if (typeof window === "undefined") return;
  try {
    const ev = new CustomEvent("cart:update", { detail: { brandSlug } });
    window.dispatchEvent(ev);
  } catch {}
}

// --- Lectura/escritura segura en localStorage ---
function readCart(brandSlug) {
  if (typeof window === "undefined") return { items: [] };
  try {
    const raw = window.localStorage.getItem(KEY(brandSlug));
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return { items: [] };
    return { items: parsed.items };
  } catch {
    return { items: [] };
  }
}

function writeCart(brandSlug, cart) {
  if (typeof window === "undefined") return;
  const safe = {
    items: Array.isArray(cart?.items) ? cart.items : [],
  };
  window.localStorage.setItem(KEY(brandSlug), JSON.stringify(safe));
  notifyCart(brandSlug);
}

// --- Normaliza un producto a la forma que guardamos en el carrito ---
function normalizeProductForCart(p) {
  const id = p?.id;
  const name = p?.name ?? "";
  const price = Number(p?.price ?? 0) || 0;
  // usamos primera imagen disponible; en la UI ya resolvés el array
  const image =
    (Array.isArray(p?.images) && p.images[0]) ||
    p?.image_url ||
    null;

  // Stock “duro” que limita cantidad por ítem
  // Aceptamos p.stock_qty o p.stock; si no hay, por defecto 1 (pedido del proyecto).
  let stockRaw = p?.stock_qty ?? p?.stock ?? 1;
  let stock = parseInt(String(stockRaw), 10);
  if (!Number.isFinite(stock) || Number.isNaN(stock)) stock = 1;
  stock = Math.max(0, stock);

  return { id, name, price, image, stock_qty: stock };
}

// --- API pública del carrito ---
export function getCart(brandSlug) {
  return readCart(brandSlug);
}

export function getCartSnapshot(brandSlug) {
  // alias de lectura por si preferís otro nombre
  return readCart(brandSlug);
}

export function getItemCount(brandSlug) {
  const { items } = readCart(brandSlug);
  return items.reduce((acc, it) => acc + (it.qty || 0), 0);
}

export function getCartTotal(brandSlug) {
  const { items } = readCart(brandSlug);
  return items.reduce((acc, it) => acc + (Number(it.price || 0) * (it.qty || 0)), 0);
}

export function clearCart(brandSlug) {
  writeCart(brandSlug, { items: [] });
}

export function removeItem(brandSlug, productId) {
  const { items } = readCart(brandSlug);
  const next = items.filter((it) => it.id !== productId);
  writeCart(brandSlug, { items: next });
}

/**
 * Agrega cantidad al carrito. Respeta límite máximo por ítem.
 * Firma compatible con usos anteriores:
 *   addToCart(slug, product, qty)
 *   addToCart(slug, product, qty, max)
 */
export function addToCart(brandSlug, product, qty = 1, maxFromCaller = null) {
  if (!brandSlug || !product?.id) return;
  const { items } = readCart(brandSlug);

  const base = normalizeProductForCart(product);

  // Máximo permitido (prioridad: parámetro > stock del producto > Infinity)
  let hardMax = Number.isFinite(maxFromCaller) ? maxFromCaller : base.stock_qty;
  if (!Number.isFinite(hardMax)) hardMax = Infinity;
  hardMax = Math.max(0, hardMax);

  const idx = items.findIndex((it) => it.id === base.id);
  if (idx === -1) {
    const newQty = Math.max(1, Math.min(qty, hardMax));
    if (newQty <= 0) return;
    items.push({ ...base, qty: newQty });
  } else {
    const current = items[idx];
    const nextQty = Math.max(1, Math.min(Number(current.qty || 0) + Number(qty || 0), hardMax));
    items[idx] = { ...current, ...base, qty: nextQty };
  }

  writeCart(brandSlug, { items });
}

export function updateQty(brandSlug, productId, qty, maxFromCaller = null) {
  if (!brandSlug || !productId) return;
  const { items } = readCart(brandSlug);
  const idx = items.findIndex((it) => it.id === productId);
  if (idx === -1) return;

  const current = items[idx];
  let hardMax = Number.isFinite(maxFromCaller) ? maxFromCaller : current?.stock_qty;
  if (!Number.isFinite(hardMax)) hardMax = Infinity;
  hardMax = Math.max(0, hardMax);

  let nextQty = parseInt(String(qty), 10);
  if (!Number.isFinite(nextQty) || Number.isNaN(nextQty)) nextQty = 1;

  if (nextQty <= 0) {
    // si ponen 0 o menos, lo sacamos del carrito
    items.splice(idx, 1);
  } else {
    nextQty = Math.min(nextQty, hardMax);
    items[idx] = { ...current, qty: nextQty };
  }

  writeCart(brandSlug, { items });
}

/**
 * Suscripción a cambios del carrito (UI en tiempo real)
 * - Notifica en cambios locales (CustomEvent)
 * - Notifica en cambios entre pestañas (event 'storage')
 * Devuelve función para desuscribir.
 */
export function subscribeCart(brandSlug, callback) {
  if (typeof window === "undefined") return () => {};
  const onCustom = (ev) => {
    if (ev?.detail?.brandSlug === brandSlug) callback(readCart(brandSlug));
  };
  const onStorage = (ev) => {
    if (ev.key === KEY(brandSlug)) callback(readCart(brandSlug));
  };
  window.addEventListener("cart:update", onCustom);
  window.addEventListener("storage", onStorage);
  // notifica estado inicial
  try { callback(readCart(brandSlug)); } catch {}
  return () => {
    window.removeEventListener("cart:update", onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
