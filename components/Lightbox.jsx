// components/Lightbox.jsx
import React, { useEffect } from "react";

export default function Lightbox({ open, images = [], index = 0, onClose, onPrev, onNext }) {
  if (!open) return null;
  const safeIndex = Math.max(0, Math.min(index, images.length - 1));
  const src = images[safeIndex] || "";

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
      if (e.key === "ArrowLeft") onPrev?.();
      if (e.key === "ArrowRight") onNext?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  return (
    <div className="lb" role="dialog" aria-modal="true" aria-label="Visor de imagen">
      <button className="lb__close" onClick={onClose} aria-label="Cerrar">✕</button>

      {images.length > 1 && (
        <button className="lb__nav lb__nav--left" onClick={onPrev} aria-label="Anterior">‹</button>
      )}

      <div className="lb__imgWrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Imagen del producto" />
      </div>

      {images.length > 1 && (
        <button className="lb__nav lb__nav--right" onClick={onNext} aria-label="Siguiente">›</button>
      )}

      <div className="lb__dots" aria-hidden="true">
        {images.map((_, i) => (
          <span key={i} className={`dot ${i === safeIndex ? "on" : ""}`} />
        ))}
      </div>

      <style jsx>{`
        .lb {
          position: fixed; inset: 0;
          background: rgba(0,0,0,.85);
          display: grid; place-items: center;
          z-index: 1000;
        }
        .lb__imgWrap {
          max-width: min(92vw, 1200px);
          max-height: 86vh;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #2a2a2a;
          background: #0b0b0b;
        }
        .lb__imgWrap img {
          display: block;
          width: 100%; height: 100%;
          object-fit: contain;
          background: #000;
        }
        .lb__close {
          position: absolute; top: 12px; right: 12px;
          background: #151515; color: #fff;
          border: 1px solid #2a2a2a; border-radius: 10px;
          padding: 8px 10px; cursor: pointer;
        }
        .lb__nav {
          position: absolute; top: 50%; transform: translateY(-50%);
          background: #151515aa; color: #fff;
          border: 1px solid #2a2a2a; border-radius: 50%;
          width: 42px; height: 42px;
          display: grid; place-items: center;
          cursor: pointer;
        }
        .lb__nav--left { left: 16px; }
        .lb__nav--right { right: 16px; }
        .lb__dots {
          position: absolute; bottom: 16px; left: 0; right: 0;
          display: flex; justify-content: center; gap: 6px;
        }
        .dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #666;
        }
        .dot.on { background: #fff; }
      `}</style>
    </div>
  );
}
