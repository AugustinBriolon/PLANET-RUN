import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { MotionProvider } from "@/components/motion/motion-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION = "Every place you've ever run, on one interactive globe.";

// Matches --space so Safari Liquid Glass / status-bar tint samples the night sky, not a flat black strip.
const THEME_COLOR = "#0c0e18";

export const viewport: Viewport = {
  themeColor: THEME_COLOR,
  width: "device-width",
  initialScale: 1,
  // viewport-fit=cover → paint under notch / home indicator; safe-area-inset-* keeps UI clear.
  viewportFit: "cover",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://planet-run.vercel.app"),
  title: "Planet Run",
  description: DESCRIPTION,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Planet Run",
  },
  openGraph: {
    title: "Planet Run",
    description: DESCRIPTION,
    siteName: "Planet Run",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Planet Run",
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Browser extensions (e.g. LanguageTool) inject attributes on <html> before hydration.
    <html
      lang="en"
      suppressHydrationWarning
      className={`dark ${geistSans.variable} ${geistMono.variable} h-dvh antialiased`}
    >
      <body className="min-h-dvh bg-space text-foreground overscroll-none">
        <MotionProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </MotionProvider>
        <Toaster theme="dark" position="top-center" />
      </body>
    </html>
  );
}
