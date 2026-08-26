import type { Metadata } from "next";
import "./globals.css";

const description = "Assignments, quizzes, projects, and exams in one organized semester dashboard.";

export const metadata: Metadata = {
  title: "Course Board",
  description,
  openGraph: { title: "Course Board", description, type: "website", images: ["/og.png"] },
  twitter: { card: "summary_large_image", title: "Course Board", description, images: ["/og.png"] },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
