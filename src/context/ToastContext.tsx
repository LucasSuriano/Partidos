"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

// ─── Tipos ───────────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

// ─── Contexto ────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// ─── Estilos por tipo ────────────────────────────────────────────────────────
const TYPE_STYLES: Record<ToastType, { border: string; icon: string; bg: string }> = {
  success: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.4)', icon: '✓' },
  error:   { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.4)',  icon: '✕' },
  warning: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)', icon: '⚠' },
  info:    { bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.4)', icon: 'ℹ' },
};

// ─── Componente individual de toast ──────────────────────────────────────────
function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const s = TYPE_STYLES[toast.type];
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 16px',
        borderRadius: '12px',
        background: 'rgba(15,17,27,0.92)',
        border: `1px solid ${s.border}`,
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        maxWidth: '380px',
        width: '100%',
        animation: 'toastSlideIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        position: 'relative',
      }}
    >
      {/* Icono */}
      <span style={{
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        background: s.bg,
        border: `1px solid ${s.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.75rem',
        fontWeight: 700,
        flexShrink: 0,
        color: s.border,
      }}>
        {s.icon}
      </span>

      {/* Mensaje */}
      <span style={{ flex: 1, fontSize: '0.88rem', lineHeight: 1.4, color: 'var(--text-primary, #e2e8f0)' }}>
        {toast.message}
      </span>

      {/* Botón cerrar */}
      <button
        onClick={onClose}
        aria-label="Cerrar notificación"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.4)',
          fontSize: '1rem',
          padding: '2px 4px',
          lineHeight: 1,
          flexShrink: 0,
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
      >
        ×
      </button>
    </div>
  );
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev.slice(-4), { id, message, type }]); // máx 5 toasts
    const timer = setTimeout(() => dismiss(id), 4000);
    timers.current.set(id, timer);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* ── Keyframes inyectados una sola vez ── */}
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(100%) scale(0.9); }
          to   { opacity: 1; transform: translateX(0)   scale(1);   }
        }
      `}</style>

      {/* ── Contenedor de toasts (top-right) ── */}
      <div
        aria-live="polite"
        aria-label="Notificaciones"
        style={{
          position: 'fixed',
          top: '80px',
          right: '16px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          pointerEvents: 'none',
        }}
      >
        {toasts.map(toast => (
          <div key={toast.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem toast={toast} onClose={() => dismiss(toast.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider');
  return ctx;
}
