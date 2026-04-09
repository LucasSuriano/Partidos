"use client";

import { useState, useEffect, useRef } from 'react';
import styles from './DatePicker.module.css';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DIAS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

interface Props {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
}

export default function DatePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const parsedDate = value ? new Date(value + 'T12:00:00') : new Date();
  const [viewYear, setViewYear] = useState(parsedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsedDate.getMonth());

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const formatDisplay = (dateStr: string) => {
    if (!dateStr) return 'DD/MM/AAAA';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const getDaysInMonth = (year: number, month: number) =>
    new Date(year, month + 1, 0).getDate();

  // Lunes = 0, ..., Domingo = 6
  const getFirstDayOffset = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const handleDayClick = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${viewYear}-${m}-${d}`);
    setOpen(false);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const offset = getFirstDayOffset(viewYear, viewMonth);

  const isSelected = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return value === `${viewYear}-${m}-${d}`;
  };

  const isToday = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return todayStr === `${viewYear}-${m}-${d}`;
  };

  const goToToday = () => {
    onChange(todayStr);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setOpen(false);
  };

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className={styles.calIcon}>📅</span>
        <span className={styles.dateText}>{formatDisplay(value)}</span>
        <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={styles.calendar}>
          {/* Header */}
          <div className={styles.header}>
            <button type="button" className={styles.navBtn} onClick={prevMonth}>‹</button>
            <span className={styles.monthYear}>
              {MESES[viewMonth]} {viewYear}
            </span>
            <button type="button" className={styles.navBtn} onClick={nextMonth}>›</button>
          </div>

          {/* Días de la semana */}
          <div className={styles.grid}>
            {DIAS.map(d => (
              <div key={d} className={styles.dayName}>{d}</div>
            ))}

            {/* Celdas vacías para offset */}
            {Array.from({ length: offset }).map((_, i) => (
              <div key={`e-${i}`} />
            ))}

            {/* Días del mes */}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
              <button
                key={day}
                type="button"
                onClick={() => handleDayClick(day)}
                className={`${styles.dayCell} ${isSelected(day) ? styles.selected : ''} ${isToday(day) && !isSelected(day) ? styles.today : ''}`}
              >
                {day}
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className={styles.footer}>
            <button type="button" className={styles.todayBtn} onClick={goToToday}>
              Hoy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
