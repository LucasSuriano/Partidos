"use client";

import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/config';

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Avoid hydration mismatch by waiting until component is mounted on client
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // Or a loading spinner if preferred, but usually layout should render silently
  }

  return (
    <I18nextProvider i18n={i18n}>
      {children}
    </I18nextProvider>
  );
}
