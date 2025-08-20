import { createContext, useContext, useState, useCallback } from "react";

const ToastCtx = createContext(null);
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, opts={}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, msg, ...opts }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id!==id)), opts.ms ?? 3000);
  }, []);
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="toast-root" aria-live="polite" aria-atomic="true">
        {toasts.map(t => (
          <div key={t.id} className="toast" role="status">{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
};
export const useToast = () => useContext(ToastCtx);