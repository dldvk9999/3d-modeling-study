"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

// Two full-screen sections pinned on top of each other. Scrolling doesn't move
// them — it sweeps the second one in over the first the way the original's
// renderer does: one edge travelling up the screen, curved into a wave and
// leaning further into it the faster you scroll, soft enough across the
// boundary to read as a front rather than a cut-out. Measured off the
// original's frames the two sections blend over about 5% of the screen; the
// rest of the viewport is one section or the other, which is what keeps this
// from looking like a crossfade.
// The numbers behind the bend are the original's own: it reaches 44px at full
// speed and the curve trebles that at its crown, the speed driving it is
// scroll pixels per millisecond scaled by 0.32 and clamped to one, and it
// follows that speed at 14 per second.
const SAMPLES = 40;
const BEND_PX = 44;
const BEND_GAIN = 0.32;
const BEND_LERP = 14;
// how far either side of the edge the sections mix, as a share of the screen.
// A blur's 10-90 band comes out around two and a half times this.
const FEATHER = 0.02;

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
// enough overshoot at each end that the softened edge is wholly off screen
// before the sweep is called finished
const CLEARANCE = 0.1;

// the front as a path covering everything below it. It runs well past both
// sides of the viewport and far below it, so that blurring it can never pull
// emptiness in from outside and thin the edge out near a corner.
function frontPath(
  progress: number,
  bend: number,
  width: number,
  height: number,
) {
  const base =
    -(SLOPE / 2 + CLEARANCE) + (1 + SLOPE + 2 * CLEARANCE) * progress;
  const parts: string[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = (i / SAMPLES) * 1.12 - 0.06;
    const front = base + SLOPE * (t - 0.5);
    const y = (1 - front) * height - arch(Math.min(1, Math.max(0, t))) * bend;
    parts.push(
      `${i === 0 ? "M" : "L"}${(t * width).toFixed(1)},${y.toFixed(1)}`,
    );
  }
  // only as far down as the front can ever sit, so the blur has as little
  // area to chew through as possible
  const bottom = (height * 1.6).toFixed(1);
  parts.push(`L${(width * 1.06).toFixed(1)},${bottom}`);
  parts.push(`L${(-0.06 * width).toFixed(1)},${bottom}`);
  parts.push("Z");
  return parts.join(" ");
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
  const pathRef = useRef<SVGPathElement>(null);
  const blurRef = useRef<SVGFEGaussianBlurElement>(null);
  // each instance needs its own mask, or they'd all share one id
  const uid = useId().replace(/:/g, "");
  const maskId = `wave-mask-${uid}`;
  const blurId = `wave-blur-${uid}`;

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

    const wearMask = (on: boolean) => {
      const value = on ? `url(#${maskId})` : "none";
      reveal.style.mask = value;
      reveal.style.setProperty("-webkit-mask", value);
    };

    const frame = (frameTime: number) => {
      raf = requestAnimationFrame(frame);
      if (!near) return;

      const rect = wrap.getBoundingClientRect();
      const scrolled = Math.max(1, rect.height - window.innerHeight);
      // the sweep finishes within `travel`, then the section simply holds
      const revealSpan = Math.max(1, scrolled * (travel / (travel + hold)));
      const progress = Math.min(1, Math.max(0, -rect.top / revealSpan));

      reveal.style.visibility = progress <= 0.001 ? "hidden" : "visible";
      if (progress >= 0.999) {
        wearMask(false);
        return;
      }
      const width = reveal.clientWidth || window.innerWidth;
      const height = reveal.clientHeight || window.innerHeight;
      const bend = reducedMotion ? 0 : scrollBend(frameTime);
      pathRef.current?.setAttribute(
        "d",
        frontPath(progress, bend, width, height),
      );
      // only across the edge, never along it: a blur that spread sideways
      // would pull nothing in past the left and right of the screen and
      // leave the old section showing down both edges
      blurRef.current?.setAttribute(
        "stdDeviation",
        `0 ${(height * FEATHER).toFixed(1)}`,
      );
      wearMask(true);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      nearby.disconnect();
    };
  }, [travel, hold, maskId]);

  return (
    <div
      ref={wrapRef}
      className="relative"
      style={{
        height: `${100 + travel + hold}svh`,
        marginTop: overlap ? `-${overlap}svh` : undefined,
      }}
    >
      <svg aria-hidden className="pointer-events-none absolute h-0 w-0">
        <filter
          id={blurId}
          x="-10%"
          y="-30%"
          width="120%"
          height="160%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur ref={blurRef} stdDeviation="0 16" />
        </filter>
        <mask
          id={maskId}
          maskContentUnits="userSpaceOnUse"
          style={{ maskType: "alpha" }}
        >
          <path ref={pathRef} d="" fill="#fff" filter={`url(#${blurId})`} />
        </mask>
      </svg>

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
