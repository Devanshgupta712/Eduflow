import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import BackToTop from "@/components/BackToTop";
import AstraAvatar from "@/components/AstraAvatar";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "EduSuite.ai LMS | Ultra-Premium Tech Training",
  description: "Experience the next-gen Learning Management System for EduSuite.ai Institute. Bespoke training, placement support, and MNC certification.",
  keywords: "LMS, EduSuite.ai, learning management, education, training",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "EduSuite.ai",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`animate-fade-in ${inter.variable}`}>
        <ThemeProvider>
          <AuthProvider>
            {children}
            <BackToTop />
            <AstraAvatar />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
