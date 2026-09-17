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

export const viewport: Viewport = {
  themeColor: "#0c0e18",
  width: "device-width",
  initialScale: 1,
  // Lets the page paint under the notch/Dynamic Island and home indicator instead of Safari/iOS
  // reserving a plain chrome-colored strip there; safe-area-inset-* padding keeps real content clear.
  viewportFit: "cover",
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
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <MotionProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </MotionProvider>
        <Toaster theme="dark" position="top-center" />
      </body>
    </html>
  );
}
