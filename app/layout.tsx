"use client";
/* eslint-disable @next/next/no-page-custom-font */

import "./globals.css";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  LOGIN_BYPASS_DISPLAY_NAME,
  LOGIN_BYPASS_EMAIL,
  LOGIN_BYPASS_ENABLED,
  LOGIN_BYPASS_SCOPE,
  LOGIN_BYPASS_SHOP,
} from "@/lib/auth/bypass";

export default function RootLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checkedAuth, setCheckedAuth] = useState(LOGIN_BYPASS_ENABLED);
  const bypassScript = useMemo(() => {
    if (!LOGIN_BYPASS_ENABLED) {
      return null;
    }
    const bypassConfig = {
      email: LOGIN_BYPASS_EMAIL.toLowerCase(),
      scope: LOGIN_BYPASS_SCOPE,
      displayName: LOGIN_BYPASS_DISPLAY_NAME,
      shop: LOGIN_BYPASS_SHOP,
    };
    return `(() => {
      try {
        const config = ${JSON.stringify(bypassConfig)};
        localStorage.setItem("loggedIn", "true");
        localStorage.setItem("loginEmail", config.email);
        localStorage.setItem("userScopeLevel", config.scope);
        localStorage.setItem("userDisplayName", config.displayName);
        if (config.shop) {
          localStorage.setItem("shopStore", config.shop);
          localStorage.setItem("shopUserName", config.displayName);
        }
        document.cookie = "pm-local-login=" + encodeURIComponent(config.email) + "; path=/; SameSite=Lax";
      } catch (err) {
        console.warn("Bypass login bootstrap failed", err);
      }
    })();`;
  }, []);

  useEffect(() => {
    if (LOGIN_BYPASS_ENABLED || typeof window === "undefined") return;

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
        {bypassScript ? <script dangerouslySetInnerHTML={{ __html: bypassScript }} /> : null}
      </head>
      <body>{checkedAuth ? children : null}</body>
    </html>
  );
}

