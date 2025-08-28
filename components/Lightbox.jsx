// components/Lightbox.jsx
import { useEffect } from "react";

export default function Lightbox({ open, images = [], index = 0, onClose, onPrev, onNext }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
      if (e.key === "ArrowLeft") onPrev?.();
      if (e.key === "ArrowRight") onNext?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onPrev, onNext]);

  if (!open) return null;
  const current = images[index] || "";

  return (
    <div className="lb" role="dialog" aria-modal="true">
      <button className="lb__close" onClick={onClose} aria-label="Cerrar">✕</button>
      <button className="lb__nav lb__nav--left" onClick={onPrev} aria-label="Anterior">‹</button>
      <div className="lb__imgWrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {current ? <img src={current} alt="" /> : <div className="lb__ph">Sin imagen</div>}
      </div>
      <button className="lb__nav lb__nav--right" onClick={onNext} aria-label="Siguiente">›</button>

      <style jsx>{`
        .lb {
          position: fixed; inset: 0; background: rgba(0,0,0,.9);
          display: grid; grid-template-columns: 60px 1fr 60px; align-items: center;
          z-index: 1000;
        }
        .lb__imgWrap { width: 100%; max-width: 96vw; max-height: 90vh; margin: 0 auto; }
        .lb__imgWrap img { width: 100%; height: 100%; object-fit: contain; display:block; }
        .lb__ph { color:#bbb; display:flex; align-items:center; justify-content:center; height: 60vh; }

        .lb__close {
          position: fixed; top: 12px; right: 12px;
          background: #111; border: 1px solid #333; color:#fff;
          border-radius: 10px; padding: 6px 10px; cursor: pointer;
        }
        .lb__nav {
          height: 48px; width: 48px; border-radius: 999px;
          background:#111; border:1px solid #333; color:#fff; cursor:pointer;
          display:flex; align-items:center; justify-content:center; margin: 0 8px;
        }
        .lb__nav--left { justify-self: end; }
        .lb__nav--right { justify-self: start; }
      `}</style>
    </div>
  );
}
