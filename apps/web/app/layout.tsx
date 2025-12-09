import type { Metadata } from "next";
import "./globals.css";
import { Layout } from "@/components/layout/Layout";
import { FirebaseProvider } from "@/components/providers/FirebaseProvider";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";

export const metadata: Metadata = {
  title: "Specifys.ai - Plan Your App Smarter",
  description: "Plan your dream app for free with smart AI tools, including Vibe Coding Tools Map and Tool Finder.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" referrerPolicy="no-referrer" />
      </head>
      <body className="font-sans antialiased">
        <GoogleAnalytics />
        <FirebaseProvider>
          <Layout>{children}</Layout>
        </FirebaseProvider>
      </body>
    </html>
  );
}
