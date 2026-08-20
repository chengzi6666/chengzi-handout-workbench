import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "橙子讲义工坊",
  description: "面向教研老师的AI讲义生成与审核工具"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

