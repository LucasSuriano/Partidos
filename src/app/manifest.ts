import { MetadataRoute } from 'next';

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Entiendanla - Gestión Deportiva',
    short_name: 'Entiendanla',
    description: 'Registro de resultados y estadísticas para torneos multideporte.',
    start_url: '/',
    display: 'standalone',
    background_color: '#101729', /* Color de fondo oscuro acorde a la app */
    theme_color: '#101729',
    icons: [
      {
        src: '/icon-192x192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
      },
      {
        src: '/icon-512x512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
      },
    ],
  };
}
