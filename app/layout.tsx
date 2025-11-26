"use client";

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

    // If NOT logged in and not already on /login → send to /login
    if (!loggedIn && pathname !== "/login") {
      router.replace("/login");
    }

    // If logged in and on /login → send to home
    if (loggedIn && pathname === "/login") {
      router.replace("/");
    }

    setCheckedAuth(true);
  }, [pathname, router]);

  return (
    <html lang="en">
      <body>{checkedAuth ? children : null}</body>
    </html>
  );
}
