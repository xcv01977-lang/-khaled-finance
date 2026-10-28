import type { Metadata, Viewport } from "next";
import "@fontsource-variable/readex-pro";
import "./globals.css";

export const metadata: Metadata = {
  title: "ميزانيتي",
  description: "تطبيق مالي شخصي",
  appleWebApp: { capable: true, title: "ميزانيتي", statusBarStyle: "black-translucent" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b1020",
};

// Runs before first paint so the saved theme never flashes. "system" leaves the attribute off.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);else if(t!=="system")document.documentElement.setAttribute("data-theme","dark")}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
