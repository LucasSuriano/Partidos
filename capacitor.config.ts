import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.partidoslujan.app',
  appName: 'Partidos Lujan',
  webDir: 'out',
  server: {
    url: 'https://partidos-ruby.vercel.app/',
    cleartext: true
  }
};

export default config;
