"use client";

import React from 'react';
import styles from './Brand.module.css';

export default function Brand() {
  return (
    <div className={styles.brand}>
      <img
        src="/logo.png"
        alt="Logo Entiendanla"
        className={styles.logoImage}
      />
      <span className={styles.title}>Entiendanla</span>
    </div>
  );
}
