import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const oxanium = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: "400",
});

const oxaniumMono = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Fill the artist application form",
  description: "Join as an artist and get connected with top companies.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${oxanium.variable} ${oxaniumMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
