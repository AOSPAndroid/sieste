import type { Metadata } from "next";
import "./globals.css";
import "./sleep-page.css";
import "./ui-refinement.css";
import "./dashboard-theme.css";
import "./weather-recon.css";
import "./motion.css";
import "./activity-detail.css";
import "./athlete-glance.css";
import "./training-coach.css";
import "./compact-tabs.css";
import "./sieste-v2.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://sieste.daaalil.chatgpt.site"),
  title: "sieste | Athlete Performance",
  applicationName: "sieste",
  description: "Sommeil, Intensité, Endurance, Suivi, Travail & Énergie. Training, sleep and recovery with COROS.",
  other: {
    "codex-preview": "development",
  },
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
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
