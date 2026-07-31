import type { Metadata } from "next";

import { QueryProvider } from "@/providers/query-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "PFM — Personal Finance Management",
  description: "Web client for PFM — Personal Finance Management",
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
