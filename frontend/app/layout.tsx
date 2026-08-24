import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { Nav } from "@/components/nav";
import { Sesion } from "@/components/sesion";
import { PieDePagina } from "@/components/pie";

export const metadata: Metadata = {
  title: "Roundtrip TMS",
  description: "Gestión de servicios de transporte: asignación, monitoreo y cobranza.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">
        <StoreProvider>
          <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col sm:flex-row">
            <div className="flex min-w-0 flex-1 flex-col sm:order-1">
              <main className="flex-1 px-4 py-6 sm:px-6">
                <Sesion>{children}</Sesion>
              </main>
              <PieDePagina />
            </div>
            <div className="sm:order-2">
              <Nav />
            </div>
          </div>
        </StoreProvider>
      </body>
    </html>
  );
}
