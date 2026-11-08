import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PgDog Helm chart: a readiness probe by default",
  description:
    "The PgDog Helm chart has no readiness probe, so a bad config rolls out to every pod. A default probe on PgDog's healthcheck endpoint stops the rollout at the first broken pod. Recorded on kind. Unofficial demo by Cheryl Aurelia.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${mono.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
