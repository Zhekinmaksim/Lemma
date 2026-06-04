import type { Metadata } from "next";
import "./globals.css";
import { Topbar } from "@/components/Topbar";
import { Footer } from "@/components/Footer";
import { RouteFrame } from "@/components/RouteFrame";

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
    <html lang="en">
      <body>
        <div className="shell">
          <Topbar />
          <main className="page-main">
            <RouteFrame>{children}</RouteFrame>
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
