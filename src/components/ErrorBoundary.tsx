"use client";

import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary global. Captura excepciones no manejadas en el árbol de componentes
 * y muestra un mensaje amigable en lugar de una pantalla en blanco.
 *
 * Uso: envolver secciones críticas de la app en <ErrorBoundary>.
 * Los errores siguen siendo visibles en la consola para debugging.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Error no capturado:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3rem 1.5rem',
          textAlign: 'center',
          gap: '1rem',
          minHeight: '300px',
        }}>
          <span style={{ fontSize: '3rem' }}>⚠️</span>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary, #e2e8f0)', margin: 0 }}>
            Algo salió mal
          </h2>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.9rem', maxWidth: '400px', margin: 0 }}>
            Ocurrió un error inesperado en esta sección. Intentá recargar la página.
          </p>
          {this.state.error && (
            <code style={{
              fontSize: '0.75rem',
              color: 'rgba(239,68,68,0.8)',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '8px',
              padding: '8px 12px',
              maxWidth: '500px',
              wordBreak: 'break-word',
            }}>
              {this.state.error.message}
            </code>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: '0.5rem',
              padding: '0.5rem 1.5rem',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--text-primary, #e2e8f0)',
              cursor: 'pointer',
              fontSize: '0.88rem',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          >
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
