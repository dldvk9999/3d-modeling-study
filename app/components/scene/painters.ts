// Every chapter of the original raymarches one or two short clips stacked
// into 3D textures (see lightVolume.ts). The clips are Shopify's footage, so
// each one is stood in for by a shader that paints the same subject, frame by
// frame, into the texture: a voice waveform, a ring of coins, a glass store.
// Each was drawn against the original clip's frames and its time-average,
// since the camera mostly looks down the clip's time axis.
//
// A painter is `vec3 paint(vec2 uv, float phase, float aspect)`: uv is the
// frame, phase runs 0..1 around a closed loop (the texture wraps in depth, so
// the last frame must lead back into the first), aspect is width / height.

export type PainterId =
  | "prism" // rainbow sheets of light out of a white hot spot (Agentic)
  | "stripes" // a diamond of pulsing pastel voice bars (Sidekick voice)
  | "pills" // a glowing Sidekick UI pill on a dim panel (Sidekick artifacts)
  | "coins" // a ring of pale pastel coins turning (Online)
  | "phone" // a phone screen with a photo card sliding up (Online foreground)
  | "storefront" // a glass pavilion at dusk (Retail)
  | "rays" // rainbow light pouring out of a white-hot centre (Retail foreground)
  | "collage" // product and lifestyle photos coming and going (Marketing)
  | "globe" // the Earth, turning (Operations)
  | "swirl" // the Shop swirl, winding in (Shop app)
  | "cards" // teal payment cards stacking up (Payments)
  | "vortex" // an iridescent ring with light streaming off it (Payments foreground)
  | "bars" // a stepped pyramid of glowing blocks (Finance)
  | "screens" // a grid of dark site screenshots and code (Developer)
  | "tiles"; // a grid of photos switching shots (Developer foreground)

export const PAINTER_PRELUDE = `
  precision highp float;
  varying vec2 vUv;
  uniform float uPhase;
  uniform float uAspect;
  const float TAU = 6.2831853;

  float hash1(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  float hash2(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float hash3(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x),
          mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x),
          mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y),
      f.z
    );
  }

  float fbm3(vec3 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      sum += noise3(p) * amp;
      p *= 2.03;
      amp *= 0.5;
    }
    return sum;
  }

  float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  vec2 loopVec(float phase) {
    return vec2(cos(phase * TAU), sin(phase * TAU));
  }

  float fill(float d) {
    return smoothstep(0.004, -0.004, d);
  }
`;

const PRISM_CORE = `
  float prismRidges(float angle, float r, vec3 drift, float freq, float sharp) {
    vec3 q = vec3(cos(angle) * freq, sin(angle) * freq, r * 1.15) + drift;
    float n = noise3(q) * 0.62 + noise3(q * 2.07 + 7.3) * 0.38;
    return pow(1.0 - abs(n * 2.0 - 1.0), sharp);
  }

  vec3 prismLight(vec2 uv, float phase01, float aspect) {
    float phase = phase01 * TAU;
    vec2 loop = vec2(cos(phase), sin(phase));
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
    vec2 core = vec2(0.14 + 0.06 * sin(phase), 0.05 + 0.04 * cos(phase + 1.3));
    vec2 d = p - core;
    float r = length(d);
    float theta = atan(d.y, d.x);
    float sweep = (0.7 + 0.35 * sin(theta + phase)) * r;
    vec3 drift = vec3(loop * 0.35, 0.0);

    vec3 sheets = vec3(0.0);
    for (int c = 0; c < 3; c++) {
      float spread = (float(c) - 1.0) * (0.035 + 0.09 * r);
      float a = theta + sweep + spread;
      float broad = prismRidges(a, r * 0.6, drift, 1.5, 3.0);
      float detail = prismRidges(a, r * 0.8, drift * 1.3 + 4.0, 3.2, 7.0);
      float strands = prismRidges(a, r * 1.4, drift * 2.1 + 9.0, 7.5, 12.0);
      sheets[c] = broad * 0.6 + detail * 0.35 + strands * 0.35;
    }

    float sectorAngle = theta + sweep * 0.4;
    float lobes = smoothstep(0.42, 0.8,
      noise3(vec3(cos(sectorAngle) * 1.1, sin(sectorAngle) * 1.1, 2.0) + vec3(loop * 0.25, 0.0)));
    float reach = 0.22 + 1.2 * exp(-r * 1.6);
    vec3 col = sheets * lobes * reach;

    float glintAngle = theta + sweep;
    float glints = pow(noise3(vec3(cos(glintAngle) * 16.0, sin(glintAngle) * 16.0, r * 10.0) + drift * 3.0), 9.0);
    col += glints * dot(sheets, vec3(0.3333)) * lobes * 2.2;

    col = mix(vec3(dot(col, vec3(0.3333))), col, 0.7) * 1.15;
    vec3 tint = 0.72 + 0.28 * cos(TAU * (vec3(0.0, 0.22, 0.5) + cos(theta) * 0.25 + r * 0.6 + phase01 * 0.2));
    col *= mix(vec3(1.0), tint, 0.6);
    col += vec3(1.0, 0.97, 0.93) * (exp(-r * r * 260.0) * 0.6 + exp(-r * 8.0) * 0.1);
    return clamp(col, 0.0, 1.0);
  }
`;

