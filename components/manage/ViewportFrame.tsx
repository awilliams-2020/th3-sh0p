"use client";
import { useEffect, useRef } from "react";

// Anchors the /manage screen to the VISUAL viewport so the input sits right above the
// mobile keyboard with no extra gap. `fixed inset-0` sizes to the large viewport, which
// does NOT shrink when the keyboard opens — so we track window.visualViewport and size /
// offset the frame to the visible region instead.
export default function ViewportFrame({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    const el = ref.current;
    if (!vv || !el) return;
    const apply = () => {
      el.style.height = `${vv.height}px`;
      el.style.transform = `translateY(${vv.offsetTop}px)`; // iOS shifts the visual viewport
    };
    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
    };
  }, []);

  return (
    <div
      ref={ref}
      style={{ height: "100dvh" }} // fallback before JS / without visualViewport
      className="fixed inset-x-0 top-0 z-40 mx-auto flex max-w-3xl flex-col bg-ink-900 px-4 pt-4 pb-[max(0.875rem,env(safe-area-inset-bottom))]"
    >
      {children}
    </div>
  );
}
