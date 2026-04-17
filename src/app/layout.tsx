import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

import { AuthProvider } from "@/context/AuthContext";
import { TournamentProvider } from "@/context/TournamentContext";

export const viewport: Viewport = {
  themeColor: "#101729",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "Entiendanla - Estadísticas",
  description: "Registro de resultados y estadísticas de fútbol 5v5.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Entiendanla",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={inter.variable}>
      <body>
        <main>
          <AuthProvider>
            <TournamentProvider>
              {children}
            </TournamentProvider>
          </AuthProvider>
        </main>
      </body>
    </html>
  );
}
