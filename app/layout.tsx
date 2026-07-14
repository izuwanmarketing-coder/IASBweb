import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "droply! — Save the good stuff",
  description: "A private, local-first social media downloader for public posts."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
