import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface Toast {
  text: string;
  href?: string;
  linkText?: string;
  kind?: "ok" | "error";
}

const ToastContext = createContext<(t: Toast) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<(Toast & { id: number })[]>([]);
  const push = useCallback((t: Toast) => {
    const id = Date.now() + Math.random();
    setToasts((all) => [...all, { ...t, id }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), t.kind === "error" ? 12_000 : 8_000);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind === "error" ? "error" : ""}`}>
            {t.text}
            {t.href && (
              <>
                {" "}
                <a href={t.href} target="_blank" rel="noreferrer">
                  {t.linkText ?? "View"}
                </a>
              </>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
