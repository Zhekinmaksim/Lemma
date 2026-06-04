"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const ENTER_MS = 220;

export function RouteFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const previousPathRef = useRef(pathname);
  const [phase, setPhase] = useState<"idle" | "routing" | "entering">("idle");

  useEffect(() => {
    function handleRouteStart(event: Event) {
      const nextHref =
        event instanceof CustomEvent && typeof event.detail?.href === "string"
          ? event.detail.href
          : null;

      if (!nextHref || nextHref === pathname) return;
      setPhase("routing");
    }

    window.addEventListener("lemma:route-start", handleRouteStart);
    return () => {
      window.removeEventListener("lemma:route-start", handleRouteStart);
    };
  }, [pathname]);

  useEffect(() => {
    if (previousPathRef.current === pathname) return;

    previousPathRef.current = pathname;
    setPhase("entering");

    const timeout = window.setTimeout(() => {
      setPhase("idle");
    }, ENTER_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [pathname]);

  return (
    <div
      className={`route-frame ${
        phase === "routing" ? "is-routing" : phase === "entering" ? "is-entering" : ""
      }`}
    >
      {children}
    </div>
  );
}
