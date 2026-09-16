import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Planet Run",
  description: "Every place you've ever run, on one interactive globe.",
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
