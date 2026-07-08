import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "../context/Web3Context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DefiTask Protocol | Web3 Escrow Tasks",
  description: "Decentralized task coordination and escrow payment protocol",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-bgMain`}>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
