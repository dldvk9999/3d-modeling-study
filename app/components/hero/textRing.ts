// "Everywhere" laid out three times around a 360° ring, ported from the
// parameters the original scene runs on.

import * as THREE from "three";

export const RING = {
  radiusVmin: 45,
  letterSizeRatio: 0.38,
  // negative so the front of the ring reads above its mirrored far side
  tiltDeg: -8,
  fromDeg: 102,
  toDeg: -295,
  introDurationMs: 4500,
  introBezier: [0.2, 0.9, 0.3, 0.986] as const,
  ambientDurationMs: 100000,
  introDelayMs: 400,
  scrollSpinDegPerPx: 0.12,
  scrollYPerPx: 0.01,
  pointerRepulseStrength: 2.5,
  pointerXRotationDeg: 18,
  pointerXRotationDamping: 8,
  wordStaggerMs: 600,
  letterStaggerMs: 55,
  slideDurationMs: 650,
  wipeDurationMs: 300,
  revealSweepDeg: 14,
  letterColor: "#ffffff",
  ascender: 0.983,
  descender: -0.263,
};

const DEG = Math.PI / 180;
const WORD_COUNT = 3;

const LETTERS = [
  { char: "E", trackingEm: -0.08 },
  { char: "v", trackingEm: -0.08 },
  { char: "e", trackingEm: -0.08 },
  { char: "r", trackingEm: -0.03 },
  { char: "y", trackingEm: -0.04 },
  { char: "w", trackingEm: -0.08 },
  { char: "h", trackingEm: -0.08 },
  { char: "e", trackingEm: -0.08 },
  { char: "r", trackingEm: -0.08 },
  { char: "e", trackingEm: -0.08 },
];

export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-6) return t;
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    return t;
  };
  return (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solve(x)));
}

const GLYPH_VERT = `
  varying vec2 vUv;
  uniform sampler2D uFluid;
  uniform float uFluidInfluence;
  void main() {
    vUv = uv;
    vec4 world = modelViewMatrix * vec4(position, 1.0);
    vec4 clip = projectionMatrix * world;
    vec2 screenUv = clip.xy / clip.w * 0.5 + 0.5;
    vec2 vel = texture2D(uFluid, screenUv).xy;
    world.xy += vel * uFluidInfluence;
    gl_Position = projectionMatrix * world;
  }
`;

