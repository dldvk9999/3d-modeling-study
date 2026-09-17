// The dust in front of the streaks. The original loads a captured point cloud
// — a row of interface cards stepping away into depth — and then runs it on a
// "conveyor": every point is slid along the depth axis by its own random phase
// and keeps sliding towards the camera, fading in and out at the ends. Only the
// cards' outlines survive that, drawn out into faint lines down the tunnel.
//
// We build a cloud of the same shape and proportions and run the same shader.

import * as THREE from "three";
import { POINT_CLOUD } from "./preset";

// the original capture's bounds, before the loader rescales it
const BOUNDS = {
  min: [-5.478, -1.108, -2.904],
  max: [2.132, 1.797, 4.061],
};

type Card = {
  cx: number;
  cy: number;
  cz: number;
  w: number;
  h: number;
  tint: [number, number, number];
};

function roundedRectPoint(
  card: Card,
  radius: number,
  rand: () => number,
): [number, number] {
  // walk the perimeter: straight edges plus quarter circles in the corners
  const hw = card.w / 2 - radius;
  const hh = card.h / 2 - radius;
  const straight = 4 * (hw + hh);
  const arcs = 2 * Math.PI * radius;
  let s = rand() * (straight + arcs);
  const edges: [number, number, number, number, number][] = [
    // length, x0, y0, dx, dy
    [2 * hw, -hw, card.h / 2, 1, 0],
    [2 * hh, card.w / 2, hh, 0, -1],
    [2 * hw, hw, -card.h / 2, -1, 0],
    [2 * hh, -card.w / 2, -hh, 0, 1],
  ];
  for (const [length, x0, y0, dx, dy] of edges) {
    if (s < length) return [card.cx + x0 + dx * s, card.cy + y0 + dy * s];
    s -= length;
  }
  const corners: [number, number][] = [
    [hw, hh],
    [hw, -hh],
    [-hw, -hh],
    [-hw, hh],
  ];
  const which = Math.floor(rand() * 4);
  const a = rand() * Math.PI * 0.5 + (Math.PI * 0.5) * -which;
  const [ox, oy] = corners[which];
  return [card.cx + ox + Math.cos(a) * radius, card.cy + oy + Math.sin(a) * radius];
}

export function buildCardCloud(count: number, seed = 7) {
  let state = seed;
  const rand = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };

  // cards step from front-left to back-right, the way the capture does
  const cards: Card[] = [];
  const cardCount = 7;
  for (let i = 0; i < cardCount; i++) {
    const t = i / (cardCount - 1);
    const teal = i === 3 || i === 4;
    cards.push({
      cx: -4.3 + t * 5.5,
      cy: 0.3 + Math.sin(t * 2.6) * 0.3,
      cz: -2.3 + t * 5.6,
      w: 2.2 - t * 0.35,
      h: 1.55 - t * 0.2,
      tint: teal ? [0.62, 0.92, 0.84] : [1.0, 0.91, 0.76],
    });
  }

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const randoms = new Float32Array(count * 4);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const card = cards[Math.floor(rand() * cardCount)];
    const roll = rand();
    let x: number;
    let y: number;
    let bright: number;

    if (roll < 0.46) {
      // outline
      [x, y] = roundedRectPoint(card, 0.16, rand);
      x += (rand() - 0.5) * 0.04;
      y += (rand() - 0.5) * 0.04;
      bright = 0.8 + rand() * 0.2;
    } else if (roll < 0.58) {
      // the round avatar / button in the corner of each card
      const a = rand() * Math.PI * 2;
      const r = 0.2 + (rand() - 0.5) * 0.03;
      x = card.cx - card.w * 0.28 + Math.cos(a) * r;
      y = card.cy + card.h * 0.12 + Math.sin(a) * r;
      bright = 0.75 + rand() * 0.25;
    } else if (roll < 0.72) {
      // a couple of lines of text
      const line = Math.floor(rand() * 3);
      const length = [0.9, 0.7, 0.5][line];
      x = card.cx - card.w * 0.05 + rand() * length;
      y = card.cy + card.h * 0.2 - line * 0.22 + (rand() - 0.5) * 0.03;
      bright = 0.5 + rand() * 0.3;
    } else {
      // the sparse face of the card
      x = card.cx + (rand() - 0.5) * card.w;
      y = card.cy + (rand() - 0.5) * card.h;
      bright = 0.18 + rand() * 0.3;
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = card.cz + (rand() - 0.5) * 0.18;

    const grain = 0.85 + rand() * 0.15;
    colors[i * 3] = card.tint[0] * bright * grain;
    colors[i * 3 + 1] = card.tint[1] * bright * grain;
    colors[i * 3 + 2] = card.tint[2] * bright * grain;

    randoms[i * 4] = rand();
    randoms[i * 4 + 1] = rand();
    randoms[i * 4 + 2] = rand();
    randoms[i * 4 + 3] = rand();
    sizes[i] = rand();
  }

  // fit it into the loader's box, centred, like the original capture
  const size = [0, 1, 2].map((k) => BOUNDS.max[k] - BOUNDS.min[k]);
  const centre = [0, 1, 2].map((k) => (BOUNDS.max[k] + BOUNDS.min[k]) / 2);
  const fit = POINT_CLOUD.normalizedExtent / Math.max(...size);
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 3; k++) {
      positions[i * 3 + k] = (positions[i * 3 + k] - centre[k]) * fit;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 4));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  return geometry;
}

