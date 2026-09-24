"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

// Two full-screen sections pinned on top of each other. Scrolling doesn't move
// them — it dissolves the second one over the first the way the original does
// it: a level edge travelling up the screen, feathered so wide that the two
// sections overlap across most of the viewport, and pushed around by a
// drifting fractal noise so the boundary reads as a slow swell rather than a
// line. The original's own settings for this hand-off are a feather of 0.6
// and a noise amount of 0.34, in units where the viewport spans -1 to 1.
const SAMPLES = 96;
const FEATHER = 0.6;
const NOISE_AMOUNT = 0.34;
const NOISE_SCALE_X = 3.5;
const NOISE_SCALE_Y = 5.5;

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function valueNoise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let fx = x - ix;
  let fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  const lowerRow = a + (b - a) * fx;
  const upperRow = c + (d - c) * fx;
  return lowerRow + (upperRow - lowerRow) * fy;
}

function fbm(x: number, y: number) {
  let value = 0;
  let amplitude = 0.5;
  let px = x;
  let py = y;
  for (let i = 0; i < 4; i++) {
    value += valueNoise(px, py) * amplitude;
    px = px * 2.03 + 17.13;
    py = py * 2.03 + 17.13;
    amplitude *= 0.5;
  }
  return value;
}

// where the boundary sits in one column, as a share of the viewport measured
// down from the top. The noise depends on height as well, so the solve takes
// a couple of passes to settle.
function edgeAt(progress: number, x: number) {
  const travel = 1 + FEATHER + NOISE_AMOUNT;
  let upY = 1 - progress;
  for (let i = 0; i < 3; i++) {
    const noise =
      (fbm(
        x * NOISE_SCALE_X + progress * 1.7,
        upY * NOISE_SCALE_Y + progress * 1.7,
      ) -
        0.5) *
      NOISE_AMOUNT;
    // the edge runs from below the screen to above it as the reveal completes
    const edge = travel * (1 - 2 * progress) + noise;
    const solved = (1 - edge) / 2;
    upY = upY * 0.4 + solved * 0.6;
  }
  return (1 - upY) * 100;
}

// the boundary as a path in pixels, for the mask that blurs it
function wavePath(progress: number, width: number, height: number) {
  const parts: string[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const x = (i / SAMPLES) * width;
    const y = (edgeAt(progress, i / SAMPLES) / 100) * height;
    parts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  parts.push(`L${width.toFixed(1)},${(height * 2.5).toFixed(1)}`);
  parts.push(`L0,${(height * 2.5).toFixed(1)}`);
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
   *  screen behind the dissolve while the new section washes in (svh) */
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
  const maskPathRef = useRef<SVGPathElement>(null);
  const maskBlurRef = useRef<SVGFEGaussianBlurElement>(null);
  // each instance needs its own mask, or they'd all share one id
  const uid = useId().replace(/:/g, "");
  const maskId = `wave-mask-${uid}`;
  const maskBlurId = `wave-mask-blur-${uid}`;

  useEffect(() => {
    const wrap = wrapRef.current;
    const reveal = revealRef.current;
    if (!wrap || !reveal) return;

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

    const frame = () => {
      if (!near) {
        raf = requestAnimationFrame(frame);
        return;
      }
      const rect = wrap.getBoundingClientRect();
      const scrolled = Math.max(1, rect.height - window.innerHeight);
      // the reveal finishes within `travel`, then the section simply holds
      const revealSpan = Math.max(1, scrolled * (travel / (travel + hold)));
      const progress = Math.min(1, Math.max(0, -rect.top / revealSpan));

      const width = wrap.clientWidth || window.innerWidth;
      const height = window.innerHeight;
      const maskPath = maskPathRef.current;
      if (maskPath) {
        maskPath.setAttribute("d", wavePath(progress, width, height));
      }
      // the original feathers over more than half the viewport; a blur of
      // about a seventh of the height lands in the same place
      const blur = maskBlurRef.current;
      if (blur) {
        blur.setAttribute("stdDeviation", (height * FEATHER * 0.3).toFixed(1));
      }
      reveal.style.visibility = progress <= 0.001 ? "hidden" : "visible";

      raf = requestAnimationFrame(frame);
    };
    frame();

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
      <svg aria-hidden className="pointer-events-none absolute h-0 w-0">
        <filter
          id={maskBlurId}
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur ref={maskBlurRef} stdDeviation="120" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="1.7" intercept="-0.35" />
          </feComponentTransfer>
        </filter>
        <mask
          id={maskId}
          maskContentUnits="userSpaceOnUse"
          style={{ maskType: "alpha" }}
        >
          <path
            ref={maskPathRef}
            d=""
            fill="#fff"
            filter={`url(#${maskBlurId})`}
          />
        </mask>
      </svg>

      <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
        {first ? <div className="absolute inset-0">{first}</div> : null}

        <div
          ref={revealRef}
          className="absolute inset-0 z-20"
          style={{
            visibility: "hidden",
            mask: `url(#${maskId})`,
            WebkitMask: `url(#${maskId})`,
          }}
        >
          <div className="h-full w-full">{second}</div>
        </div>
      </div>
    </div>
  );
}
