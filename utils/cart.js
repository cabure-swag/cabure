// utils/cart.js
/**
 * Carrito por marca:
 * - Clave: cart:<brandSlug> en localStorage
 * - Estructura de item: { id, name, price, qty, max, thumb }
 * - "max" es el tope permitido (stock disponible)
 */

function key(slug) {
  return `cart:${slug}`;
}

export function readCart(slug) {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key(slug));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function writeCart(slug, items) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(slug), JSON.stringify(items || []));
  // Notificamos al resto de la app (misma pestaña y otras)
  try {
    window.dispatchEvent(new CustomEvent("cart:changed", { detail: { slug } }));
  } catch {}
}

/**
 * Agrega (o incrementa) un producto al carrito de una marca.
 * - qty: cantidad a sumar (default 1)
 * - max: tope de stock (Infinity si no se provee)
 */
export function addToCart(slug, product, qty = 1, max) {
  if (!slug || !product) return [];

  const items = readCart(slug);
  const id = String(product.id ?? "");
  if (!id) return items;

  const limit = Number.isFinite(max) ? Math.max(0, max) : Infinity;
  const idx = items.findIndex((it) => String(it.id) === id);

  if (idx >= 0) {
    const prev = items[idx];
    const nextQty = Math.min((Number(prev.qty) || 1) + (Number(qty) || 1), limit);
    items[idx] = { ...prev, qty: nextQty, max: limit };
  } else {
    const name = product.name ?? "Producto";
    const price = Number(product.price || 0);
    const thumb =
      (Array.isArray(product.images) && product.images[0]) ||
      product.image_url ||
      null;

    const firstQty = Math.min(Number(qty) || 1, limit === Infinity ? (Number(qty) || 1) : limit);
    items.push({ id, name, price, qty: firstQty, max: limit, thumb });
  }

  writeCart(slug, items);
  return items;
}

export function setQty(slug, productId, qty, max) {
  const items = readCart(slug);
  const idx = items.findIndex((it) => String(it.id) === String(productId));
  if (idx < 0) return items;

  const limit = Number.isFinite(max) ? Math.max(0, max) : (Number.isFinite(items[idx].max) ? items[idx].max : Infinity);
  const nextQty = Math.max(1, Math.min(Number(qty) || 1, limit));
  items[idx] = { ...items[idx], qty: nextQty, max: limit };

  writeCart(slug, items);
  return items;
}

export function removeFromCart(slug, productId) {
  const next = readCart(slug).filter((it) => String(it.id) !== String(productId));
  writeCart(slug, next);
  return next;
}

export function clearCart(slug) {
  writeCart(slug, []);
  return [];
}
