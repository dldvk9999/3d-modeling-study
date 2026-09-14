// The scene isn't painted — it's grown out of particles. Trunks, canopies and
// grass are each seeded as clusters, so the field reads as a grove that happens
// to be made of dust rather than a dust cloud that happens to look like one.

import * as THREE from "three";

const VERT = `
  precision highp float;

  attribute vec3 aHome;
  attribute vec3 aColor;
  attribute float aSeed;
  attribute float aSize;
  attribute float aDrift;

  varying vec3 vColor;
  varying float vFade;

  uniform float uTime;
  uniform float uIntro;
  uniform float uPixelRatio;
  uniform sampler2D uFluid;
  uniform float uFluidInfluence;
  uniform float uRingRadius;
  uniform float uRingTilt;
  uniform float uRingPush;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  }
  float noise(vec3 v) {
    vec3 i = floor(v);
    vec3 f = fract(v);
    vec3 w = f * f * (3.0 - 2.0 * f);
    float n000 = hash(i);
    float n100 = hash(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash(i + vec3(1.0, 1.0, 1.0));
    float x00 = mix(n000, n100, w.x);
    float x10 = mix(n010, n110, w.x);
    float x01 = mix(n001, n101, w.x);
    float x11 = mix(n011, n111, w.x);
    return mix(mix(x00, x10, w.y), mix(x01, x11, w.y), w.z) * 2.0 - 1.0;
  }

  void main() {
    vColor = aColor;
    vec3 pos = aHome;

    // wind: trunks barely move, loose canopy dust drifts a long way
    float t = uTime * 0.07 + aSeed * 6.2831;
    vec3 flow = vec3(
      noise(pos * 0.02 + vec3(t, 0.0, 0.0)),
      noise(pos * 0.024 + vec3(0.0, t, 11.0)),
      noise(pos * 0.019 + vec3(5.0, 0.0, t))
    );
    float spread = aDrift * mix(30.0, 9.0, uIntro);
    pos += flow * spread;
    pos.y += sin(uTime * 0.3 + aSeed * 11.0) * aDrift * 2.2;

    // the text ring pushes the field away from its tube
    vec3 ringSpace = pos;
    float c = cos(-uRingTilt);
    float s = sin(-uRingTilt);
    ringSpace.yz = vec2(ringSpace.y * c - ringSpace.z * s, ringSpace.y * s + ringSpace.z * c);
    float radial = length(ringSpace.xz);
    vec2 toTube = vec2(radial - uRingRadius, ringSpace.y);
    float tubeDist = length(toTube);
    float push = uRingPush * exp(-tubeDist * tubeDist / 380.0);
    if (radial > 0.001 && tubeDist > 0.001) {
      vec3 outward = vec3(ringSpace.x / radial, 0.0, ringSpace.z / radial);
      vec3 pushVec = outward * (toTube.x / tubeDist) * push;
      pushVec.y += (toTube.y / tubeDist) * push;
      pushVec.yz = vec2(pushVec.y * c + pushVec.z * s, -pushVec.y * s + pushVec.z * c);
      pos += pushVec;
    }

    vec4 world = modelViewMatrix * vec4(pos, 1.0);
    vec4 clip = projectionMatrix * world;
    vec2 screenUv = clip.xy / clip.w * 0.5 + 0.5;
    vec2 vel = texture2D(uFluid, screenUv).xy;
    world.xy += vel * uFluidInfluence * (0.45 + aDrift);
    world.z += (vel.x + vel.y) * uFluidInfluence * 0.25;

    gl_Position = projectionMatrix * world;

    float dist = max(-world.z, 1.0);
    gl_PointSize = aSize * uPixelRatio * (640.0 / dist);
    vFade = uIntro * (0.62 + 0.38 * (0.5 + 0.5 * sin(uTime * 0.8 + aSeed * 20.0)));
  }
`;

