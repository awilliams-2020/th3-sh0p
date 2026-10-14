import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adam Williams — zwznco",
  description: "Projects, metrics, and live snapshots.",
  // Absolute base for og:image (app/opengraph-image.tsx); icon comes from app/icon.svg.
  metadataBase: new URL("https://zwznco.com"),
  openGraph: { siteName: "zwznco", type: "website" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-24">{children}</div>
      </body>
    </html>
  );
}
