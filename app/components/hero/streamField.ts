// Dust that keeps flying at the viewer. Each fleck travels from far behind the
// tree toward the camera at a steady speed, swelling and fanning out from the
// vanishing point as it nears, then fades just before reaching the lens and
// re-enters at the far end — so the scene always feels like it's moving forward.

import * as THREE from "three";

const VERT = `
  precision highp float;

  attribute vec3 aHome; // xy spread, z = starting phase along the flight path
  attribute vec3 aColor;
  attribute float aSeed;
  attribute float aSize;

  varying vec3 vColor;
  varying float vFade;

  uniform float uTime;
  uniform float uSpeed;
  uniform float uFar;
  uniform float uNear;
  uniform float uIntro;
  uniform float uPixelRatio;
  uniform float uCamDist;
  uniform sampler2D uFluid;
  uniform float uFluidInfluence;

  void main() {
    vColor = aColor;

    float range = uNear - uFar;
    float phase = fract(aHome.z + uTime * uSpeed / range);
    vec3 pos = vec3(aHome.xy, uFar + phase * range);

    // a little tumble so they don't fly in perfectly straight lines
    pos.x += sin(uTime * 0.5 + aSeed * 23.0) * 2.4;
    pos.y += cos(uTime * 0.42 + aSeed * 17.0) * 2.0;

    vec4 world = modelViewMatrix * vec4(pos, 1.0);
    vec4 clip = projectionMatrix * world;
    vec2 screenUv = clip.xy / clip.w * 0.5 + 0.5;
    vec2 vel = texture2D(uFluid, screenUv).xy;
    world.xy += vel * uFluidInfluence;
    gl_Position = projectionMatrix * world;

    float dist = max(-world.z, 1.0);
    gl_PointSize = min(aSize * uPixelRatio * (uCamDist / dist), 30.0 * uPixelRatio);

    // fade in out of the distance, fade out just before hitting the lens
    vFade = uIntro * smoothstep(0.0, 0.18, phase) * (1.0 - smoothstep(0.86, 0.99, phase));
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
    float alpha = smoothstep(0.25, 0.04, r) * vFade;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

const PALETTE = [
  "#5d9a45",
  "#84bd64",
  "#a8d888",
  "#f0b7d6",
  "#f8d9ea",
  "#ffffff",
  "#cfc7e0",
  "#e6c9f2",
  "#8d5a3a",
];

export type StreamField = {
  points: THREE.Points;
  material: THREE.ShaderMaterial;
  dispose: () => void;
};

export function createStreamField(
  count: number,
  worldWidth: number,
  worldHeight: number,
  cameraDistance: number,
  fluidTexture: THREE.Texture
): StreamField {
  const home = new Float32Array(count * 3);
  const color = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const size = new Float32Array(count);
  const scratch = new THREE.Color();

  for (let i = 0; i < count; i++) {
    // wide enough that the far end fills the frame; perspective does the fanning
    home[i * 3] = (Math.random() - 0.5) * worldWidth * 1.6;
    home[i * 3 + 1] = (Math.random() - 0.5) * worldHeight * 1.4;
    home[i * 3 + 2] = Math.random();

    scratch.set(PALETTE[(Math.random() * PALETTE.length) | 0]);
    const shade = 0.75 + Math.random() * 0.4;
    color[i * 3] = Math.min(1, scratch.r * shade);
    color[i * 3 + 1] = Math.min(1, scratch.g * shade);
    color[i * 3 + 2] = Math.min(1, scratch.b * shade);

    seed[i] = Math.random();
    size[i] = 1.5 + Math.random() * 3;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(home, 3));
  geometry.setAttribute("aHome", new THREE.BufferAttribute(home, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(size, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: 55 },
      uFar: { value: -460 },
      uNear: { value: cameraDistance - 20 },
      uIntro: { value: 0 },
      uPixelRatio: { value: 1 },
      uCamDist: { value: cameraDistance },
      uFluid: { value: fluidTexture },
      uFluidInfluence: { value: 0 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    // hidden by the tree when behind it, but never punches holes of its own
    depthTest: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 3;

  return {
    points,
    material,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
