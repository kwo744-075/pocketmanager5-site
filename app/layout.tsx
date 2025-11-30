"use client";
/* eslint-disable @next/next/no-page-custom-font */

import "./globals.css";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checkedAuth, setCheckedAuth] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const loggedIn = localStorage.getItem("loggedIn") === "true";
    const isLoginRoute = pathname === "/login";
    const isLogoutRoute = pathname === "/logout";

    // Force login if not logged in
    if (!loggedIn && !isLoginRoute && !isLogoutRoute) {
      router.replace("/login");
    }

    // If logged in and on /login, go home
    if (loggedIn && isLoginRoute) {
      router.replace("/");
    }

    const frameId = window.requestAnimationFrame(() => {
      setCheckedAuth(true);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [pathname, router]);

  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&display=swap"
        />
      </head>
      <body>{checkedAuth ? children : null}</body>
    </html>
  );
}

