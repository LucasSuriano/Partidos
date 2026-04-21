"use client";

import { useState, useEffect, useRef } from 'react';
import styles from './CustomSelect.module.css';

interface Option {
  id: string;
  label: string;
}

interface Props {
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  icon?: string;
}

export default function CustomSelect({ options, value, onChange, placeholder = 'Seleccionar...', icon }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.id === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        {icon && <span className={styles.icon}>{icon}</span>}
        <span className={`${styles.valueText} ${!selectedOption ? styles.placeholder : ''}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <>
          <div className={styles.overlay} onClick={() => setOpen(false)} />
          <div className={styles.dropdown}>
            <div className={styles.optionsList}>
              <div 
                className={`${styles.option} ${!value ? styles.optionSelected : ''}`}
                onClick={() => handleSelect('')}
              >
                {placeholder}
              </div>
              {options.map(opt => (
                <div
                  key={opt.id}
                  className={`${styles.option} ${value === opt.id ? styles.optionSelected : ''}`}
                  onClick={() => handleSelect(opt.id)}
                >
                  {opt.label}
                  {value === opt.id && <span className={styles.check}>✓</span>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
