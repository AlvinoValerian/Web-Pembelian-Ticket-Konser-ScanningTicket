import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VIBECHECK - Loud. Live. Legendary.",
  description: "Skip the fees. Feel the bass. Secure your spot at the most exclusive underground and arena shows in the city. No BS, just tickets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased selection:bg-brand-yellow selection:text-brand-black">
        {children}
      </body>
    </html>
  );
}
