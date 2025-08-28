// utils/formatters.js

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

/** Convierte rutas de Storage en URL pública absoluta.
 *  Admite:
 *   - 'bucket/folder/file.jpg'  -> https://.../storage/v1/object/public/bucket/folder/file.jpg
 *   - URL absoluta (la deja igual)
 *   - strings vacíos -> ''
 */
export function toPublicUrl(pathOrUrl) {
  const u = String(pathOrUrl || "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u; // ya es absoluta

  // Si viene algo como '/storage/v1/object/public/...', lo normalizamos con dominio si falta
  if (u.startsWith("/storage/v1/object/public/")) {
    return `${SUPA_URL}${u}`;
  }

  // Caso común: guardaste 'products/archivo.jpg' o 'brand-logos/archivo.png'
  // Asumimos que el prefijo antes de la primera '/' es el bucket.
  // Si por algún motivo guardaste ya 'bucket/...', esto anda perfecto.
  return `${SUPA_URL}/storage/v1/object/public/${u.replace(/^\/+/, "")}`;
}

/** Pluraliza "campera" -> "Camperas", "remera" -> "Remeras". Devuelve "Todas" si vacío. */
export function pluralizeEs(s) {
  const base = String(s || "").trim();
  if (!base) return "Todas";
  const cap = base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
  if (cap.endsWith("a")) return cap + "s";
  if (cap.endsWith("o")) return cap + "s";
  if (cap.endsWith("e")) return cap + "s";
  if (cap.endsWith("z")) return cap.slice(0, -1) + "ces";
  return cap + "s";
}

/** Normaliza el campo de imágenes de un producto.
 * Acepta:
 *  - p.images: array de strings, array de objetos {url}, o string JSON
 *  - p.image_url: string
 * Devuelve array de URLs públicas (sin null/duplicados), máximo 5.
 */
export function normalizeImages(p, limit = 5) {
  if (!p) return [];
  const out = [];

  const pushMaybe = (val) => {
    const url = toPublicUrl(val);
    if (!url) return;
    out.push(url);
  };

  // images puede ser array de strings/objetos
  if (Array.isArray(p.images)) {
    for (const it of p.images) {
      if (!it) continue;
      if (typeof it === "string") pushMaybe(it);
      else if (typeof it === "object" && it.url) pushMaybe(it.url);
    }
  } else if (typeof p.images === "string" && p.images.trim()) {
    // o puede ser JSON serializado
    try {
      const arr = JSON.parse(p.images);
      if (Array.isArray(arr)) {
        for (const it of arr) {
          if (!it) continue;
          if (typeof it === "string") pushMaybe(it);
          else if (typeof it === "object" && it.url) pushMaybe(it.url);
        }
      }
    } catch {
      // ignoramos si no parsea
    }
  }

  // Fallback a image_url (single)
  if (p.image_url) pushMaybe(p.image_url);

  // Limpia duplicados y corta al límite
  const seen = new Set();
  const clean = [];
  for (const u of out) {
    if (!u || seen.has(u)) continue;
    seen.add(u);
    clean.push(u);
    if (clean.length >= limit) break;
  }
  return clean;
}
