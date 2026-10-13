import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import AuthGate from "@/components/AuthGate";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Health Companion",
  description: "Daily habits, food, exercise and health tracking with your care team",
};
export const viewport: Viewport = { themeColor: "#059674" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body><AuthGate>{children}</AuthGate></body>
    </html>
  );
}
