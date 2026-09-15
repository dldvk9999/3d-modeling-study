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
  attribute float aForward;
  attribute vec3 aScatter;

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
  uniform float uCamDist;
  uniform float uForwardSpeed;
  uniform float uForwardDist;

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

    // Intro, in three beats:
    //   1. every particle starts loose, scattered through the space
    //   2. they gather (staggered, easing out) until the tree has formed
    //   3. once formed, the tree slowly loosens and starts to flow outward
    float delay = aSeed * 1.6;
    float gather = clamp((uTime - 0.4 - delay) / 3.2, 0.0, 1.0);
    gather = 1.0 - pow(1.0 - gather, 3.0);
    float loosen = smoothstep(4.2, 13.0, uTime);

    // wind: trunks barely move, loose canopy dust drifts a long way
    float t = uTime * 0.09 + aSeed * 6.2831;
    vec3 flow = vec3(
      noise(pos * 0.02 + vec3(t, 0.0, 0.0)),
      noise(pos * 0.024 + vec3(0.0, t, 11.0)),
      noise(pos * 0.019 + vec3(5.0, 0.0, t))
    );
    float spread = aDrift * mix(5.0, 20.0, loosen);
    pos += flow * spread;
    pos.y += sin(uTime * 0.4 + aSeed * 11.0) * aDrift * mix(1.5, 4.0, loosen);

    // the whole tree rocks in slow gusts, more the higher up it is
    float lift = clamp((aHome.y + 20.0) / 80.0, 0.0, 1.0);
    float gust = sin(uTime * 0.5 + aHome.y * 0.03) + 0.5 * sin(uTime * 0.83 + aHome.x * 0.02);
    pos.x += gust * lift * lift * (2.2 + aDrift * 3.5);
    pos.z += cos(uTime * 0.41 + aHome.y * 0.025) * lift * (1.5 + aDrift * 2.0);

    // the tree keeps flowing at the viewer: every particle leaves its home,
    // travels toward the camera, fades, and starts over at home. Phases are
    // staggered so the tree always holds its shape while it streams forward.
    // It only begins once the tree has formed, easing in as it loosens.
    float life = fract(aSeed * 13.7 + uTime * uForwardSpeed / uForwardDist);
    pos.z += life * uForwardDist * aForward * loosen;
    float lifeFade = smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.6, 1.0, life));
    lifeFade = mix(1.0, lifeFade, step(0.001, aForward) * loosen);

    // travel in from the scattered start, curling round the trunk on the way
    vec3 loose = aScatter;
    float curl = (1.0 - gather) * 1.4;
    float cs = cos(curl);
    float sn = sin(curl);
    loose.xz = vec2(loose.x * cs - loose.z * sn, loose.x * sn + loose.z * cs);
    pos = mix(loose, pos, gather);

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
    // sized relative to the camera so points at the ring's plane stay the same
    // size however close the camera sits; nearer ones grow, farther ones shrink
    gl_PointSize = aSize * uPixelRatio * (uCamDist * 1.01 / dist);
    // loose particles read as sparse glints; they fill in as they settle
    float settle = 0.35 + 0.65 * gather;
    vFade = uIntro * settle * lifeFade * (0.62 + 0.38 * (0.5 + 0.5 * sin(uTime * 0.8 + aSeed * 20.0)));
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
    // the soft rim must not write depth, or it would cut halos out of the letters
    if (alpha < 0.18) discard;
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
  const forward: number[] = [];
  const scratch = new THREE.Color();

  const push = (
    x: number,
    y: number,
    z: number,
    hex: string,
    pointSize: number,
    driftAmount: number,
    forwardAmount = 0
  ) => {
    forward.push(forwardAmount);
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

  // --- the tree ----------------------------------------------------------------
  // A single tree stands on the ring's axis (x = 0, z = 0). Its trunk rises
  // through the middle of the ring, so letters swinging round the back pass
  // behind it and letters at the front pass in front of it.
  const treeBudget = Math.round(count * 0.68);

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
        0.06 + rim * 0.35,
        0.55
      );
    }
  };

  {
    const height = worldHeight * 0.92;
    // thick and packed, so it really hides the letters passing behind it
    const trunkRadius = worldHeight * 0.055;
    // the fork sits above the ring, so the words wrap the bare trunk
    const forkY = groundY + height * 0.4;

    const root: [number, number, number] = [0, groundY - 3, 0];
    const fork: [number, number, number] = [1.5, forkY, 0];
    const trunkBend: [number, number, number] = [-1.5, (groundY + forkY) / 2, 0];

    const trunkCount = Math.round(treeBudget * 0.24);
    limb(trunkCount, root, trunkBend, fork, trunkRadius * 1.15, trunkRadius * 0.8, 1);

    // a flared foot so it grows out of the grass instead of standing on it
    const rootCount = Math.round(treeBudget * 0.03);
    for (let i = 0; i < rootCount; i++) {
      const angle = rng() * Math.PI * 2;
      const reach = trunkRadius * (1 + Math.pow(rng(), 1.6) * 2.4);
      push(
        Math.cos(angle) * reach,
        groundY + Math.pow(rng(), 2) * trunkRadius * 1.6,
        Math.sin(angle) * reach,
        pick(TRUNK),
        1.6 + rng() * 2.2,
        0.08,
        0.25
      );
    }

    // limbs fork off the top of the trunk all the way round, each carrying
    // a leaf mass, so the crown has volume from every side as the ring turns
    const limbCount = 9;
    const limbBudget = Math.round(treeBudget * 0.1);
    const canopyRadius = worldHeight * 0.35;
    const masses: { x: number; y: number; z: number; r: number }[] = [];

    for (let l = 0; l < limbCount; l++) {
      const around = (l / limbCount) * Math.PI * 2 + gauss() * 0.2;
      const reach = canopyRadius * (0.75 + rng() * 0.45);
      const tip: [number, number, number] = [
        fork[0] + Math.cos(around) * reach,
        fork[1] + height * (0.14 + rng() * 0.2),
        fork[2] + Math.sin(around) * reach * 0.8,
      ];
      const bend: [number, number, number] = [
        (fork[0] + tip[0]) / 2,
        (fork[1] + tip[1]) / 2 - height * 0.05,
        (fork[2] + tip[2]) / 2,
      ];
      limb(
        Math.round(limbBudget / limbCount),
        fork,
        bend,
        tip,
        trunkRadius * 0.6,
        trunkRadius * 0.2,
        1
      );
      masses.push({
        x: tip[0],
        y: tip[1],
        z: tip[2],
        r: canopyRadius * (0.5 + rng() * 0.3),
      });
    }
    // a crown mass tying the limbs together so the top reads as one tree
    masses.push({ x: fork[0], y: fork[1] + height * 0.4, z: fork[2], r: canopyRadius * 0.85 });

    const canopyCount = treeBudget - trunkCount - rootCount - limbBudget;
    for (let i = 0; i < canopyCount; i++) {
      const mass = masses[(rng() * masses.length) | 0];
      // dense leafy core with a feathered edge that sheds loose dust
      const spread = Math.min(1.3, Math.abs(gauss()) * 0.62);
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(rng() * 2 - 1);
      const r = mass.r * spread;
      const x = mass.x + r * Math.sin(phi) * Math.cos(theta);
      const y = mass.y + r * Math.cos(phi) * 0.7;
      const z = mass.z + r * Math.sin(phi) * Math.sin(theta);
      const roll = rng();
      const hex =
        roll > 0.94
          ? pick(BLOSSOM)
          : roll > 0.87
            ? pick(RUST)
            : spread < 0.25 && rng() < 0.5
              ? pick(LEAF_DEEP)
              : pick(LEAF);
      push(x, y, z, hex, 1.4 + rng() * 2.6, 0.12 + spread * 0.6, 1);
    }
  }

  // --- grass ------------------------------------------------------------------
  const grassCount = Math.round(count * 0.22);
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
    const z = -170 + rng() * 190;
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
  geometry.setAttribute("aForward", new THREE.BufferAttribute(new Float32Array(forward), 1));

  // where each particle starts before it gathers into the scene: a loose,
  // wide cloud around the tree, kept behind the camera's near side
  const total = homeArray.length / 3;
  const scatter = new Float32Array(total * 3);
  for (let i = 0; i < total; i++) {
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(rng() * 2 - 1);
    const r = Math.cbrt(rng());
    scatter[i * 3] = r * Math.sin(phi) * Math.cos(theta) * worldWidth * 0.75;
    scatter[i * 3 + 1] = r * Math.cos(phi) * worldHeight * 0.65 + worldHeight * 0.05;
    scatter[i * 3 + 2] = Math.min(90, r * Math.sin(phi) * Math.sin(theta) * 220);
  }
  geometry.setAttribute("aScatter", new THREE.BufferAttribute(scatter, 3));

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
      uCamDist: { value: 750 },
      // a slow shed: each particle takes about six seconds to drift its full
      // distance toward the viewer before starting over
      uForwardSpeed: { value: 12 },
      uForwardDist: { value: 72 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    // the tree has to occlude the letters that pass behind it
    depthWrite: true,
    depthTest: true,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 1;

  return {
    points,
    material,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
