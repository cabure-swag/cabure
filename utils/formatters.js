// utils/formatters.js

/** Pluraliza "campera" -> "Camperas", "remera" -> "Remeras". Devuelve "Todas" si vacío. */
export function pluralizeEs(s) {
  const base = String(s || "").trim();
  if (!base) return "Todas";
  // Capitaliza primera letra
  const cap = base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
  // Reglas simples de plural
  if (cap.endsWith("a")) return cap + "s";
  if (cap.endsWith("o")) return cap + "s";
  if (cap.endsWith("e")) return cap + "s";
  if (cap.endsWith("z")) return cap.slice(0, -1) + "ces";
  return cap + "s";
}

/**
 * Normaliza el campo de imágenes de un producto.
 * Acepta:
 *  - p.images: array de strings o string JSON
 *  - p.image_url: string
 * Devuelve array de URLs limpias (sin null/duplicados).
 */
export function normalizeImages(p) {
  if (!p) return [];
  const out = [];

  // images puede venir como array o como string JSON
  if (Array.isArray(p.images)) {
    for (const u of p.images) if (u) out.push(String(u));
  } else if (typeof p.images === "string" && p.images.trim()) {
    try {
      const arr = JSON.parse(p.images);
      if (Array.isArray(arr)) {
        for (const u of arr) if (u) out.push(String(u));
      }
    } catch {
      // Si no parsea, ignoramos
    }
  }

  // Fallback a image_url
  if (p.image_url) out.unshift(String(p.image_url));

  // Limpia duplicados / falsy
  const seen = new Set();
  const clean = [];
  for (const u of out) {
    const k = u.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    clean.push(k);
  }
  return clean;
}
