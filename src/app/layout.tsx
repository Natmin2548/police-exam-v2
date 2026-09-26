import type { Metadata, Viewport } from "next";
import "./globals.css";
import PWAInstallBanner from "@/components/PWAInstallBanner";

export const metadata: Metadata = {
  title: "POLICE EXAM - เตรียมพร้อมสู่เครื่องแบบ",
  description: "แพลตฟอร์มเตรียมสอบนายสิบตำรวจที่ครบวงจร ใช้งานฟรี ตะลุยข้อสอบเก่าและใหม่",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "POLICE EXAM",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-512.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#BD1B0B",
};

export default function RootLayout({
  children,
}: ReadInternalProps) {
  return (
    <html lang="th" className="scroll-smooth">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-512.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="POLICE EXAM" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-police-100 selection:text-police-900">
        {children}
        <PWAInstallBanner />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    try {
                      navigator.serviceWorker.register('/sw.js').then(function(reg) {
                        if (reg && typeof reg.update === 'function') {
                          reg.update().catch(function() {});
                        }
                      }).catch(function() {});

                      if ('caches' in window) {
                        caches.keys().then(function(keys) {
                          keys.forEach(function(key) {
                            if (key !== 'police-exam-v5') {
                              caches.delete(key).catch(function() {});
                            }
                          });
                        }).catch(function() {});
                      }
                    } catch (e) {}
                  });
                }
              } catch (e) {}
            `,
          }}
        />
      </body>
    </html>
  );
}

interface ReadInternalProps {
  children: React.ReactNode;
}