const GLYPH_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uGlyph;
  uniform vec3 uColor;
  uniform float uReveal;
  uniform float uOpacity;
  void main() {
    float mask = texture2D(uGlyph, vUv).a;
    float wipe = smoothstep(uReveal - 0.22, uReveal + 0.02, vUv.x);
    float alpha = mask * (1.0 - wipe) * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

type Glyph = {
  group: THREE.Group;
  material: THREE.ShaderMaterial;
  resting: number;
  wordIndex: number;
  letterIndex: number;
};

function glyphTexture(char: string, fontFamily: string) {
  const EM = 256;
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = `600 ${EM}px ${fontFamily}`;
  const advance = measure.measureText(char).width / EM;

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(EM * 1.5);
  canvas.height = Math.ceil(EM * 1.7);
  const ctx = canvas.getContext("2d")!;
  const baseline = Math.round(EM * 1.2);
  ctx.font = `600 ${EM}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  ctx.fillText(char, canvas.width / 2, baseline);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  return {
    texture,
    advance,
    widthEm: canvas.width / EM,
    heightEm: canvas.height / EM,
    baselineEm: baseline / EM,
  };
}

function restingAngles(widthsDeg: number[]) {
  const total = widthsDeg.reduce((a, b) => a + b, 0);
  const gap = (360 - total) / WORD_COUNT;
  const angles: number[] = [];
  let cursor = gap / 2;
  let i = 0;
  for (let w = 0; w < WORD_COUNT; w++) {
    for (let l = 0; l < LETTERS.length; l++) {
      angles[i] = cursor + widthsDeg[i] / 2;
      cursor += widthsDeg[i];
      i += 1;
    }
    cursor += gap;
  }
  return angles;
}

export type TextRing = {
  tiltGroup: THREE.Group;
  spinGroup: THREE.Group;
  angleAt: (elapsedMs: number) => number;
  update: (elapsedMs: number, fluid: THREE.Texture, influence: number, opacity: number) => void;
  dispose: () => void;
};

export function createTextRing(fontFamily: string, fluidTexture: THREE.Texture): TextRing {
  const tiltGroup = new THREE.Group();
  tiltGroup.rotation.x = RING.tiltDeg * DEG;
  const spinGroup = new THREE.Group();
  tiltGroup.add(spinGroup);

  const S = RING.radiusVmin * RING.letterSizeRatio; // world units per em
  const verticalCenter = ((RING.ascender + RING.descender) / 2) * S;

  const cache = new Map<string, ReturnType<typeof glyphTexture>>();
  const atlas = (char: string) => {
    let entry = cache.get(char);
    if (!entry) {
      entry = glyphTexture(char, fontFamily);
      cache.set(char, entry);
    }
    return entry;
  };

  const flat = Array.from({ length: WORD_COUNT }, (_, wordIndex) =>
    LETTERS.map((letter, letterIndex) => ({ ...letter, wordIndex, letterIndex }))
  ).flat();

  const widthsDeg = flat.map(({ char, trackingEm }) => {
    const { advance } = atlas(char);
    return (advance + trackingEm) * RING.letterSizeRatio * (180 / Math.PI);
  });
  const angles = restingAngles(widthsDeg);

  const glyphs: Glyph[] = flat.map((letter, i) => {
    const entry = atlas(letter.char);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uGlyph: { value: entry.texture },
        uColor: { value: new THREE.Color(RING.letterColor) },
        uReveal: { value: 0 },
        uOpacity: { value: 1 },
        uFluid: { value: fluidTexture },
        uFluidInfluence: { value: 0 },
      },
      vertexShader: GLYPH_VERT,
      fragmentShader: GLYPH_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const geometry = new THREE.PlaneGeometry(entry.widthEm * S, entry.heightEm * S, 6, 6);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    // put the glyph's baseline on the ring plane, then lift by the font's mid-line
    const centerAboveBaseline = (entry.baselineEm - entry.heightEm / 2) * S;
    mesh.position.set(0, centerAboveBaseline - verticalCenter, RING.radiusVmin);

    const group = new THREE.Group();
    group.add(mesh);
    group.rotation.y = (angles[i] - RING.revealSweepDeg) * DEG;
    spinGroup.add(group);

    return {
      group,
      material,
      resting: angles[i],
      wordIndex: letter.wordIndex,
      letterIndex: letter.letterIndex,
    };
  });

  const introEase = cubicBezier(...RING.introBezier);
  const revealEase = cubicBezier(0, 0, 0.58, 1);

  const ringAngleAt = (elapsedMs: number) => {
    const t = elapsedMs - RING.introDelayMs;
    if (t <= 0) return RING.fromDeg;
    if (t < RING.introDurationMs) {
      return RING.fromDeg + (RING.toDeg - RING.fromDeg) * introEase(t / RING.introDurationMs);
    }
    return RING.toDeg - 360 * ((t - RING.introDurationMs) / RING.ambientDurationMs);
  };

  return {
    tiltGroup,
    spinGroup,
    angleAt: ringAngleAt,
    update(elapsedMs, fluid, influence, opacity) {
      for (const glyph of glyphs) {
        const wordStart = RING.introDelayMs + glyph.wordIndex * RING.wordStaggerMs;
        const since = elapsedMs - wordStart;
        const slide =
          since <= 0
            ? -RING.revealSweepDeg
            : since < RING.slideDurationMs
              ? -RING.revealSweepDeg * (1 - revealEase(since / RING.slideDurationMs))
              : 0;
        glyph.group.rotation.y = (glyph.resting + slide) * DEG;

        const wipeSince = elapsedMs - (wordStart + glyph.letterIndex * RING.letterStaggerMs);
        glyph.material.uniforms.uReveal.value =
          wipeSince <= 0
            ? 0
            : wipeSince < RING.wipeDurationMs
              ? revealEase(wipeSince / RING.wipeDurationMs)
              : 1;
        glyph.material.uniforms.uOpacity.value = opacity;
        glyph.material.uniforms.uFluid.value = fluid;
        glyph.material.uniforms.uFluidInfluence.value = influence;
      }
    },
    dispose() {
      for (const glyph of glyphs) {
        glyph.group.traverse((child) => {
          if (child instanceof THREE.Mesh) child.geometry.dispose();
        });
        glyph.material.dispose();
      }
      cache.forEach((entry) => entry.texture.dispose());
    },
  };
}
