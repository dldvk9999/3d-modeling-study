// Every chapter of the original raymarches one or two short clips stacked
// into 3D textures (see lightVolume.ts). The clips are Shopify's footage, so
// each one is stood in for by a shader that paints the same subject, frame by
// frame, into the texture: a spinning globe, a ring of coins, the Shop swirl.
//
// A painter is `vec3 paint(vec2 uv, float phase, float aspect)`: uv is the
// frame, phase runs 0..1 around a closed loop (the texture wraps in depth, so
// the last frame must lead back into the first), aspect is width / height.

export type PainterId =
  | "prism" // rainbow sheets of light out of a white hot spot (Agentic)
  | "prismPlain" // the same light without the Agentic colour push (Retail foreground)
  | "stripes" // a voice waveform of pastel bars over dust (Sidekick voice)
  | "pills" // small glowing UI pills drifting past (Sidekick artifacts)
  | "coins" // a ring of pastel coins turning (Online)
  | "phone" // a phone screen with a photo card sliding up (Online foreground)
  | "storefront" // a warm painted glass storefront (Retail)
  | "collage" // product photos and cards sliding over black (Marketing)
  | "tiles" // bright photo tiles growing out of black (Developer foreground)
  | "globe" // the Earth, turning (Operations)
  | "swirl" // the Shop swirl, winding in (Shop app)
  | "cards" // payment cards flying past at a steep angle (Payments)
  | "vortex" // iridescent rays round a rainbow hole (Payments foreground)
  | "bars" // a stepped block skyline, motion blurred (Finance)
  | "screens"; // drifting panels of a dark website (Developer)

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

  prismPlain: `
    ${PRISM_CORE}
    vec3 paint(vec2 uv, float phase, float aspect) {
      return prismLight(uv, phase, aspect);
    }
  `,

  // a voice waveform: rows of thin pastel bars pulsing up and down, with
  // groups of loud bars travelling across the frame
  stripes: `
    vec3 paint(vec2 uv, float phase, float aspect) {
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      vec3 col = vec3(0.015, 0.014, 0.02);
      // a dim haze shelf low in the frame
      col += vec3(0.03, 0.035, 0.07) * smoothstep(0.08, -0.08, p.y + 0.26 + 0.05 * sin(TAU * phase));
      col += vec3(0.8, 0.75, 0.9) * step(0.992, hash2(floor(uv * vec2(aspect, 1.0) * 150.0))) * 0.6;

      float coord = (p.x + aspect * 0.5) / (aspect / 72.0);
      float id = floor(coord);
      float bar = smoothstep(0.5, 0.28, abs(fract(coord) - 0.5));

      // loud groups travel across and out of frame, both ways
      float envelope = 0.0;
      for (int g = 0; g < 3; g++) {
        float fg = float(g);
        float direction = mod(fg, 2.0) < 0.5 ? 1.0 : -1.0;
        float travel = aspect + 1.2;
        float centre = (fract(hash1(fg * 4.3) + phase * direction) - 0.5) * travel;
        envelope = max(envelope, smoothstep(0.38, 0.0, abs(p.x - centre)));
      }
      float height = envelope * (0.12 + 0.3 * hash1(id * 1.7)) * (0.6 + 0.4 * sin(TAU * (phase * 2.0 + hash1(id * 3.1))));
      float inBar = smoothstep(height, height - 0.02, abs(p.y - 0.05)) * step(0.005, height);
      // lavender and pink, with the odd peach or mint bar
      vec3 pastel = 0.72 + 0.26 * cos(TAU * (vec3(0.0, 0.2, 0.45) + hash1(id * 1.7) * 0.5 + 0.55));
      pastel = mix(pastel, vec3(0.72, 0.55, 1.0), 0.7);
      return mix(col, pastel, bar * inBar);
    }
  `,

  pills: `
    vec3 paint(vec2 uv, float phase, float aspect) {
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      vec3 col = vec3(0.0);
      for (int i = 0; i < 5; i++) {
        float fi = float(i);
        vec2 c = vec2((hash1(fi * 2.3) - 0.5) * aspect * 0.8, (fract(hash1(fi * 5.1) + phase) - 0.5) * 1.8);
        vec2 q = p - c;
        float size = 0.08 + 0.06 * hash1(fi * 9.7);
        float d = sdRoundBox(q, vec2(size, size * 0.28), size * 0.28);
        float body = fill(d);
        float rim = smoothstep(0.012, 0.0, abs(d));
        col += vec3(0.1, 0.08, 0.14) * body + vec3(0.55, 0.35, 1.0) * rim * 0.9;
        col += vec3(0.9) * smoothstep(0.02, 0.012, length(q - vec2(-size * 0.5, 0.0))) * body;
      }
      return col;
    }
  `,

  coins: `
    vec3 paint(vec2 uv, float phase, float aspect) {
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      vec3 col = vec3(0.0);
      for (int i = 0; i < 9; i++) {
        float fi = float(i);
        // one full turn of the ring per loop
        float a = TAU * (fi / 9.0 + phase);
        vec2 radial = vec2(cos(a), sin(a));
        vec2 tangent = vec2(-radial.y, radial.x);
        vec2 q = p - radial * 0.3;
        // coins tip as they come round, so they read as discs seen at an angle
        float tip = 0.45 + 0.55 * abs(cos(a + TAU * phase));
        vec2 local = vec2(dot(q, tangent) / tip, dot(q, radial));
        float d = length(local) - 0.13;
        vec3 tint = 0.72 + 0.25 * cos(TAU * (vec3(0.0, 0.33, 0.67) + fi / 9.0));
        float shade = 0.7 + 0.35 * smoothstep(0.13, 0.0, length(local + vec2(0.03, -0.04)));
        // the embossed bag on each face
        float emboss = smoothstep(0.006, 0.0, abs(sdRoundBox(local, vec2(0.045, 0.055), 0.01)));
        col = mix(col, tint * (shade - emboss * 0.15), fill(d));
      }
      return col;
    }
  `,

  phone: `
    vec3 paint(vec2 uv, float phase, float aspect) {
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      vec3 col = vec3(0.0);
      vec2 phoneCentre = vec2(-0.1 + 0.05 * sin(TAU * phase), 0.05);
      float phone = sdRoundBox(p - phoneCentre, vec2(0.22, 0.46), 0.06);
      float onScreen = fill(phone);
      col = mix(col, mix(vec3(0.93, 0.95, 1.0), vec3(0.75, 0.84, 1.0), uv.y), onScreen);
      // a photo card slides up through the screen and out of it
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

  storefront: `
    vec3 paint(vec2 uv, float phase, float aspect) {
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      vec2 loop = loopVec(phase);
      p.x += 0.06 * loop.y;
      vec3 col = mix(vec3(0.9, 0.74, 0.6), vec3(0.62, 0.6, 0.64), smoothstep(-0.1, 0.5, p.y));
      float ground = smoothstep(0.01, -0.01, p.y + 0.22 + p.x * 0.12);
      col = mix(col, vec3(0.3, 0.28, 0.33), ground);

      float glass = fill(sdRoundBox(p - vec2(0.05, -0.02), vec2(0.62, 0.2), 0.01));
      vec3 inside = mix(vec3(0.95, 0.55, 0.3), vec3(0.6, 0.78, 0.7), fbm3(vec3(p * 4.0 + loop * 0.3, 1.0)));
      inside = mix(inside, vec3(1.0, 0.6, 0.72),
        smoothstep(0.55, 0.75, fbm3(vec3(p * 6.0 + 3.0 + loop * 0.2, 2.0))) * 0.6);
      float mullion = smoothstep(0.06, 0.0, abs(fract((p.x + 0.57) * 5.0) - 0.5));
      inside = mix(inside, vec3(0.85, 0.8, 0.72), mullion * 0.7);
      col = mix(col, inside, glass);

      col = mix(col, vec3(0.62, 0.66, 0.62), fill(sdRoundBox(p - vec2(0.03, 0.22), vec2(0.7, 0.03), 0.005)));
      float canopy = length((p - vec2(-0.55, 0.3)) * vec2(1.0, 1.3)) - 0.2 + 0.08 * fbm3(vec3(p * 9.0, 4.0));
      col = mix(col, vec3(0.3, 0.42, 0.3), smoothstep(0.01, -0.01, canopy) * 0.9);
      return col;
    }
  `,

  collage: `
    vec3 paint(vec2 uv, float phase, float aspect) {
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      vec3 col = vec3(0.0);
      for (int i = 0; i < 10; i++) {
        float fi = float(i);
        // whole-number speeds keep the loop seamless
        float speed = hash1(fi * 1.3) < 0.5 ? 1.0 : 2.0;
        float x = (fract(hash1(fi * 2.9) + phase * speed) - 0.5) * (aspect + 0.6);
        float y = (hash1(fi * 4.7) - 0.5) * 0.9;
        vec2 size = vec2(0.05 + 0.09 * hash1(fi * 6.1), 0.04 + 0.08 * hash1(fi * 8.3));
        vec2 q = p - vec2(x, y);
        float inside = fill(sdRoundBox(q, size, 0.01));
        vec3 base = 0.38 + 0.32 * cos(TAU * (vec3(0.0, 0.25, 0.55) + hash1(fi * 11.0)));
        vec3 photo = base * (0.35 + 0.6 * fbm3(vec3(q * 14.0, fi)));
        photo = mix(photo, vec3(0.95), smoothstep(0.7, 0.9, fbm3(vec3(q * 30.0, fi + 5.0))) * 0.5);
        col = mix(col, clamp(photo, 0.0, 1.0), inside);
      }
      // specks of interface text
      col += vec3(0.85) * step(0.986, hash2(floor(uv * vec2(aspect, 1.0) * 90.0) + floor(phase * 4.0)));
      return col;
    }
  `,

  tiles: `
    vec3 paint(vec2 uv, float phase, float aspect) {
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      vec3 col = vec3(0.0);
      for (int i = 0; i < 8; i++) {
        float fi = float(i);
        vec2 centre = vec2((hash1(fi * 3.1) - 0.5) * aspect * 0.85, (hash1(fi * 7.3) - 0.5) * 0.8);
        // each tile grows in, holds and shrinks away once per loop
        float life = 0.5 - 0.5 * cos(TAU * (phase + hash1(fi * 1.9)));
        vec2 size = vec2(0.1 + 0.08 * hash1(fi * 5.7), 0.08 + 0.06 * hash1(fi * 9.1)) * (0.4 + 0.8 * life);
        vec2 q = p - centre;
        float inside = fill(sdRoundBox(q, size, 0.008));
        vec2 local = q / size;
        // light studio or sky backdrop, a coloured subject, a ground band
        vec3 backdrop = mix(vec3(0.95, 0.94, 0.92), vec3(0.62, 0.78, 0.92), step(0.5, hash1(fi * 2.2)));
        vec3 subject = 0.45 + 0.4 * cos(TAU * (vec3(0.0, 0.3, 0.6) + hash1(fi * 11.0)));
        vec3 photo = mix(backdrop, subject, smoothstep(0.45, 0.35, length(local * vec2(1.4, 0.8))));
        photo = mix(photo, vec3(0.35, 0.5, 0.3), (1.0 - smoothstep(-0.7, -0.55, local.y)) * step(0.5, hash1(fi * 4.4)));
        col = mix(col, photo, inside);
      }
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
      return col;
    }
  `,

  swirl: `
    vec3 paint(vec2 uv, float phase, float aspect) {
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      float r = length(p);
      float a = atan(p.y, p.x);
      // two arms winding in, turning once per loop
      float arms = fract(a / TAU * 2.0 + log(r + 0.02) * 1.6 - phase);
      float band = smoothstep(0.0, 0.08, arms) * smoothstep(0.55, 0.35, arms);
      float rings = 0.5 + 0.5 * sin(r * 70.0 - TAU * phase * 3.0);
      vec3 col = mix(vec3(0.04, 0.03, 0.1), mix(vec3(0.22, 0.18, 0.55), vec3(0.62, 0.58, 0.95), rings), band);
      col *= smoothstep(1.2, 0.2, r);
      // the bright hook in the middle
      float gap = smoothstep(0.3, 0.45, fract(a / TAU - phase + 1.0));
      col = mix(col, vec3(0.95, 0.94, 1.0), fill(abs(r - 0.1) - 0.035) * gap);
      col += step(0.994, hash2(floor(uv * vec2(aspect, 1.0) * 160.0))) * 0.5;
      return col;
    }
  `,

  cards: `
    vec3 paint(vec2 uv, float phase, float aspect) {
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      vec3 col = vec3(0.0);
      mat2 tilt = mat2(0.99, 0.12, -0.12, 0.99);
      for (int i = 0; i < 6; i++) {
        float fi = float(i);
        float t = fract(hash1(fi * 3.7) + phase);
        vec2 c = vec2(mix(-1.6, 1.6, t) * aspect * 0.5, (hash1(fi * 5.3) - 0.5) * 0.8 + mix(-0.15, 0.15, t));
        vec2 q = tilt * (p - c);
        q.y /= 0.5;
        float card = fill(sdRoundBox(q, vec2(0.3, 0.19), 0.03));
        vec3 face = mix(vec3(0.02, 0.28, 0.32), vec3(0.08, 0.5, 0.52), 0.5 + 0.5 * q.x / 0.3);
        face = mix(face, vec3(0.85, 0.7, 0.35), fill(sdRoundBox(q - vec2(-0.18, 0.02), vec2(0.04, 0.03), 0.006)));
        float digits = step(0.5, fract(q.x * 22.0)) * smoothstep(0.012, 0.0, abs(q.y + 0.06)) * step(abs(q.x + 0.02), 0.22);
        face = mix(face, vec3(0.9), digits * 0.8);
        col = mix(col, face, card);
      }
      return col;
    }
  `,

  vortex: `
    vec3 paint(vec2 uv, float phase, float aspect) {
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      vec2 loop = loopVec(phase);
      vec2 d = (p - vec2(0.05 * loop.y, -0.02)) * vec2(1.0, 1.8);
      float r = length(d);
      float a = atan(d.y, d.x);
      float rays = pow(noise3(vec3(cos(a) * 40.0 + loop.x * 2.0, sin(a) * 40.0 + loop.y * 2.0, r * 2.0)), 2.5) * 1.4
        + pow(noise3(vec3(cos(a) * 110.0 + loop.x * 3.0, sin(a) * 110.0 + loop.y * 3.0, r * 5.0)), 6.0);
      float fall = exp(-r * 2.2) * smoothstep(0.02, 0.1, r);
      vec3 col = vec3(0.75, 0.82, 0.9) * rays * fall * 1.6;
      float ring = exp(-pow((r - 0.14) * 22.0, 2.0));
      col += (0.5 + 0.5 * cos(TAU * (vec3(0.0, 0.33, 0.67) + r * 4.0) + a)) * ring * 0.9;
      col *= 0.2 + 0.8 * smoothstep(-0.45, 0.1, -p.y);
      return col;
    }
  `,

  bars: `
    vec3 paint(vec2 uv, float phase, float aspect) {
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      vec2 loop = loopVec(phase);
      vec3 col = vec3(0.01);
      float x = p.x + 0.08 * loop.y;
      // a stepped pyramid of blocks: each row up is a block narrower
      float rowHeight = 0.09;
      float row = floor((p.y + 0.42) / rowHeight);
      float halfWidth = 0.62 - row * 0.075;
      vec2 cell = vec2(fract((x + 2.0) / 0.12), fract((p.y + 0.42) / rowHeight));
      float gaps = smoothstep(0.0, 0.08, cell.x) * smoothstep(1.0, 0.92, cell.x)
        * smoothstep(0.0, 0.1, cell.y) * smoothstep(1.0, 0.9, cell.y);
      float body = step(0.0, row) * step(row, 7.0) * smoothstep(0.02, -0.02, abs(x) - halfWidth);
      float streak = 0.7 + 0.3 * noise3(vec3(p.x * 1.5 + loop.x * 0.8, p.y * 50.0, loop.y * 0.8));
      float shade = 0.6 + 0.4 * hash2(vec2(floor((x + 2.0) / 0.12), row));
      // the top rows catch more light
      float lift = 0.75 + 0.35 * clamp(row / 7.0, 0.0, 1.0);
      col = mix(col, vec3(0.86, 0.85, 0.72) * streak * shade * lift, body * (0.35 + 0.65 * gaps));
      col += vec3(0.85, 0.65, 0.25) * exp(-pow((p.y + 0.46) * 35.0, 2.0)) * 0.4
        * smoothstep(0.3, 0.8, noise3(vec3(p.x * 3.0 + loop.x, 7.0 + loop.y, 0.0)));
      return clamp(col, 0.0, 1.0);
    }
  `,

  screens: `
    vec3 paint(vec2 uv, float phase, float aspect) {
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
      vec2 cellSize = vec2(0.6, 0.5);
      // a wall of panels drifting one panel per loop
      vec2 q = vec2(p.x, p.y * 1.4) + phase * cellSize;
      vec2 id = floor(q / cellSize);
      vec2 f = fract(q / cellSize) - 0.5;
      float panel = smoothstep(0.02, -0.02, sdRoundBox(f, vec2(0.44, 0.4), 0.02));
      vec3 screen = mix(vec3(0.05, 0.08, 0.07), vec3(0.18, 0.28, 0.25), f.y + 0.5);
      screen *= 0.7 + 0.5 * fbm3(vec3(f * 4.0 + id * 3.1, 1.0));
      screen += step(0.97, hash2(floor((f + id) * 60.0))) * 0.5;
      float text = step(0.45, fract(f.x * 18.0)) * smoothstep(0.03, 0.0, abs(f.y)) * step(abs(f.x), 0.3);
      screen += vec3(0.85) * text * step(0.4, hash2(id));
      return screen * panel * step(0.25, hash2(id + 7.0));
    }
  `,
};

export function painterShader(id: PainterId) {
  return `
${PAINTER_PRELUDE}
${BODIES[id]}
    void main() {
      gl_FragColor = vec4(clamp(paint(vUv, uPhase, uAspect), 0.0, 1.0), 1.0);
    }
  `;
}
