import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ToasterProvider } from "./components/Toaster";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Research Paper Summarizer · NYU Cloud Computing",
  description:
    "A serverless AWS platform that searches open-access academic repositories and generates structured summaries of research papers using Amazon Bedrock.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100`}
      >
        <ToasterProvider>{children}</ToasterProvider>
      </body>
    </html>
  );
}
