"use client";

import { useRef, useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './UserMenu.module.css';

interface Props {
  hue: number;
}

function getInitials(username: string) {
  return username.slice(0, 2).toUpperCase();
}

export default function UserMenu({ hue }: Props) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openChangePassword = () => {
    setOpen(false);
    setShowChangePassword(true);
  };

  return (
    <>
      <div className={styles.wrapper} ref={menuRef}>
        {/* Avatar chip — click to open menu */}
        <button
          className={`${styles.avatarChip} ${open ? styles.avatarChipOpen : ''}`}
          onClick={() => setOpen(v => !v)}
        >
          <div
            className={styles.avatar}
            style={{
              background:   `hsl(${hue} 50% 25%)`,
              borderColor:  `hsl(${hue} 65% 45%)`,
              color:        `hsl(${hue} 80% 80%)`,
            }}
          >
            {user ? getInitials(user.username) : '?'}
          </div>
          <span className={styles.username}>{user?.username}</span>
          {user?.role === 'superadmin' && (
            <span className={styles.roleBadgeSuperadmin}>superadmin</span>
          )}
          {user?.role === 'admin' && (
            <span className={styles.roleBadgeAdmin}>admin</span>
          )}
          <svg
            className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
            width="12" height="12" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Dropdown */}
        {open && (
          <div className={styles.dropdown}>
            <div className={styles.dropdownHeader}>
              <div
                className={styles.dropdownAvatar}
                style={{
                  background: `hsl(${hue} 50% 25%)`,
                  borderColor: `hsl(${hue} 65% 45%)`,
                  color: `hsl(${hue} 80% 80%)`,
                }}
              >
                {user ? getInitials(user.username) : '?'}
              </div>
              <div>
                <p className={styles.dropdownName}>{user?.username}</p>
                <p className={styles.dropdownRole}>{user?.role}</p>
              </div>
            </div>

            <div className={styles.dropdownDivider} />

            <button className={styles.dropdownItem} onClick={openChangePassword}>
              <span className={styles.dropdownIcon}>🔑</span>
              Cambiar contraseña
            </button>

            <div className={styles.dropdownDivider} />

            <button className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`} onClick={logout}>
              <span className={styles.dropdownIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </span>
              Cerrar sesión
            </button>
          </div>
        )}
      </div>

      {/* Change Password Modal */}
      {showChangePassword && user && (
        <ChangePasswordModal
          userId={user.id}
          onClose={() => setShowChangePassword(false)}
        />
      )}
    </>
  );
}

/* ── Change Password Modal ── */
function ChangePasswordModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPw.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPw !== confirmPw) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, currentPassword: currentPw, newPassword: newPw }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? 'Error al cambiar la contraseña.');
      return;
    }

    setSuccess(true);
    setTimeout(onClose, 2000);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>🔑 Cambiar contraseña</h3>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        {success ? (
          <div className={styles.successMsg}>
            ✅ Contraseña actualizada correctamente.
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.label}>
              Contraseña actual
              <input
                type="password"
                className={styles.input}
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                placeholder="Tu contraseña actual"
                required
                autoComplete="current-password"
              />
            </label>
            <label className={styles.label}>
              Nueva contraseña
              <input
                type="password"
                className={styles.input}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                autoComplete="new-password"
              />
            </label>
            <label className={styles.label}>
              Confirmar contraseña
              <input
                type="password"
                className={styles.input}
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="Repetí la nueva contraseña"
                required
                autoComplete="new-password"
              />
            </label>

            {error && <p className={styles.errorMsg}>{error}</p>}

            <div className={styles.formActions}>
              <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={loading}>
                Cancelar
              </button>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={loading || !currentPw || !newPw || !confirmPw}
              >
                {loading ? <span className={styles.spinner} /> : null}
                {loading ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
