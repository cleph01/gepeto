"use client";

import { useEffect, useState } from "react";

/** The part of the screen you can actually see: its top edge and height, in px. */
export interface VisibleArea {
  top: number;
  height: number;
  /** The on-screen keyboard (or anything else) is taking a big bite out of it. */
  keyboardOpen: boolean;
}

// On phones the on-screen keyboard covers the page without shrinking it
// (100dvh stays full height on iOS), and iOS pans the view down to the focused
// box instead of scrolling the page. A full-height chat sized with CSS alone
// ends up with its message box under the keyboard. Pin it to this area instead
// and it stays just above the keyboard. Null before it's known.
export function useVisibleArea(): VisibleArea | null {
  const [area, setArea] = useState<VisibleArea | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    // The tallest it's been is the screen without a keyboard. Rotating the
    // phone resets it, since the old tallest no longer applies.
    let tallest = vv.height;
    let wide = vv.width;
    const update = () => {
      if (vv.width !== wide) {
        wide = vv.width;
        tallest = vv.height;
      }
      tallest = Math.max(tallest, vv.height);
      setArea({ top: vv.offsetTop, height: vv.height, keyboardOpen: vv.height < tallest - 120 });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return area;
}