const BODIES: Record<PainterId, string> = {
  // Agentic keeps the colour push it was tuned with, baked in HSL space
  prism: `
    ${PRISM_CORE}
    vec3 rgb2hsl(vec3 c) {
      float maxC = max(c.r, max(c.g, c.b));
      float minC = min(c.r, min(c.g, c.b));
      float l = (maxC + minC) * 0.5;
      float d = maxC - minC;
      if (d < 1e-5) return vec3(0.0, 0.0, l);
      float s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
      float h = maxC == c.r ? (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0)
              : maxC == c.g ? (c.b - c.r) / d + 2.0
              : (c.r - c.g) / d + 4.0;
      return vec3(h / 6.0, s, l);
    }
    float hue2rgb(float p, float q, float t) {
      t = fract(t);
      if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
      if (t < 0.5) return q;
      if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
      return p;
    }
    vec3 hsl2rgb(vec3 hsl) {
      if (hsl.y < 1e-5) return vec3(hsl.z);
      float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
      float p = 2.0 * hsl.z - q;
      return vec3(hue2rgb(p, q, hsl.x + 1.0 / 3.0), hue2rgb(p, q, hsl.x), hue2rgb(p, q, hsl.x - 1.0 / 3.0));
    }
    vec3 paint(vec2 uv, float phase, float aspect) {
      vec3 hsl = rgb2hsl(prismLight(uv, phase, aspect));
      hsl.x += 0.0215;
      hsl.y = clamp(hsl.y + 0.1, 0.0, 1.0);
      return hsl2rgb(hsl);
    }
  `,

  // Sidekick's voice: a diamond of rounded pastel bars pulsing like a
  // waveform, over near-black with glittering dust low on the left
  stripes: `
    vec3 paint(vec2 uv, float phase, float aspect) {
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      vec3 col = vec3(0.02, 0.02, 0.035) + vec3(0.05, 0.045, 0.08) * exp(-dot(p, p) * 3.0);
      float floorLine = -0.17;
      float reflected = step(p.y, floorLine);
      p.y = mix(p.y, 2.0 * floorLine - p.y, reflected);
      vec2 cell = floor(uv * vec2(aspect, 1.0) * 110.0);
      float dust = step(0.975, hash2(cell + floor(phase * 10.0) * 7.0))
        * smoothstep(0.6, 0.15, uv.y) * smoothstep(0.75, 0.25, uv.x);
      col += vec3(0.85, 0.75, 1.0) * dust * 1.3;

      float spacing = 0.07;
      float index = floor(p.x / spacing + 0.5);
      if (abs(index) <= 6.0) {
        float x = p.x - index * spacing;
        float envelope = 1.0 - abs(index) / 7.2;
        float pulse = 0.6 + 0.4 * sin(TAU * (phase * 2.0 + hash1(index * 3.7 + 1.0)));
        float halfHeight = 0.42 * envelope * pulse + 0.02;
        vec2 q = vec2(x, max(abs(p.y) - halfHeight, 0.0));
        float d = length(q) - 0.034;
        float bar = smoothstep(0.004, -0.004, d);
        float glow = exp(-max(d, 0.0) * 30.0) * 0.35;
        // each bar runs between two pastels, bottom to top
        float pick = hash1(index * 1.7 + 4.0);
        vec3 lilac = vec3(0.7, 0.46, 1.0);
        vec3 pink = vec3(1.0, 0.55, 0.8);
        vec3 cream = vec3(1.0, 0.78, 0.6);
        vec3 sky = vec3(0.55, 0.72, 1.0);
        vec3 top = pick < 0.3 ? pink : pick < 0.6 ? lilac : pick < 0.8 ? cream : sky;
        vec3 bottom = pick < 0.3 ? cream : pick < 0.6 ? pink : pick < 0.8 ? sky : lilac;
        float t = clamp(p.y / max(halfHeight, 0.001) * 0.5 + 0.5, 0.0, 1.0);
        vec3 tone = mix(bottom, top, t) * mix(1.0, 0.6, reflected);
        col = mix(col, tone, bar) + tone * glow * (1.0 - bar);
      }
      return col;
    }
  `,

  // one Sidekick UI pill, glowing purple, resting on a dim grey panel
  pills: `
    vec3 paint(vec2 uv, float phase, float aspect) {
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      vec3 col = vec3(0.022) * step(uv.x, 0.55);
      vec2 loop = loopVec(phase);
      vec2 centre = vec2((0.37 - 0.5) * aspect, 0.0) + vec2(0.012 * loop.x, 0.02 * loop.y);
      float scale = 0.7 + 0.3 * (0.5 + 0.5 * sin(TAU * phase));
      vec2 q = (p - centre) / scale;
      float d = sdRoundBox(q, vec2(0.115, 0.028), 0.028);
      float body = fill(d);
      col = mix(col, vec3(0.07, 0.06, 0.1), body);
      col += vec3(0.5, 0.3, 1.0) * exp(-abs(d) * 190.0) * 0.55;
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        vec2 icon = vec2(-0.09 + fi * 0.075, 0.0);
        col += vec3(0.92) * smoothstep(0.014, 0.009, length(q - icon)) * body;
      }
      return col;
    }
  `,

  // a ring of pale pastel coins, turning once per loop, with a gap in it
  coins: `
    vec3 paint(vec2 uv, float phase, float aspect) {
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      float r = length(p);
      float angle = fract(atan(p.y, p.x) / TAU + 0.5);
      float count = 9.0;
      float turn = fract(angle - phase / count);
      float slot = floor(turn * count);
      float f = fract(turn * count);
      float present = smoothstep(0.02, 0.1, abs(angle - 0.5));
      float ring = smoothstep(0.115, 0.13, r) * smoothstep(0.41, 0.395, r);
      float edges = smoothstep(0.0, 0.07, f) * smoothstep(1.0, 0.93, f);
      vec3 tint = 0.72 + 0.26 * cos(TAU * (vec3(0.0, 0.33, 0.67) + angle + 0.15));
      tint = mix(vec3(1.0), tint, 0.75);
      tint *= 1.05 + 0.2 * (r - 0.12) / 0.29;
      float shade = 0.78 + 0.25 * (1.0 - abs(f - 0.5) * 2.0) + (r - 0.23) * 0.8;
      // an embossed mark on every face
      float mark = smoothstep(0.012, 0.004, abs(length(vec2((f - 0.5) * 0.14, r - 0.23)) - 0.035));
      return tint * shade * (1.0 - 0.2 * mark) * ring * edges * present;
    }
  `,

  // a phone screen with a photo card sliding up through it
  phone: `
    vec3 paint(vec2 uv, float phase, float aspect) {
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      vec3 col = vec3(0.0);
      // a dim panel standing off to the side
      col += vec3(0.1) * step(0.78, uv.x);
      vec2 phoneCentre = vec2(-0.1 + 0.05 * sin(TAU * phase), 0.05);
      float phone = sdRoundBox(p - phoneCentre, vec2(0.22, 0.46), 0.06);
      float onScreen = fill(phone);
      col = mix(col, mix(vec3(0.93, 0.95, 1.0), vec3(0.75, 0.84, 1.0), uv.y), onScreen);
      vec2 cardCentre = phoneCentre + vec2(0.02, (fract(phase) - 0.5) * 1.4);
      float card = fill(sdRoundBox(p - cardCentre, vec2(0.16, 0.14), 0.01)) * onScreen;
      vec3 photo = mix(vec3(0.12, 0.2, 0.55), vec3(0.95, 0.5, 0.15),
        smoothstep(0.05, -0.05, abs(p.x - cardCentre.x) - 0.04));
      col = mix(col, photo, card);
      float bubble = fill(sdRoundBox(p - phoneCentre - vec2(0.0, -0.33), vec2(0.18, 0.05), 0.04));
      col = mix(col, vec3(0.98), bubble * 0.9);
      return col;
    }
  `,

  // a glass pavilion under a flat roof, warm goods behind the glass, a
  // white bench out front, a tree to one side, peach evening sky
  storefront: `
    vec3 paint(vec2 uv, float phase, float aspect) {
      vec2 loop = loopVec(phase);
      vec2 q = uv + vec2(0.015 * loop.x, 0.008 * loop.y);
      vec3 col = mix(vec3(0.74, 0.65, 0.58), vec3(0.64, 0.6, 0.66), smoothstep(0.5, 1.0, q.y));
      // lavender paving
      col = mix(col, mix(vec3(0.46, 0.43, 0.52), vec3(0.62, 0.58, 0.66), q.y / 0.32), step(q.y, 0.32));

      float glass = step(0.06, q.x) * step(q.x, 0.86) * step(0.32, q.y) * step(q.y, 0.72);
      vec3 goods = mix(vec3(0.8, 0.62, 0.48), vec3(0.47, 0.6, 0.55), smoothstep(0.45, 0.7, fbm3(vec3(q * 7.0, 1.0))));
      goods = mix(goods, vec3(0.98, 0.7, 0.76), smoothstep(0.64, 0.8, fbm3(vec3(q * 9.0 + 3.0, 2.0))) * 0.6);
      // a big orange drape across the middle
      float drape = smoothstep(0.05, 0.0, abs(q.y - 0.56 - 0.05 * sin(q.x * 14.0)) - 0.03);
      goods = mix(goods, vec3(1.0, 0.52, 0.26), drape * step(0.25, q.x) * step(q.x, 0.62));
      goods *= 0.8 + 0.25 * smoothstep(0.32, 0.72, q.y);
      float mullion = smoothstep(0.46, 0.49, abs(fract((q.x - 0.06) / 0.16) - 0.5));
      goods = mix(goods, vec3(0.35, 0.33, 0.3), mullion);
      col = mix(col, goods, glass);

      // roof slab: a cream fascia over a teal-grey underside
      float roof = step(0.03, q.x) * step(q.x, 0.9);
      col = mix(col, vec3(0.42, 0.5, 0.48), roof * step(0.72, q.y) * step(q.y, 0.76));
      col = mix(col, vec3(0.96, 0.9, 0.78), roof * step(0.76, q.y) * step(q.y, 0.8));

      // the bench
      float bench = step(0.52, q.x) * step(q.x, 0.78) * step(0.1, q.y) * step(q.y, 0.24);
      float slats = step(0.5, fract(q.y * 40.0));
      col = mix(col, vec3(0.95, 0.93, 0.88) * (0.85 + 0.15 * slats), bench);

      // the tree
      float canopy = length((q - vec2(0.93, 0.78)) * vec2(1.0, 1.2)) - 0.14 + 0.05 * fbm3(vec3(q * 12.0, 3.0));
      col = mix(col, vec3(0.3, 0.42, 0.28), smoothstep(0.01, -0.01, canopy));
      col = mix(col, vec3(0.3, 0.24, 0.2), step(abs(q.x - 0.92), 0.01) * step(0.3, q.y) * step(q.y, 0.7));
      // pink flowers along the left
      col = mix(col, vec3(0.95, 0.6, 0.72), smoothstep(0.62, 0.72, fbm3(vec3(q * 18.0, 5.0))) * step(q.x, 0.12) * step(0.25, q.y) * step(q.y, 0.45));
      return col * 0.78;
    }
  `,

  // rainbow light pouring out of a white-hot centre in every direction
  rays: `
    vec3 paint(vec2 uv, float phase, float aspect) {
      vec2 loop = loopVec(phase);
      vec2 p = (uv - vec2(0.55, 0.5)) * vec2(aspect, 1.0);
      float r = length(p);
      float a = atan(p.y, p.x);
      float swirl = a + r * (0.8 + 0.4 * loop.x);
      vec3 col = vec3(0.0);
      for (int c = 0; c < 3; c++) {
        float spread = (float(c) - 1.0) * (0.05 + 0.12 * r);
        float angle = swirl + spread;
        vec3 q = vec3(cos(angle) * 5.0, sin(angle) * 5.0, r * 1.6) + vec3(loop * 0.5, 0.0);
        col[c] = pow(noise3(q) * 0.7 + noise3(q * 2.1) * 0.3, 4.0);
      }
      col = mix(vec3(dot(col, vec3(0.3333))), col, 0.55);
      col *= exp(-r * 0.8) * 3.6;
      col += vec3(1.0, 0.98, 0.95) * (exp(-r * r * 40.0) * 1.0 + exp(-r * 3.0) * 0.3);
      return clamp(col, 0.0, 1.0);
    }
  `,

  // Marketing's collage: product and lifestyle photos and UI cards laid out
  // on black, coming and going
  collage: `
    vec3 photoTile(vec2 q, float kind, float seed) {
      if (kind < 1.0) {
        // hanging shopping bags: tall stripes of colour with white tags
        float stripe = floor((q.x + 1.0) * 5.0);
        vec3 bag = 0.5 + 0.45 * cos(TAU * (vec3(0.0, 0.3, 0.6) + hash1(stripe + seed) * 0.8));
        bag = mix(bag, vec3(0.95), step(0.7, hash1(stripe * 3.1 + seed)) * step(q.y, 0.2));
        return bag * (0.75 + 0.25 * q.y);
      }
      if (kind < 2.0) {
        // a figure against a blue sky
        vec3 sky = mix(vec3(0.35, 0.6, 0.9), vec3(0.7, 0.85, 1.0), q.y * 0.5 + 0.5);
        float body = smoothstep(0.05, 0.0, length((q - vec2(0.0, -0.1)) * vec2(2.2, 0.8)) - 0.45);
        vec3 look = mix(vec3(0.95, 0.5, 0.2), vec3(0.45, 0.2, 0.3), step(0.1, q.y));
        return mix(sky, look, body);
      }
      if (kind < 3.0) {
        // an evening meadow
        vec3 sky = mix(vec3(0.98, 0.55, 0.35), vec3(0.95, 0.75, 0.6), q.y);
        vec3 field = mix(vec3(0.15, 0.2, 0.1), vec3(0.35, 0.4, 0.2), fbm3(vec3(q * 6.0, seed)));
        return mix(field, sky, step(-0.1 + 0.08 * sin(q.x * 3.0), q.y));
      }
      if (kind < 4.0) {
        // a phone screen with a photo on it
        vec3 screen = vec3(0.9, 0.92, 0.98);
        float pic = step(abs(q.x), 0.7) * step(abs(q.y - 0.15), 0.4);
        vec3 picCol = mix(vec3(0.95, 0.55, 0.3), vec3(0.85, 0.3, 0.4), q.y * 0.5 + 0.5);
        screen = mix(screen, picCol, pic);
        return mix(screen, vec3(0.6), step(0.5, fract(q.x * 8.0)) * step(abs(q.y + 0.7), 0.05));
      }
      // a sheet of white product cards
      vec2 grid = fract((q + 1.0) * vec2(4.0, 1.5));
      vec2 id = floor((q + 1.0) * vec2(4.0, 1.5));
      vec3 cardCol = vec3(0.95);
      float item = smoothstep(0.25, 0.2, length(grid - 0.5));
      vec3 itemCol = 0.4 + 0.4 * cos(TAU * (vec3(0.0, 0.33, 0.67) + hash2(id + seed)));
      cardCol = mix(cardCol, itemCol, item);
      return cardCol * step(0.08, grid.x) * step(0.08, grid.y);
    }

    vec3 paint(vec2 uv, float phase, float aspect) {
      vec3 col = vec3(0.0);
      for (int i = 0; i < 7; i++) {
        float fi = float(i);
        vec2 centre = fi < 0.5 ? vec2(0.75, 0.87)
          : fi < 1.5 ? vec2(0.42, 0.7)
          : fi < 2.5 ? vec2(0.74, 0.47)
          : fi < 3.5 ? vec2(0.56, 0.47)
          : fi < 4.5 ? vec2(0.52, 0.15)
          : fi < 5.5 ? vec2(0.3, 0.22)
          : vec2(0.62, 0.55);
        vec2 halfSize = fi < 0.5 ? vec2(0.17, 0.09)
          : fi < 1.5 ? vec2(0.12, 0.1)
          : fi < 2.5 ? vec2(0.14, 0.11)
          : fi < 3.5 ? vec2(0.09, 0.14)
          : fi < 4.5 ? vec2(0.22, 0.08)
          : fi < 5.5 ? vec2(0.1, 0.1)
          : vec2(0.17, 0.035);
        float kind = fi < 0.5 ? 0.0 : fi < 1.5 ? 1.0 : fi < 2.5 ? 2.0 : fi < 3.5 ? 3.0 : fi < 4.5 ? 4.0 : fi < 5.5 ? 1.0 : 3.0;
        float t = fract(phase + hash1(fi * 5.3));
        float shown = smoothstep(0.05, 0.15, t) * smoothstep(0.85, 0.72, t);
        vec2 q = (uv - centre) / halfSize;
        float inside = step(abs(q.x), 1.0) * step(abs(q.y), 1.0);
        vec3 tile = fi > 5.5 ? vec3(0.92, 0.9, 0.94) : photoTile(q, kind, fi);
        col = mix(col, tile, inside * shown);
      }
      // stat labels scattered between the tiles
      vec2 label = floor(uv * vec2(24.0, 60.0));
      float text = step(0.965, hash2(label)) * step(0.3, fract(uv.x * 24.0 * 3.0));
      col += vec3(0.85) * text * (1.0 - step(0.01, dot(col, vec3(1.0))));
      return col;
    }
  `,

  globe: `
    vec3 paint(vec2 uv, float phase, float aspect) {
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      vec3 col = vec3(0.01, 0.012, 0.02) + vec3(0.03, 0.035, 0.05) * (1.0 - length(p));
      vec2 q = p;
      float r = length(q) / 0.42;
      if (r < 1.0) {
        float z = sqrt(1.0 - r * r);
        vec3 n = vec3(q / 0.42, z);
        float spin = TAU * phase;
        vec3 s = vec3(n.x * cos(spin) + n.z * sin(spin), n.y, -n.x * sin(spin) + n.z * cos(spin));
        float land = smoothstep(0.52, 0.56, fbm3(s * 2.2 + 5.0));
        vec3 ocean = mix(vec3(0.03, 0.12, 0.3), vec3(0.08, 0.25, 0.5), z);
        vec3 ground = mix(vec3(0.55, 0.45, 0.32), vec3(0.3, 0.4, 0.22), fbm3(s * 6.0));
        vec3 surface = mix(ocean, ground, land);
        surface += vec3(0.9) * smoothstep(0.62, 0.8, fbm3(s * 4.0 + 20.0)) * 0.35;
        float light = 0.35 + 0.65 * max(dot(n, normalize(vec3(-0.5, 0.6, 0.6))), 0.0);
        col = surface * light + vec3(0.4, 0.6, 1.0) * pow(1.0 - z, 3.0) * 0.8;
      }
      col += vec3(0.3, 0.5, 1.0) * smoothstep(1.08, 1.0, r) * smoothstep(0.96, 1.0, r) * 0.6;
      return col * 1.12;
    }
  `,

  // the Shop swirl: lavender bands winding into a white hook round a dark eye
  swirl: `
    vec3 paint(vec2 uv, float phase, float aspect) {
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      float r = length(p);
      float a = atan(p.y, p.x);
      // one tightly wound arm, close to concentric rings, rocking a little
      float s = r * 6.0 + a / TAU - 0.15 * sin(TAU * phase);
      float band = smoothstep(-0.25, 0.45, cos(TAU * s));
      float groove = smoothstep(0.05, 0.0, abs(fract(s) - 0.5) - 0.44);
      vec3 col = mix(vec3(0.05, 0.04, 0.14), vec3(0.95, 0.93, 1.0), band);
      col *= 0.9 + 0.12 * cos(a - 0.8);
      col = mix(col, vec3(0.04, 0.03, 0.1), groove * 0.85);
      float gap = smoothstep(0.0, 0.08, fract(a / TAU - 0.06 * sin(TAU * phase) + 0.3));
      col += vec3(0.9, 0.88, 1.0) * exp(-max(r - 0.11, 0.0) * 16.0) * 0.3;
      // the white hook, then a lavender iris round a dark pupil
      col = mix(col, vec3(1.0), fill(abs(r - 0.09) - 0.03) * gap);
      col = mix(col, mix(vec3(0.42, 0.38, 0.72), vec3(0.2, 0.17, 0.42), smoothstep(0.06, 0.03, r)), fill(r - 0.06));
      col = mix(col, vec3(0.06, 0.05, 0.14), fill(r - 0.028));
      return clamp((col) * 1.45, 0.0, 1.0);
    }
  `,

  // Payments: teal cards seen at an angle, stacking up one on another, with
  // letters floating round them
  cards: `
    vec4 card(vec2 p, vec2 centre, float top) {
      mat2 toCard = mat2(0.8, 0.34, -0.39, 0.22);
      // inverse of the card's axes on screen
      float det = toCard[0][0] * toCard[1][1] - toCard[1][0] * toCard[0][1];
      mat2 inv = mat2(toCard[1][1], -toCard[0][1], -toCard[1][0], toCard[0][0]) / det;
      vec2 q = inv * (p - centre);
      float d = sdRoundBox(q, vec2(0.5, 0.32), 0.05);
      vec2 qs = inv * (p - centre + vec2(0.0, 0.018));
      float side = fill(sdRoundBox(qs, vec2(0.5, 0.32), 0.05));
      vec3 face = top > 0.5
        ? mix(vec3(0.04, 0.36, 0.4), vec3(0.12, 0.58, 0.58), q.x + 0.5)
        : mix(vec3(0.12, 0.16, 0.18), vec3(0.22, 0.28, 0.3), q.x + 0.5);
      face += vec3(0.35, 0.7, 0.7) * exp(-abs(d) * 160.0) * 0.8;
      face = mix(face, vec3(0.85, 0.7, 0.35), top * fill(sdRoundBox(q - vec2(-0.3, 0.06), vec2(0.07, 0.05), 0.01)));
      float digits = step(0.5, fract(q.x * 16.0)) * step(abs(q.y + 0.1), 0.025) * step(abs(q.x + 0.05), 0.3);
      face = mix(face, vec3(0.9), top * digits * 0.8);
      float body = fill(d);
      return vec4(mix(vec3(0.05, 0.18, 0.2), face, body), max(body, side));
    }

    vec3 paint(vec2 uv, float phase, float aspect) {
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      vec3 col = vec3(0.0);
      float stack = 1.0 - abs(fract(phase) * 2.0 - 1.0);
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float shown = smoothstep(fi * 0.4, fi * 0.4 + 0.1, stack + 0.05);
        vec4 c = card(p, vec2(0.0, -0.1 + fi * 0.08), fi > 1.5 || stack < (fi + 1.0) * 0.4 ? 1.0 : 0.0);
        col = mix(col, c.rgb, c.a * shown);
      }
      // letters drifting up around the stack
      vec2 cell = floor(p * vec2(14.0, 10.0));
      vec2 inCell = fract(p * vec2(14.0, 10.0));
      float blink = step(0.4, fract(hash2(cell + 3.0) + phase * 2.0));
      float letter = step(0.93, hash2(cell)) * blink * step(abs(inCell.x - 0.5), 0.12) * step(abs(inCell.y - 0.5), 0.2);
      col += vec3(0.85) * letter * step(0.35, abs(p.x) + abs(p.y) * 0.5);
      return col;
    }
  `,

  // an iridescent ring seen edge-on, light streaming out of it sideways
  vortex: `
    vec3 paint(vec2 uv, float phase, float aspect) {
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      vec2 loop = loopVec(phase);
      vec2 d = mat2(0.97, 0.24, -0.24, 0.97) * (p - vec2(0.08 + 0.04 * loop.y, -0.02));
      d.y *= 2.4;
      float r = length(d);
      float a = atan(d.y, d.x);
      float rays = pow(noise3(vec3(cos(a) * 12.0 + loop.x, sin(a) * 12.0 + loop.y, r * 1.5)), 3.0);
      vec3 col = vec3(0.8, 0.84, 0.92) * rays * exp(-r * 2.0) * smoothstep(0.04, 0.14, r) * 1.2;
      float ring = exp(-pow((r - 0.16) * 16.0, 2.0));
      col += (0.55 + 0.45 * cos(TAU * (vec3(0.0, 0.33, 0.67) + a / TAU * 2.0 + r * 3.0))) * ring;
      col *= smoothstep(0.02, 0.1, r);
      // a white haze pouring off to the left
      col += vec3(0.9, 0.92, 0.97) * exp(-length((p - vec2(-0.12, 0.04)) * vec2(0.8, 2.0)) * 3.2) * 0.9;
      return clamp(col, 0.0, 1.0);
    }
  `,

  // a stepped pyramid of glowing blocks on a glossy floor scattered with
  // Finance: a stepped pyramid of lit blocks on a wet floor, small glowing
  // cubes scattered around it and dark pyramids behind, as the clip shows
  bars: `
    const float HORIZON = -0.13;

    // one row of blocks, with its gaps and its slightly uneven lighting
    float blockRow(vec2 p, float halfWidth, float baseY, float height, float pitch, out float shade) {
      float inside = step(baseY, p.y) * step(p.y, baseY + height) * smoothstep(0.012, -0.012, abs(p.x) - halfWidth);
      vec2 cell = vec2(fract((p.x + 4.0) / pitch), (p.y - baseY) / height);
      float gapX = smoothstep(0.0, 0.14, cell.x) * smoothstep(1.0, 0.86, cell.x);
      float gapY = smoothstep(0.0, 0.16, cell.y) * smoothstep(1.0, 0.84, cell.y);
      shade = 0.82 + 0.18 * hash2(vec2(floor((p.x + 4.0) / pitch), floor(baseY * 120.0)));
      return inside * (0.88 + 0.12 * gapX * gapY);
    }

    vec3 pyramid(vec2 p) {
      vec3 col = vec3(0.0);
      float pitch = 0.062;
      float height = 0.042;
      for (int i = 0; i < 9; i++) {
        float fi = float(i);
        float halfWidth = (fi < 0.5 ? 0.39 : 0.34) - fi * 0.034;
        float shade;
        float body = blockRow(p, halfWidth, HORIZON + fi * height, height, pitch, shade);
        col = mix(col, mix(vec3(0.8, 0.78, 0.68), vec3(0.97, 0.96, 0.92), fi / 8.0) * shade, body);
      }
      // the light it throws into the air around it
      col += vec3(1.0, 0.93, 0.76) * exp(-length((p - vec2(0.0, HORIZON + 0.14)) * vec2(1.4, 1.8)) * 4.0) * 0.16;
      return col;
    }

    // the darker pyramids standing behind, in silhouette
    vec3 backdropPyramids(vec2 p) {
      vec3 col = vec3(0.0);
      for (int i = 0; i < 2; i++) {
        float side = i == 0 ? -1.0 : 1.0;
        vec2 at = vec2(side * 0.62, HORIZON);
        float up = (p.y - at.y) / 0.1;
        float inside = step(0.0, up) * step(up, 1.0)
          * smoothstep(0.02, -0.02, abs(p.x - at.x) - 0.19 * (1.0 - up));
        col = mix(col, vec3(0.075, 0.085, 0.08) * (1.0 + 0.5 * up), inside);
      }
      return col;
    }

    vec3 paint(vec2 uv, float phase, float aspect) {
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      vec2 loop = loopVec(phase);
      // the camera drifts slowly across the scene
      p.x += 0.045 * loop.x;

      vec3 col = vec3(0.012, 0.013, 0.016);
      col += vec3(0.1, 0.09, 0.07) * exp(-abs(p.y - HORIZON) * 7.0) * step(HORIZON, p.y);
      col += vec3(0.62, 0.6, 0.48) * exp(-abs(p.y - HORIZON) * 16.0) * 0.16;
      col += backdropPyramids(p);
      col += pyramid(p);

      // the floor mirrors what stands on it, smeared downward
      if (p.y < HORIZON) {
        float depth = HORIZON - p.y;
        vec2 q = vec2(p.x + sin(p.y * 40.0) * 0.006 * depth, HORIZON + depth * 0.8);
        float streak = 0.72 + 0.28 * sin(p.x * 130.0 + 1.3) * exp(-depth * 3.0);
        col += pyramid(q) * exp(-depth * 4.0) * 0.45 * streak;
        // light bouncing off the wet floor around the pyramid
        col += vec3(0.85, 0.8, 0.62) * exp(-depth * 2.2) * exp(-abs(p.x) * 0.6) * 0.2;
        col += vec3(0.5, 0.48, 0.4) * exp(-depth * 9.0) * 0.2;
      }

      // cubes standing about on the floor, lit white, blue or amber; the near
      // ones are larger and softer, as the clip's shallow focus makes them
      for (int i = 0; i < 26; i++) {
        float fi = float(i);
        float lane = hash1(fi * 2.7) * 2.0 - 1.0;
        float depth = fract(hash1(fi * 5.1) + phase * 0.12);
        float near = pow(depth, 1.7);
        vec2 at = vec2(lane * (0.5 + near * 1.15) + 0.045 * loop.x, HORIZON - 0.015 - near * 0.4);
        float size = 0.008 + 0.024 * near;
        float soft = 0.003 + 0.03 * near * near;
        vec3 tint = hash1(fi * 9.9) < 0.42
          ? vec3(0.82, 0.88, 1.0)
          : (hash1(fi * 13.1) < 0.25 ? vec3(1.0, 0.9, 0.72) : vec3(1.0, 0.98, 0.92));
        float d = sdRoundBox(p - at, vec2(size), size * 0.12);
        float body = smoothstep(soft, -soft, d);
        col = mix(col, mix(vec3(1.0), tint, 0.55), body);
        col += tint * exp(-max(d, 0.0) * 22.0) * 0.22;
        // its reflection, stretched down the wet floor
        float below = at.y - p.y;
        if (below > 0.0) {
          float mirror = smoothstep(soft * 2.0, -soft, sdRoundBox(vec2(p.x - at.x, below * 0.55 - size), vec2(size, size), size * 0.12));
          col += tint * mirror * 0.22 * exp(-below * 5.0);
        }
      }
      return clamp(col, 0.0, 1.0);
    }
  `,

  // Developer: a two-by-two grid of dark site screenshots, one swapped for a
  // page of code as it plays
  screens: `
    vec3 paint(vec2 uv, float phase, float aspect) {
      vec3 col = vec3(0.0);
      float swap = floor(fract(phase) * 4.0);
      for (int i = 0; i < 4; i++) {
        float fi = float(i);
        vec2 centre = vec2(mod(fi, 2.0) < 0.5 ? 0.29 : 0.71, fi < 1.5 ? 0.71 : 0.3);
        vec2 local = (uv - centre) / vec2(0.2, 0.17);
        float inside = step(abs(local.x), 1.0) * step(abs(local.y), 1.0);
        vec3 screen = mix(vec3(0.04, 0.07, 0.07), vec3(0.12, 0.2, 0.19), local.y * 0.5 + 0.5);
        screen *= 0.7 + 0.5 * fbm3(vec3(local * 2.0 + fi, 1.0));
        screen += vec3(0.8) * step(0.985, hash2(floor(local * 60.0) + fi));
        float line1 = step(abs(local.y + 0.02), 0.08) * step(-0.8, local.x) * step(local.x, 0.35);
        float line2 = step(abs(local.y + 0.24), 0.08) * step(-0.8, local.x) * step(local.x, 0.05);
        float glyphs = step(0.3, fract(local.x * 8.0 + fi * 0.3));
        screen = mix(screen, vec3(0.92), (line1 + line2) * glyphs);
        screen += vec3(0.5) * step(0.86, local.y) * step(0.6, hash2(floor(local * vec2(30.0, 3.0))));
        // one panel at a time turns into a page of code
        float code = step(abs(fi - swap), 0.5);
        vec2 textCell = floor((local + 1.0) * vec2(22.0, 12.0));
        float glyph = step(0.45, hash2(textCell)) * step(hash1(textCell.y * 3.1) * 22.0, 22.0 - textCell.x);
        vec3 page = vec3(0.9) * glyph * step(0.3, fract((local.x + 1.0) * 22.0));
        col = mix(col, mix(screen, page, code), inside);
      }
      return col;
    }
  `,

  // a grid of photos, cells switching between shots as it plays
  tiles: `
    vec3 shot(vec2 q, float kind) {
      if (kind < 0.2) {
        vec3 sky = mix(vec3(0.62, 0.76, 0.92), vec3(0.88, 0.92, 0.96), q.y);
        return mix(mix(vec3(0.3, 0.5, 0.22), vec3(0.45, 0.6, 0.3), q.x), sky, step(0.45 + 0.06 * sin(q.x * 7.0), q.y));
      }
      if (kind < 0.4) {
        vec3 bg = vec3(0.86, 0.78, 0.92);
        return mix(bg, vec3(0.92, 0.5, 0.62), smoothstep(0.26, 0.2, length((q - 0.5) * vec2(1.0, 1.8))));
      }
      if (kind < 0.6) {
        vec3 bg = vec3(0.94, 0.93, 0.91);
        return mix(bg, vec3(0.82, 0.32, 0.52), smoothstep(0.03, 0.0, length((q - vec2(0.5, 0.45)) * vec2(3.0, 1.0)) - 0.35));
      }
      if (kind < 0.8) {
        return mix(vec3(0.5, 0.38, 0.3), vec3(0.85, 0.72, 0.55), fbm3(vec3(q * 5.0, 2.0)));
      }
      vec3 bg = vec3(0.3, 0.5, 0.82);
      return mix(bg, vec3(0.5, 0.68, 0.98), smoothstep(0.3, 0.24, length(q - 0.5)));
    }

    vec3 paint(vec2 uv, float phase, float aspect) {
      vec2 grid = uv * vec2(3.0, 3.0);
      vec2 id = floor(grid);
      vec2 q = fract(grid);
      float gutter = step(0.05, q.x) * step(q.x, 0.95) * step(0.06, q.y) * step(q.y, 0.94);
      float segment = floor(fract(phase) * 5.0);
      float within = fract(fract(phase) * 5.0);
      float kind = hash2(id + segment * 7.1);
      float next = hash2(id + mod(segment + 1.0, 5.0) * 7.1);
      float empty = step(hash2(id * 3.3 + segment), 0.25);
      vec3 a = shot((q - 0.05) / 0.9, kind);
      vec3 b = shot((q - 0.05) / 0.9, next);
      vec3 photo = mix(a, b, smoothstep(0.85, 1.0, within));
      return photo * gutter * (1.0 - empty) * 0.82;
    }
  `,
};

// How colourful each stand-in ends up, measured against its clip: the ratio
// of the clip's mean saturation to the painted one's, so the two match.
const SATURATION: Record<PainterId, number> = {
  prism: 1,
  stripes: 0.47,
  pills: 1,
  coins: 0.9,
  phone: 1,
  storefront: 1.51,
  rays: 1,
  collage: 0.5,
  globe: 0.36,
  swirl: 0.92,
  cards: 0.56,
  vortex: 0.93,
  bars: 1.15,
  screens: 1.85,
  tiles: 1.48,
};

export function painterShader(id: PainterId) {
  return `
${PAINTER_PRELUDE}
${BODIES[id]}
    void main() {
      vec3 col = paint(vUv, uPhase, uAspect);
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(luma), col, ${SATURATION[id].toFixed(2)});
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `;
}
