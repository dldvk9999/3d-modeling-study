// Each chapter of the original runs a different captured scene behind it — a
// voice artifact, a globe, a test grid, a room. Those are filmed point clouds
// we can't reuse, so each chapter gets its own procedural stand-in that keeps
// the same subject and the same dark, glowing look.

export type SceneVariant =
  | "aurora" // standing columns of light, breathing
  | "ribbons" // long bands of light flowing sideways
  | "globe" // a dotted sphere, turning
  | "grid" // a perspective grid running to the horizon
  | "cloud"; // a soft lit cloud with specks drifting through it

const PRELUDE = `
  precision highp float;

  uniform float uTime;
  uniform vec2 uRes;
  uniform vec2 uCenter;
  uniform vec3 uWarm;
  uniform vec3 uCool;
  uniform float uFade;
  uniform float uTilt;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 w = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
  }

  float fbm(vec2 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      sum += noise(p) * amp;
      p *= 2.02;
      amp *= 0.5;
    }
    return sum;
  }

  mat2 rot(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
  }

  vec3 stars(vec2 uv, float density, float away) {
    vec2 cell = floor(uv * uRes.y * 0.55);
    float star = step(density, hash21(cell));
    float twinkle = 0.6 + 0.4 * sin(uTime * 2.0 + hash21(cell + 3.1) * 6.283);
    return vec3(0.95, 0.95, 1.0) * star * twinkle * away;
  }
`;

const BODIES: Record<SceneVariant, string> = {
  // columns of light standing on the horizon, swaying and breathing
  aurora: `
    vec2 p = uv - vec2(uCenter.x * 0.5, 0.0);
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      float drift = sin(uTime * 0.09 + fi * 1.9) * 0.55 + (fi - 2.5) * 0.28;
      float width = 9.0 + fi * 2.5;
      float wobble = fbm(vec2(p.y * 1.6 + fi * 7.0, uTime * 0.12 + fi)) - 0.5;
      float band = exp(-pow((p.x - drift + wobble * 0.22) * width, 2.0));
      // taller and brighter toward the top, rooted at the bottom
      float rise = smoothstep(-0.55, 0.65, p.y + fbm(vec2(p.x * 3.0, uTime * 0.08 + fi)) * 0.3);
      float pulse = 0.65 + 0.35 * sin(uTime * 0.5 + fi * 1.3);
      col += tint(fi * 1.1) * band * rise * pulse * 0.55;
    }
    col += mix(uWarm, uCool, 0.5) * 0.10 * exp(-pow((uv.y + 0.55) * 3.2, 2.0));
    col += stars(uv, 0.9984, smoothstep(-0.2, 0.7, uv.y));
  `,

  // long bands of light flowing sideways, like silk catching a light
  ribbons: `
    vec2 q = rot(uTilt) * uv;
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      float lane = (fi - 2.5) * 0.22;
      float warpY =
        sin(q.x * 1.7 + uTime * 0.22 + fi * 0.9) * 0.16 +
        fbm(vec2(q.x * 1.1 + fi * 4.0, uTime * 0.07)) * 0.28;
      float band = exp(-pow((q.y - lane + warpY) * (7.0 + fi * 1.6), 2.0));
      float along = 0.5 + 0.5 * sin(q.x * 3.0 - uTime * 0.6 + fi);
      col += tint(fi * 0.9) * band * (0.45 + 0.75 * along) * 0.5;
    }
    col *= smoothstep(1.35, 0.1, length(uv));
    col += stars(uv, 0.9985, 1.0);
  `,

  // a sphere of dots, turning, lit from one side
  globe: `
    vec2 p = (uv - uCenter * 0.4) * 1.5;
    float r = length(p);
    float R = 0.62;
    if (r < R) {
      float z = sqrt(max(0.0, R * R - r * r));
      vec3 sp = vec3(p, z) / R;
      float a = uTime * 0.11;
      vec3 rp = vec3(sp.x * cos(a) + sp.z * sin(a), sp.y, -sp.x * sin(a) + sp.z * cos(a));
      float lat = asin(clamp(rp.y, -1.0, 1.0));
      float lon = atan(rp.z, rp.x);
      vec2 cell = fract(vec2(lon * 11.0, lat * 13.0)) - 0.5;
      float dots = smoothstep(0.36, 0.05, length(cell));
      float lit = 0.3 + 0.7 * max(0.0, dot(sp, normalize(vec3(-0.45, 0.45, 0.8))));
      col += tint(lat * 3.0) * dots * lit * 1.1;
      // land-ish blotches so it isn't a bare wireframe
      float land = smoothstep(0.55, 0.78, fbm(vec2(lon * 1.6, lat * 2.4) + 3.0));
      col += mix(uWarm, uCool, 0.35) * land * dots * 0.8;
    }
    // atmosphere
    col += uCool * 0.5 * exp(-pow((r - R) * 9.0, 2.0));
    col += stars(uv, 0.9972, smoothstep(R * 0.9, 1.0, r));
  `,

  // a grid running away to the horizon, above and below
  grid: `
    vec2 p = uv;
    float horizon = 0.06 + uCenter.y * 0.3;
    float d = abs(p.y - horizon);
    float dd = max(d, 0.004);
    vec2 g = vec2(p.x / dd, 1.0 / dd + uTime * 0.55);
    vec2 f = abs(fract(g * 0.5) - 0.5);
    // both sets of lines drawn at a fixed width in grid space, then faded out
    // with distance so the far end doesn't turn into a solid sheet
    float line = max(smoothstep(0.06, 0.0, f.x), smoothstep(0.06, 0.0, f.y));
    float fade = exp(-d * 2.2) * smoothstep(0.0, 0.06, d);
    col += tint(p.x * 2.0) * line * fade * 1.6;
    // the horizon itself glows
    col += mix(uWarm, uCool, 0.5) * 0.35 * exp(-pow(d * 22.0, 2.0));
    col += stars(uv, 0.9986, smoothstep(0.05, 0.6, d));
  `,

  // a soft lit cloud with specks drifting through it
  cloud: `
    vec2 p = uv - uCenter * 0.5;
    float n = fbm(p * 2.1 + vec2(uTime * 0.035, -uTime * 0.02));
    float n2 = fbm(p * 5.0 - vec2(uTime * 0.03, uTime * 0.015));
    float core = exp(-dot(p, p) * 2.4);
    float body = smoothstep(0.38, 0.95, n + core * 0.35);
    col += mix(uWarm, uCool, n2) * body * 0.85;
    col += vec3(1.0, 0.93, 0.86) * core * 0.4;
    // specks caught in the light
    vec2 drift = vec2(uTime * 0.02, uTime * 0.012);
    col += stars(uv + drift, 0.9955, 0.5 + 0.5 * body);
    col *= smoothstep(1.4, 0.15, length(uv));
  `,
};

export function fragmentFor(variant: SceneVariant) {
  return `
${PRELUDE}

  vec3 tint(float k) {
    float w = 0.5 + 0.5 * sin(k);
    vec3 c = mix(uWarm, uCool, w);
    return mix(c, vec3(0.9, 0.9, 0.94), 0.12);
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
    vec3 col = vec3(0.0);

${BODIES[variant]}

    col = max(col, vec3(0.015, 0.014, 0.022));
    gl_FragColor = vec4(col * uFade, 1.0);
  }
`;
}
