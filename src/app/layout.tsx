import type { Metadata } from "next";
import { Suspense } from "react";
import { siteConfig } from "@/config/site";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { AppCheckProvider } from "@/components/providers/app-check-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { RouteProgress } from "@/components/navigation/route-progress";
import { PORTAL_FAVICON_PATH } from "@/lib/branding/assets";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const metadataBase = process.env.NEXT_PUBLIC_APP_URL
  ? new URL(process.env.NEXT_PUBLIC_APP_URL)
  : undefined;

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  icons: {
    icon: PORTAL_FAVICON_PATH,
    shortcut: PORTAL_FAVICON_PATH,
    apple: PORTAL_FAVICON_PATH,
  },
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    url: "/",
    siteName: siteConfig.name,
    type: "website",
    locale: "en_GH",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ToastProvider>
          <AppCheckProvider />
          <Suspense fallback={null}>
            <RouteProgress />
          </Suspense>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
