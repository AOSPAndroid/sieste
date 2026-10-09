import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./sieste-system.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f8fc",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://sieste.daaalil.chatgpt.site"),
  title: "sieste | Athlete Performance",
  applicationName: "sieste",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "sieste", statusBarStyle: "default" },
  description: "Sommeil, Intensité, Endurance, Suivi, Travail & Énergie. Training, sleep and recovery with COROS.",
  icons: {
    icon: [
      { url: "/sieste-icon.svg", type: "image/svg+xml" },
      { url: "/sieste-icon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/sieste-icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/sieste-icon-32.png",
    apple: { url: "/sieste-icon-180.png", sizes: "180x180" },
  },
  openGraph: {
    type: "website",
    url: "https://sieste.daaalil.chatgpt.site",
    siteName: "sieste",
    title: "sieste | Athlete Performance",
    description: "Training, sleep and recovery with COROS.",
    images: [{ url: "/sieste-icon-512.png", width: 512, height: 512, alt: "sieste — black S on white" }],
  },
  twitter: {
    card: "summary",
    title: "sieste | Athlete Performance",
    description: "Training, sleep and recovery with COROS.",
    images: ["/sieste-icon-512.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
