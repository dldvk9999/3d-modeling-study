"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Two full-screen sections pinned on top of each other. Scrolling doesn't move
// them — it cuts the second one in over the first the way the original's
// renderer does: one clean edge sweeping up the screen, curved into a wave
// and leaning further into it the faster you scroll. There is no crossfade
// anywhere in it; either side of the edge is one section only, which is why
// it doesn't wash the two together or leak the old one into the corners.
// The numbers are the original's own: the bend reaches 44px at full speed and
// the curve trebles that at its crown, the speed driving it is scroll pixels
// per millisecond scaled by 0.32 and clamped to one, and it follows that
// speed at 14 per second.
const SAMPLES = 40;
const BEND_PX = 44;
const BEND_GAIN = 0.32;
const BEND_LERP = 14;

// how far the cut bows out of line across the width, in units of the bend:
// a crown in the middle, pinned at both edges. The second term is detuned
// off π so the arch leans very slightly, as the original's does.
function arch(x: number) {
  return Math.sin(x * Math.PI) + Math.sin(x * 3.1431853) * 2;
}

// One scroll-speed reading per animation frame, shared by every hand-off on
// the page so they all bend by the same amount at the same moment.
let bendAmount = 0;
let lastFrame = 0;
let lastFrameTime = 0;
let lastSampleTime = 0;
let lastScroll = 0;

function scrollBend(frameTime: number) {
  if (frameTime === lastFrame) return bendAmount * BEND_PX;
  lastFrame = frameTime;
  const now = performance.now();
  const scroll = window.scrollY;
  if (lastFrameTime === 0) {
    lastFrameTime = now;
    lastSampleTime = now;
    lastScroll = scroll;
    return 0;
  }
  const dt = Math.min((now - lastFrameTime) / 1000, 1 / 30);
  lastFrameTime = now;
  const moved = scroll - lastScroll;
  // a long frame shouldn't read as a fast scroll, nor a very short one as a
  // standstill, so the window the speed is measured over is clamped
  const span = Math.min(80, Math.max(8, now - lastSampleTime));
  lastSampleTime = now;
  lastScroll = scroll;
  const speed =
    Math.abs(moved) < 0.01
      ? 0
      : Math.min(1, Math.max(-1, (moved / span) * BEND_GAIN));
  bendAmount += (speed - bendAmount) * (1 - Math.exp(-dt * BEND_LERP));
  return bendAmount * BEND_PX;
}

// The front is not quite level: across the original's frames it sits a
// little higher on the right than the left, by about an eighth of a screen
// over the width of one, so the new section arrives out of the bottom right
// corner. The arch above rides on top of that lean.
const SLOPE = 0.14;

// the cut as a clip for the arriving section: everything below the curve.
// The curve runs past both sides of the viewport so the edge stays an edge
// all the way into the corners.
function cutPath(
  progress: number,
  bend: number,
  width: number,
  height: number,
) {
  // far enough below the screen at 0, and past the top at 1, that the whole
  // of the leaning line clears both ends
  const base = -SLOPE / 2 + (1 + SLOPE) * progress;
  const parts: string[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = (i / SAMPLES) * 1.4 - 0.2;
    const front = base + SLOPE * (t - 0.5);
    const y = (1 - front) * height - arch(Math.min(1, Math.max(0, t))) * bend;
    parts.push(`${(t * width).toFixed(1)}px ${y.toFixed(1)}px`);
  }
  const bottom = (height * 2).toFixed(1);
  parts.push(`${(width * 1.2).toFixed(1)}px ${bottom}px`);
  parts.push(`${(-0.2 * width).toFixed(1)}px ${bottom}px`);
  return `polygon(${parts.join(",")})`;
}

export default function WaveSections({
  first,
  second,
  /** how much scrolling the reveal takes, in svh. The rest holds it pinned. */
  travel = 100,
  hold = 0,
  /** pull the block up over what precedes it, so that content is still on
   *  screen behind the cut while the new section arrives (svh) */
  overlap = 0,
}: {
  first?: ReactNode;
  second: ReactNode;
  travel?: number;
  hold?: number;
  overlap?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const reveal = revealRef.current;
    if (!wrap || !reveal) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let raf = 0;

    // a page of chapters means a loop each; only the one you're near matters
    let near = true;
    const nearby = new IntersectionObserver(
      (entries) => {
        near = entries[0]?.isIntersecting ?? true;
      },
      { rootMargin: "50% 0px" },
    );
    nearby.observe(wrap);

    const clip = (value: string) => {
      reveal.style.clipPath = value;
      reveal.style.setProperty("-webkit-clip-path", value);
    };

    const frame = (frameTime: number) => {
      raf = requestAnimationFrame(frame);
      if (!near) return;

      const rect = wrap.getBoundingClientRect();
      const scrolled = Math.max(1, rect.height - window.innerHeight);
      // the cut finishes within `travel`, then the section simply holds
      const revealSpan = Math.max(1, scrolled * (travel / (travel + hold)));
      const progress = Math.min(1, Math.max(0, -rect.top / revealSpan));

      reveal.style.visibility = progress <= 0.001 ? "hidden" : "visible";
      if (progress >= 0.999) {
        clip("none");
        return;
      }
      const width = reveal.clientWidth || window.innerWidth;
      const height = reveal.clientHeight || window.innerHeight;
      const bend = reducedMotion ? 0 : scrollBend(frameTime);
      clip(cutPath(progress, bend, width, height));
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      nearby.disconnect();
    };
  }, [travel, hold]);

  return (
    <div
      ref={wrapRef}
      className="relative"
      style={{
        height: `${100 + travel + hold}svh`,
        marginTop: overlap ? `-${overlap}svh` : undefined,
      }}
    >
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
        {first ? <div className="absolute inset-0">{first}</div> : null}

        <div
          ref={revealRef}
          className="absolute inset-0 z-20"
          style={{ visibility: "hidden" }}
        >
          <div className="h-full w-full">{second}</div>
        </div>
      </div>
    </div>
  );
}
