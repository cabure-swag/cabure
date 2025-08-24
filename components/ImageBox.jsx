// components/ImageBox.jsx
import React from "react";

export default function ImageBox({
  src,
  alt = "",
  ratio = "4:3",
  rounded = 12,
  objectFit = "cover",
  bg = "#111",
  placeholderText = "Sin imagen",
}) {
  const paddingPercent = React.useMemo(() => {
    const [w, h] = String(ratio).split(":").map(Number);
    if (!w || !h) return "75%";
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
