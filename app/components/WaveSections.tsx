"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Two full-screen sections pinned on top of each other. Scrolling doesn't move
// them — it pulls the second one over the first along a rippling edge. The edge
// isn't a clean cut: a band of glass rides it, refracting and smearing whatever
// is behind, so the two sections melt into each other instead of snapping.
const SAMPLES = 64;
const WAVE_AMPLITUDE = 7; // % of viewport height at the peak of the reveal
const ZOOM_FROM = 0.92;

function waveAt(x: number, time: number) {
  const phase = (x / 100) * Math.PI * 2;
  return (
    Math.sin(phase * 1.15 + time * 0.9) * 0.62 +
    Math.sin(phase * 2.3 - time * 1.35) * 0.27 +
    Math.sin(phase * 4.1 + time * 0.55) * 0.11 +
    Math.sin(phase * 0.7 - time * 0.4) * 0.22
  );
}

function edgeAt(progress: number, time: number, x: number) {
  const swell = Math.sin(Math.PI * progress) ** 0.7;
  return (1 - progress) * 100 + waveAt(x, time) * WAVE_AMPLITUDE * swell;
}

function revealPath(progress: number, time: number) {
  const points: string[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const x = (i / SAMPLES) * 100;
    points.push(`${x.toFixed(2)}% ${edgeAt(progress, time, x).toFixed(2)}%`);
  }
  points.push("100% 100%", "0% 100%");
  return `polygon(${points.join(", ")})`;
}

// a strip that hugs the wave, used as the glass
function bandPath(progress: number, time: number, above: number, below: number) {
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const x = (i / SAMPLES) * 100;
    const y = edgeAt(progress, time, x);
    top.push(`${x.toFixed(2)}% ${(y - above).toFixed(2)}%`);
    bottom.push(`${x.toFixed(2)}% ${(y + below).toFixed(2)}%`);
  }
  bottom.reverse();
  return `polygon(${[...top, ...bottom].join(", ")})`;
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
  const glassWideRef = useRef<HTMLDivElement>(null);
  const glassCoreRef = useRef<HTMLDivElement>(null);
  const turbulenceRef = useRef<SVGFETurbulenceElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const reveal = revealRef.current;
    const inner = innerRef.current;
    const glassWide = glassWideRef.current;
    const glassCore = glassCoreRef.current;
    if (!wrap || !reveal || !inner || !glassWide || !glassCore) return;

    let raf = 0;
    const startedAt = performance.now();

    const frame = () => {
      const rect = wrap.getBoundingClientRect();
      const travel = Math.max(1, rect.height - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / travel));
      const time = (performance.now() - startedAt) / 1000;

      reveal.style.clipPath = revealPath(progress, time);
      reveal.style.visibility = progress <= 0.001 ? "hidden" : "visible";
      inner.style.transform = `scale(${ZOOM_FROM + (1 - ZOOM_FROM) * progress})`;

      // the glass only exists while the two sections are meeting
      const presence = Math.sin(Math.PI * Math.min(1, Math.max(0, progress))) ** 0.5;
      glassWide.style.clipPath = bandPath(progress, time, 13, 9);
      glassCore.style.clipPath = bandPath(progress, time, 4.5, 3);
      glassWide.style.opacity = String(presence);
      glassCore.style.opacity = String(presence);
      // backdrop-filter still costs while invisible, so take it out of the way
      const glassVisibility = presence < 0.01 ? "hidden" : "visible";
      glassWide.style.visibility = glassVisibility;
      glassCore.style.visibility = glassVisibility;

      // drift the refraction so the glass looks like moving liquid
      const turbulence = turbulenceRef.current;
      if (turbulence) {
        const bx = 0.009 + Math.sin(time * 0.35) * 0.003;
        const by = 0.022 + Math.cos(time * 0.27) * 0.006;
        turbulence.setAttribute("baseFrequency", `${bx.toFixed(5)} ${by.toFixed(5)}`);
      }

      raf = requestAnimationFrame(frame);
    };
    frame();

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={wrapRef} className="relative h-[200svh]">
      <svg aria-hidden className="pointer-events-none absolute h-0 w-0">
        <filter id="wave-glass" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            ref={turbulenceRef}
            type="fractalNoise"
            baseFrequency="0.009 0.022"
            numOctaves={2}
            seed={7}
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={26}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>

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

        {/* thick, soft glass: the sections blur and bend through it */}
        <div
          ref={glassWideRef}
          className="pointer-events-none absolute inset-0 z-30 will-change-[clip-path]"
          style={{
            opacity: 0,
            backdropFilter: "blur(14px) saturate(115%) url(#wave-glass)",
            WebkitBackdropFilter: "blur(14px) saturate(115%)",
            background:
              "linear-gradient(to bottom, rgba(255,255,255,0.06), rgba(255,255,255,0.01) 55%, rgba(255,255,255,0.05))",
          }}
        />

        {/* the bright rim right on the edge, like the lip of a glass */}
        <div
          ref={glassCoreRef}
          className="pointer-events-none absolute inset-0 z-40 will-change-[clip-path]"
          style={{
            opacity: 0,
            backdropFilter: "blur(3px) brightness(1.12) url(#wave-glass)",
            WebkitBackdropFilter: "blur(3px) brightness(1.12)",
            background:
              "linear-gradient(to bottom, rgba(255,255,255,0.20), rgba(255,255,255,0.05) 45%, rgba(255,255,255,0.16))",
          }}
        />
      </div>
    </div>
  );
}
