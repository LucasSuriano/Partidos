import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

import { AuthProvider } from "@/context/AuthContext";
import { TournamentProvider } from "@/context/TournamentContext";

export const metadata: Metadata = {
  title: "Entiendanla - Estadísticas",
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
