import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tender Tracker",
  description: "Civil consultancy tender tracking PWA with PDF extraction, reminders, and import/export.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Tender Tracker"
  },
  applicationName: "Tender Tracker",
  formatDetection: {
    telephone: false
  }
};

export const viewport: Viewport = {
  themeColor: "#eef4ef",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
