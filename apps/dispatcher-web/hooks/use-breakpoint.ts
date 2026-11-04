"use client";

import { useState, useEffect } from "react";

export type Breakpoint = "mobile" | "tablet" | "desktop";

// Media queries, not window.innerWidth: on phones innerWidth grows to fit
// whatever is on screen, so the desktop layout drawn before this runs made a
// phone measure as a tablet and stay stuck in the wide layout. Media queries
// use the device width from the viewport meta tag, whatever the content.
const MOBILE = "(max-width: 767px)";
const TABLET = "(max-width: 1023px)";

function current(): Breakpoint {
  return window.matchMedia(MOBILE).matches ? "mobile" : window.matchMedia(TABLET).matches ? "tablet" : "desktop";
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>("desktop");

  useEffect(() => {
    const update = () => setBp(current());
    update();
    const queries = [window.matchMedia(MOBILE), window.matchMedia(TABLET)];
    queries.forEach((q) => q.addEventListener("change", update));
    return () => queries.forEach((q) => q.removeEventListener("change", update));
  }, []);

  return bp;
}
