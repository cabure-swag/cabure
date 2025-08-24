// components/ImageBox.jsx
import React from "react";

/**
 * ImageBox: contenedor responsive con ratio fijo (por defecto 4:3),
 * lazy-loading y fallback "Sin imagen".
 *
 * Props:
 * - src: string | null
 * - alt: string
 * - ratio: string ("4:3", "1:1", "16:9", etc). Default "4:3"
 * - rounded: number (px) => default 12
 * - objectFit: "cover" | "contain" => default "cover"
 * - bg: color de fondo => default "#111"
 * - placeholderText: string => default "Sin imagen"
 */
export default function ImageBox({
  src,
  alt = "",
  ratio = "4:3",
  rounded = 12,
  objectFit = "cover",
  bg = "#111",
  placeholderText = "Sin imagen",
}) {
  // convierte "4:3" a 75% (3/4 = 0.75)
  const paddingPercent = React.useMemo(() => {
    const [w, h] = String(ratio).split(":").map(Number);
    if (!w || !h) return "75%"; // fallback a 4:3
    return `${(h / w) * 100}%`;
  }, [ratio]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        paddingBottom: paddingPercent,
        backgroundColor: bg,
        borderRadius: rounded,
        overflow: "hidden",
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit,
            borderRadius: rounded,
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#777",
            fontSize: 14,
            background: "#1b1b1b",
          }}
        >
          {placeholderText}
        </div>
      )}
    </div>
  );
}
