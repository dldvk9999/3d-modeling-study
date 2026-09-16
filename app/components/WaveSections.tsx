"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Two full-screen sections pinned on top of each other. Scrolling doesn't move
// them — it pulls the second one over the first along a wavy edge that ripples
// as it travels, while the incoming section pushes forward from slightly back.
const SAMPLES = 48;
const WAVE_AMPLITUDE = 7; // % of viewport height at the peak of the reveal
const ZOOM_FROM = 0.92;

function wavePath(progress: number, time: number) {
  // the ripple is strongest mid-reveal and settles flat at either end
  const swell = Math.sin(Math.PI * progress) ** 0.7;
  const amp = WAVE_AMPLITUDE * swell;
  const edge = (1 - progress) * 100;

  const points: string[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const x = (i / SAMPLES) * 100;
    const phase = (x / 100) * Math.PI * 2;
    const wave =
      Math.sin(phase * 1.15 + time * 0.9) * 0.62 +
      Math.sin(phase * 2.3 - time * 1.35) * 0.27 +
      Math.sin(phase * 4.1 + time * 0.55) * 0.11;
    points.push(`${x.toFixed(2)}% ${(edge + wave * amp).toFixed(2)}%`);
  }
  points.push("100% 100%", "0% 100%");
  return `polygon(${points.join(", ")})`;
}

export default function WaveSections({
  first,
  second,
}: {
  first: ReactNode;
  second: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const reveal = revealRef.current;
    const inner = innerRef.current;
    if (!wrap || !reveal || !inner) return;

    let raf = 0;
    const startedAt = performance.now();

    const frame = () => {
      const rect = wrap.getBoundingClientRect();
      const travel = Math.max(1, rect.height - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / travel));
      const time = (performance.now() - startedAt) / 1000;

      reveal.style.clipPath = wavePath(progress, time);
      reveal.style.visibility = progress <= 0.001 ? "hidden" : "visible";
      inner.style.transform = `scale(${ZOOM_FROM + (1 - ZOOM_FROM) * progress})`;

      raf = requestAnimationFrame(frame);
    };
    frame();

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={wrapRef} className="relative h-[200svh]">
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
        <div className="absolute inset-0">{first}</div>
        <div
          ref={revealRef}
          className="absolute inset-0 z-20 will-change-[clip-path]"
          style={{ visibility: "hidden" }}
        >
          <div ref={innerRef} className="h-full w-full origin-center will-change-transform">
            {second}
          </div>
        </div>
      </div>
    </div>
  );
}