const VERT = `
  uniform float uTime;
  uniform float uPointSize;
  uniform float uMaxPointSize;
  uniform float uDPR;
  uniform vec3 uRandomize;
  uniform float uCamFadeNear;
  uniform float uCamFadeFar;
  uniform float uConveyorSpeed;
  uniform float uConveyorDepth;
  uniform float uConveyorNear;
  uniform float uConveyorFar;
  uniform sampler2D uFluid;
  uniform float uFluidInfluence;

  attribute vec3 color;
  attribute vec4 aRandom;
  attribute float aSize;

  varying vec3 vColor;
  varying vec3 vWorldPosition;
  varying float vCameraFade;
  varying float vSparkleSeed;

  const float CONVEYOR_SPEED_SCALE = 0.6;

  void main() {
    vSparkleSeed = fract(aRandom.x * 17.13 + aRandom.y * 3.71 + aRandom.z * 11.47);
    vec3 pos = position;
    pos += (aRandom.xyz * 2.0 - 1.0) * uRandomize;
    pos.y += sin(uTime * 0.18 + aRandom.x * 12.0) * 0.006;

    // the conveyor: slide every point down the depth axis on its own phase
    vec4 preFlow = viewMatrix * modelMatrix * vec4(pos, 1.0);
    float speed = uConveyorSpeed * CONVEYOR_SPEED_SCALE;
    float direction = speed >= 0.0 ? 1.0 : -1.0;
    float phase = fract(aRandom.x + uTime * abs(speed) / uConveyorDepth);
    float life = 1.0 - smoothstep(0.25, 0.5, abs(phase - 0.5));
    float flowMask = smoothstep(uConveyorFar, uConveyorNear, max(-preFlow.z, 0.001));
    float conveyor = (phase - 0.5) * uConveyorDepth * direction * flowMask;

    vec4 world = modelMatrix * vec4(pos, 1.0);
    world.xyz += normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0)) * conveyor;
    vec4 mv = viewMatrix * world;
    vWorldPosition = world.xyz;

    vec4 clip = projectionMatrix * mv;
    vec2 screenUv = clamp(clip.xy / max(clip.w, 0.0001) * 0.5 + 0.5, 0.0, 1.0);
    vec2 fluidVel = texture2D(uFluid, screenUv).xy;
    float depthAtten = 1.0 / (1.0 + max(-mv.z, 0.0) * 0.3);
    mv.xy += fluidVel * uFluidInfluence * 0.02 * depthAtten;

    float dist = length(mv.xyz);
    vCameraFade = 1.0 - smoothstep(uCamFadeNear, max(uCamFadeFar, uCamFadeNear + 0.0001), dist);
    vColor = color;

    float baseSize = mix(0.6, 1.6, pow(aRandom.z, 4.0));
    baseSize *= mix(1.0, mix(0.65, 1.35, aSize), 0.3);
    baseSize *= life;
    float ps = uPointSize * baseSize * uDPR * (120.0 / max(dist, 0.1));
    gl_PointSize = clamp(ps, 0.0, uMaxPointSize);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = `
  precision highp float;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uLoadFade;
  uniform float uCausticsStrength;
  uniform float uCausticsScale;
  uniform float uCausticsPower;
  uniform vec3 uCausticsAxisScale;
  uniform vec3 uCausticsSpeed;
  uniform vec3 uCausticsColor;

  varying vec3 vColor;
  varying vec3 vWorldPosition;
  varying float vCameraFade;
  varying float vSparkleSeed;

  float dotNoise(vec3 p) {
    const float PHI = 1.618033988;
    const mat3 GOLD = mat3(
      -0.571464913, 0.814921382, 0.096597072,
      -0.278044873, -0.303026659, 0.911518454,
      0.772087367, 0.494042493, 0.399753815
    );
    return dot(cos(GOLD * p), sin(PHI * p * GOLD));
  }

  // bright rippling light slides through the cloud, like light under water
  float caustics(vec3 worldPos) {
    vec3 p = worldPos * uCausticsScale * uCausticsAxisScale;
    vec3 drift = uTime * uCausticsSpeed;
    float n1 = dotNoise(p + drift);
    float n2 = dotNoise(p * 1.73 + vec3(-drift.y, drift.z, -drift.x));
    float n3 = dotNoise(p * 3.11 + vec3(drift.z, -drift.x, drift.y));
    float ridges = max(0.0, 1.0 - min(min(abs(n1), abs(n2)), abs(n3)) * 1.7);
    float crossings = max(0.0, 1.0 - abs(n1 + n2 * 0.55 - n3 * 0.35) * 1.15);
    return pow(clamp(ridges * 0.82 + crossings * 0.28, 0.0, 1.0), uCausticsPower);
  }

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r2 = dot(uv, uv);
    if (r2 > 0.25) discard;

    vec3 color = vColor;
    float pointMask = 0.55 + 0.45 * smoothstep(0.25, 0.0, r2);
    color += uCausticsColor * caustics(vWorldPosition) * uCausticsStrength * pointMask;

    float alpha = uOpacity * vCameraFade * uLoadFade;
    gl_FragColor = vec4(clamp(color, 0.0, 1.0), alpha);
  }
