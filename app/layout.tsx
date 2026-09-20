import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "cAlorie · 나를 위한 점심",
  description: "식사 기록과 나의 조건으로 고르는 오늘의 점심.",
  icons: {
    icon: "/images/calorie-logo.png",
    shortcut: "/images/calorie-logo.png",
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
