import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

// データベース(Supabase)はソウルにあるため、サーバー処理も同じ地域で動かす。
// 遠い地域から何度も往復すると、それだけで画面表示が数秒遅くなる。
export const preferredRegion = "icn1";

export const metadata: Metadata = {
  title: "つむぐカフェ",
  description: "原価計算・在庫管理・レジ・決済をまとめたカフェ運営アプリ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="font-sans antialiased">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