`;

export type CardCloud = {
  points: THREE.Points;
  update: (opts: {
    time: number;
    dpr: number;
    loadFade: number;
    fluid: THREE.Texture;
  }) => void;
  dispose: () => void;
};

export function createCardCloud(count: number): CardCloud {
  const settings = POINT_CLOUD;
  const geometry = buildCardCloud(count);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPointSize: { value: settings.pointSize },
      uMaxPointSize: { value: settings.maxPointSize },
      uDPR: { value: 1 },
      uOpacity: { value: settings.opacity },
      uLoadFade: { value: 0 },
      uRandomize: { value: new THREE.Vector3(...settings.randomize) },
      uCamFadeNear: { value: settings.cameraFade.near },
      uCamFadeFar: { value: settings.cameraFade.far },
      uConveyorSpeed: { value: settings.conveyor.speed },
      uConveyorDepth: { value: settings.conveyor.depth },
      uConveyorNear: { value: settings.conveyor.near },
      uConveyorFar: { value: settings.conveyor.far },
      uFluid: { value: null },
      uFluidInfluence: { value: settings.fluidInfluence },
      uCausticsStrength: { value: settings.caustics.strength },
      uCausticsScale: { value: settings.caustics.scale },
      uCausticsPower: { value: settings.caustics.power },
      uCausticsAxisScale: { value: new THREE.Vector3(...settings.caustics.axisScale) },
      uCausticsSpeed: { value: new THREE.Vector3(...settings.caustics.speed) },
      uCausticsColor: { value: new THREE.Vector3(...settings.caustics.color) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.position.set(...settings.position);
  points.scale.setScalar(settings.scale);

  return {
    points,
    update({ time, dpr, loadFade, fluid }) {
      material.uniforms.uTime.value = time;
      material.uniforms.uDPR.value = dpr;
      material.uniforms.uLoadFade.value = loadFade;
      material.uniforms.uFluid.value = fluid;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
