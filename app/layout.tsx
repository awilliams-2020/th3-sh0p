import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adam Williams — th3-sh0p",
  description: "Projects, metrics, and live snapshots.",
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
