// utils/cart.js
// Carrito por marca en localStorage: key = cabure:cart:<brandSlug>
// Estructura: { items: [{ id, name, price, image, qty }], updatedAt }

const KEY_FOR = (brandSlug) => `cabure:cart:${brandSlug}`;

export function readCart(brandSlug) {
  try {
    const raw = localStorage.getItem(KEY_FOR(brandSlug));
    if (!raw) return { items: [], updatedAt: Date.now() };
    const data = JSON.parse(raw);
    if (!data.items) return { items: [], updatedAt: Date.now() };
    return data;
  } catch {
    return { items: [], updatedAt: Date.now() };
  }
}

function writeCart(brandSlug, cart) {
  const data = { ...cart, updatedAt: Date.now() };
  localStorage.setItem(KEY_FOR(brandSlug), JSON.stringify(data));
  // Avisar a otras pestañas/componentes
  window.dispatchEvent(new StorageEvent("storage", { key: KEY_FOR(brandSlug), newValue: JSON.stringify(data) }));
  return data;
}

export function clearCart(brandSlug) {
  localStorage.removeItem(KEY_FOR(brandSlug));
  window.dispatchEvent(new StorageEvent("storage", { key: KEY_FOR(brandSlug), newValue: null }));
}

export function addToCart(brandSlug, product, qty = 1, maxQty = Infinity) {
  const cart = readCart(brandSlug);
  const idx = cart.items.findIndex((it) => it.id === product.id);
  const base = {
    id: product.id,
    name: product.name,
    price: Number(product.price || 0),
    image: product.image_url || (Array.isArray(product.images) && product.images[0]) || "",
    qty: 0,
  };
  if (idx === -1) {
    base.qty = Math.min(qty, Math.max(0, maxQty));
    cart.items.push(base);
  } else {
    const current = cart.items[idx];
    current.qty = Math.min(current.qty + qty, Math.max(0, maxQty));
    cart.items[idx] = current;
  }
  return writeCart(brandSlug, cart);
}

export function setQty(brandSlug, productId, qty, maxQty = Infinity) {
  const cart = readCart(brandSlug);
  const idx = cart.items.findIndex((it) => it.id === productId);
  if (idx === -1) return cart;
  const q = Math.max(0, Math.min(qty, Math.max(0, maxQty)));
  if (q === 0) {
    cart.items.splice(idx, 1);
  } else {
    cart.items[idx].qty = q;
  }
  return writeCart(brandSlug, cart);
}

export function removeItem(brandSlug, productId) {
  const cart = readCart(brandSlug);
  const idx = cart.items.findIndex((it) => it.id === productId);
  if (idx !== -1) cart.items.splice(idx, 1);
  return writeCart(brandSlug, cart);
}

export function totalCart(cart) {
  return (cart.items || []).reduce((acc, it) => acc + Number(it.price || 0) * Number(it.qty || 0), 0);
}
