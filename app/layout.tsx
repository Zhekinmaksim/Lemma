import type { Metadata } from "next";
import { Newsreader, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Topbar } from "@/components/Topbar";
import { Footer } from "@/components/Footer";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lemma · An on-chain citation court",
  description:
    "A standing court for the scientific record. A jury of GenLayer validators reads every cited paper before the citation is filed.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://uselemma.xyz"),
  openGraph: {
    title: "Lemma · An on-chain citation court",
    description:
      "A standing court for the scientific record. A jury of validators reads every cited paper before the citation is filed.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${newsreader.variable} ${plexMono.variable}`}>
      <body>
        <div className="shell">
          <Topbar />
          <main>{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