const FRAG = `
  precision highp float;
  varying vec3 vColor;
  varying float vFade;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = dot(d, d);
    if (r > 0.25) discard;
    float alpha = smoothstep(0.25, 0.03, r) * vFade;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

export type ParticleField = {
  points: THREE.Points;
  material: THREE.ShaderMaterial;
  dispose: () => void;
};

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TRUNK = ["#2b3a22", "#1d2916", "#3c4a2c", "#4a4032"];
const LEAF = ["#3f7a30", "#5d9a45", "#84bd64", "#a8d888", "#6f9a4a"];
const LEAF_DEEP = ["#1f3d1a", "#2f5f26", "#34502a", "#445a30"];
const RUST = ["#7a4a30", "#8d5a3a", "#a26a4a"];
const BLOSSOM = ["#f0b7d6", "#f8d9ea", "#ffffff", "#e6c9f2"];
const GRASS = ["#356b34", "#4c8a41", "#6fae57", "#96cf72", "#c2e79b"];
const HAZE = ["#cfc7e0", "#e6dcec", "#b9b2cc", "#f2dfea"];

export function createParticleField(
  count: number,
  worldWidth: number,
  worldHeight: number,
  fluidTexture: THREE.Texture
): ParticleField {
  const rng = mulberry32(0x5eed26);
  const gauss = () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const pick = (list: string[]) => list[(rng() * list.length) | 0];

  const home: number[] = [];
  const color: number[] = [];
  const seed: number[] = [];
  const size: number[] = [];
  const drift: number[] = [];
  const scratch = new THREE.Color();

  const push = (
    x: number,
    y: number,
    z: number,
    hex: string,
    pointSize: number,
    driftAmount: number
  ) => {
    home.push(x, y, z);
    scratch.set(hex);
    const shade = 0.72 + rng() * 0.5;
    color.push(
      Math.min(1, scratch.r * shade),
      Math.min(1, scratch.g * shade),
      Math.min(1, scratch.b * shade)
    );
    seed.push(rng());
    size.push(pointSize);
    drift.push(driftAmount);
  };

  const groundY = -worldHeight * 0.2;

  // --- the grove -------------------------------------------------------------
  const trees = [
    { x: -0.46, z: -110, scale: 0.82 },
    { x: -0.29, z: -30, scale: 1.05 },
    { x: -0.08, z: -130, scale: 0.78 },
    { x: 0.08, z: 10, scale: 1.12 },
    { x: 0.27, z: -80, scale: 0.9 },
    { x: 0.45, z: -20, scale: 1.0 },
    { x: 0.6, z: -140, scale: 0.72 },
  ];

  const treeBudget = Math.round(count * 0.64);
  const perTree = Math.round(treeBudget / trees.length);

  // a quadratic curve from a to b bowed through c — used for trunks and limbs
  const along = (
    t: number,
    a: [number, number, number],
    c: [number, number, number],
    b: [number, number, number]
  ): [number, number, number] => {
    const u = 1 - t;
    return [
      u * u * a[0] + 2 * u * t * c[0] + t * t * b[0],
      u * u * a[1] + 2 * u * t * c[1] + t * t * b[1],
      u * u * a[2] + 2 * u * t * c[2] + t * t * b[2],
    ];
  };

  const limb = (
    n: number,
    a: [number, number, number],
    c: [number, number, number],
    b: [number, number, number],
    r0: number,
    r1: number,
    bias: number
  ) => {
    for (let i = 0; i < n; i++) {
      const t = Math.pow(rng(), bias);
      const [x, y, z] = along(t, a, c, b);
      const rim = Math.pow(rng(), 0.7);
      const radius = (r0 + (r1 - r0) * t) * (0.3 + rim * 1.5);
      const angle = rng() * Math.PI * 2;
      push(
        x + Math.cos(angle) * radius,
        y + gauss() * r0 * 0.25,
        z + Math.sin(angle) * radius * 1.2,
        rim > 0.9 ? pick(LEAF) : pick(TRUNK),
        1.5 + rng() * 2.3,
        0.06 + rim * 0.35
      );
    }
  };

  for (const tree of trees) {
    const baseX = tree.x * worldWidth + gauss() * 3;
    const baseZ = tree.z;
    const height = worldHeight * (0.74 + rng() * 0.14) * tree.scale;
    const trunkRadius = worldWidth * 0.012 * tree.scale;
    const lean = gauss() * 5 * tree.scale;
    const forkY = groundY + height * (0.42 + rng() * 0.1);

    const root: [number, number, number] = [baseX, groundY - 2, baseZ];
    const fork: [number, number, number] = [baseX + lean, forkY, baseZ];
    const trunkBend: [number, number, number] = [baseX - lean * 0.6, (groundY + forkY) / 2, baseZ];

    const trunkCount = Math.round(perTree * 0.2);
    limb(trunkCount, root, trunkBend, fork, trunkRadius * 1.25, trunkRadius * 0.85, 0.85);

    // limbs fork off the top of the trunk and each one carries a leaf mass
    const limbCount = 3 + ((rng() * 3) | 0);
    const limbBudget = Math.round(perTree * 0.12);
    const canopyRadius = worldWidth * 0.1 * tree.scale;
    const masses: { x: number; y: number; z: number; r: number }[] = [];

    for (let l = 0; l < limbCount; l++) {
      const spreadAngle = ((l / Math.max(1, limbCount - 1)) - 0.5) * 2.1 + gauss() * 0.25;
      const reach = canopyRadius * (0.7 + rng() * 0.6);
      const tip: [number, number, number] = [
        fork[0] + Math.sin(spreadAngle) * reach,
        fork[1] + height * (0.24 + rng() * 0.2) * Math.cos(spreadAngle * 0.6),
        fork[2] + gauss() * reach * 0.5,
      ];
      const bend: [number, number, number] = [
        (fork[0] + tip[0]) / 2 + Math.sin(spreadAngle) * reach * 0.15,
        (fork[1] + tip[1]) / 2 - height * 0.04,
        (fork[2] + tip[2]) / 2,
      ];
      limb(
        Math.round(limbBudget / limbCount),
        fork,
        bend,
        tip,
        trunkRadius * 0.7,
        trunkRadius * 0.25,
        1
      );
      masses.push({
        x: tip[0],
        y: tip[1],
        z: tip[2],
        r: canopyRadius * (0.55 + rng() * 0.35),
      });
    }
    // a crown mass tying the limbs together so the top reads as one tree
    masses.push({
      x: fork[0] + lean * 0.4,
      y: fork[1] + height * 0.36,
      z: fork[2],
      r: canopyRadius * 0.95,
    });

    const canopyCount = perTree - trunkCount - limbBudget;
    // warm/cool bias per tree so neighbours don't all read the same green
    const warmth = rng();
    for (let i = 0; i < canopyCount; i++) {
      const mass = masses[(rng() * masses.length) | 0];
      // dense leafy core with a feathered edge that sheds loose dust
      const spread = Math.min(1.3, Math.abs(gauss()) * 0.68);
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(rng() * 2 - 1);
      const r = mass.r * spread;
      const x = mass.x + r * Math.sin(phi) * Math.cos(theta);
      const y = mass.y + r * Math.cos(phi) * 0.72;
      const z = mass.z + r * Math.sin(phi) * Math.sin(theta) * 0.8;
      const roll = rng();
      const hex =
        roll > 0.94
          ? pick(BLOSSOM)
          : roll > 0.9 - warmth * 0.08
            ? pick(RUST)
            : spread < 0.25 && rng() < 0.5
              ? pick(LEAF_DEEP)
              : pick(LEAF);
      push(x, y, z, hex, 1.4 + rng() * 2.6, 0.12 + spread * 0.6);
    }
  }

  // --- grass ------------------------------------------------------------------
  const grassCount = Math.round(count * 0.24);
  for (let i = 0; i < grassCount; i++) {
    const t = Math.pow(rng(), 1.7); // packed at the horizon, thinning downward
    const y = groundY + worldHeight * 0.05 - t * worldHeight * 0.52;
    const x = (rng() - 0.5) * worldWidth * 1.15;
    const z = -160 + rng() * 200;
    const blade = rng();
    push(
      x,
      y + gauss() * 1.4,
      z,
      blade > 0.96 ? pick(BLOSSOM) : pick(GRASS),
      1.3 + rng() * 2.6,
      0.1 + rng() * 0.35
    );
  }

  // --- haze that fills the sky -------------------------------------------------
  const hazeCount = count - home.length / 3;
  for (let i = 0; i < hazeCount; i++) {
    const x = (rng() - 0.5) * worldWidth * 1.2;
    const y = groundY + Math.pow(rng(), 0.7) * worldHeight * 0.95;
    const z = -180 + rng() * 240;
    const roll = rng();
    // the sky dust stays pale so it lifts off the gradient instead of speckling it dark
    push(
      x,
      y,
      z,
      roll > 0.92 ? pick(LEAF) : roll > 0.7 ? pick(BLOSSOM) : pick(HAZE),
      0.8 + rng() * 1.5,
      0.5 + rng() * 0.6
    );
  }

  const geometry = new THREE.BufferGeometry();
  const homeArray = new Float32Array(home);
  geometry.setAttribute("position", new THREE.BufferAttribute(homeArray, 3));
  geometry.setAttribute("aHome", new THREE.BufferAttribute(homeArray, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(color), 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(seed), 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(size), 1));
  geometry.setAttribute("aDrift", new THREE.BufferAttribute(new Float32Array(drift), 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntro: { value: 0 },
      uPixelRatio: { value: 1 },
      uFluid: { value: fluidTexture },
      uFluidInfluence: { value: 0 },
      uRingRadius: { value: 45 },
      uRingTilt: { value: (-8 * Math.PI) / 180 },
      uRingPush: { value: 7 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  return {
    points,
    material,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
