import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import AuthGate from "@/components/AuthGate";

export const metadata: Metadata = {
  title: "Health Companion",
  description: "Daily habits, food, exercise and health tracking with your care team",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body><AuthGate>{children}</AuthGate></body>
    </html>
  );
}
