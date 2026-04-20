import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.entiendanla.app',
  appName: 'Entiendanla',
  webDir: 'out',
  server: {
    url: 'https://partidos-ruby.vercel.app/',
    cleartext: true
  }
};

export default config;
