import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

import { AppProvider } from "@/context/AppContext";

export const metadata: Metadata = {
  title: "Partidos 5v5 - Estadísticas",
  description: "Registro de resultados y estadísticas de fútbol 5v5.",
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
          <AppProvider>
            {children}
          </AppProvider>
        </main>
      </body>
    </html>
  );
}
