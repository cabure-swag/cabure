// utils/cart.js
// Carrito por marca usando localStorage: cart:<brandSlug>
// Estructura de cada item: { id, name, price, qty, images?: string[] }

const isBrowser = () => typeof window !== "undefined";
const key = (brandSlug) => `cart:${brandSlug}`;

function broadcast(brandSlug) {
  if (!isBrowser()) return;
  try {
    window.dispatchEvent(new CustomEvent("cart:update", { detail: { brandSlug } }));
  } catch {}
}

export function loadCart(brandSlug) {
  if (!isBrowser()) return { items: [] };
  try {
    const raw = localStorage.getItem(key(brandSlug));
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return { items: [] };
    return { items: parsed.items };
  } catch {
    return { items: [] };
  }
}

export function saveCart(brandSlug, items) {
  if (!isBrowser()) return;
  localStorage.setItem(key(brandSlug), JSON.stringify({ items }));
  broadcast(brandSlug);
}

export function addToCart(brandSlug, product, qty = 1) {
  const cart = loadCart(brandSlug);
  const idx = cart.items.findIndex((i) => i.id === product.id);
  const safeQty = Math.max(1, qty | 0);
  const images =
    product.images && Array.isArray(product.images) && product.images.length
      ? product.images
      : product.image_url
      ? [product.image_url]
      : [];

  if (idx >= 0) {
    cart.items[idx].qty += safeQty;
  } else {
    cart.items.push({
      id: product.id,
      name: product.name,
      price: Number(product.price || 0),
      qty: safeQty,
      images,
    });
  }
  saveCart(brandSlug, cart.items);
  return cart.items;
}

export function setQty(brandSlug, productId, qty) {
  const cart = loadCart(brandSlug);
  const i = cart.items.findIndex((x) => x.id === productId);
  if (i === -1) return cart.items;
  const q = Math.max(0, qty | 0);
  if (q === 0) {
    cart.items.splice(i, 1);
  } else {
    cart.items[i].qty = q;
  }
  saveCart(brandSlug, cart.items);
  return cart.items;
}

export function removeFromCart(brandSlug, productId) {
  const cart = loadCart(brandSlug);
  const items = cart.items.filter((x) => x.id !== productId);
  saveCart(brandSlug, items);
  return items;
}

export function clearCart(brandSlug) {
  if (!isBrowser()) return;
  localStorage.removeItem(key(brandSlug));
  broadcast(brandSlug);
}

export function cartTotal(items) {
  return items.reduce((sum, it) => sum + Number(it.price || 0) * (it.qty || 0), 0);
}
