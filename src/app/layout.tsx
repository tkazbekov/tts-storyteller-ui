import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { JobsNavLink } from "@/components/jobs-nav-link";
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
  title: "TTS Storyteller UI",
  description: "Companion UI for the local TTS Storyteller API",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased bg-background text-foreground`}
      >
        <Providers>
          <header className="border-b border-border">
            <nav className="container mx-auto flex h-14 items-center gap-6 px-4">
              <Link href="/" className="font-semibold text-lg hover:underline underline-offset-4">
                TTS Storyteller
              </Link>
              <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">
                Stories
              </Link>
              <Link href="/voices" className="text-muted-foreground hover:text-foreground text-sm">
                Voices
              </Link>
              <JobsNavLink />
            </nav>
          </header>
          <main className="container mx-auto px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
