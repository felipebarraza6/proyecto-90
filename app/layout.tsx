import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  return {
    metadataBase,
    title: "Proyecto 90 — Tu tablero de 90 días",
    description: "Aprende a entrenar, comer y sostenerlo. Un sistema simple para tus primeros 90 días.",
    icons: { icon: "/proyecto90-logo.jpg", shortcut: "/proyecto90-logo.jpg" },
    openGraph: { title: "Proyecto 90", description: "Aprende a entrenar. Aprende a comer. Aprende a sostenerlo.", images: [{ url: "/proyecto90-logo.jpg", width: 384, height: 384 }] },
    twitter: { card: "summary", title: "Proyecto 90", description: "Tu tablero personal de 90 días.", images: ["/proyecto90-logo.jpg"] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
