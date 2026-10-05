import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/session-provider";
import { ToastProvider } from "@/components/ui/toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "BLES DMS-MIS | Batong Lusong Elementary School",
    template: "%s | BLES DMS-MIS",
  },
  description:
    "Management Information System and Document Management System for Batong Lusong Elementary School",
  icons: {
    icon: "/bles-logo.png",
    shortcut: "/bles-logo.png",
    apple: "/bles-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <ToastProvider>{children}</ToastProvider>
        </Providers>
      </body>
    </html>
  );
}