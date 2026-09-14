// The wash behind the particles: no drawing, just a few soft gradients —
// mauve sky, a blossom-colored bloom, and green ground rising from the bottom.

import * as THREE from "three";

const VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = `
  precision highp float;
  varying vec2 vUv;

  uniform vec3 uSkyTop;
  uniform vec3 uSkyMid;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uGroundDeep;
  uniform vec3 uBloom;
  uniform vec3 uSideGlow;
  uniform vec2 uBloomPos;
  uniform vec2 uSidePos;
  uniform float uAspect;
  uniform float uOpacity;
  uniform float uTime;

  void main() {
    // vUv.y is 0 at the bottom of the plane
    vec3 col = mix(uGroundDeep, uGround, smoothstep(0.0, 0.2, vUv.y));
    col = mix(col, uHorizon, smoothstep(0.16, 0.34, vUv.y));
    col = mix(col, uSkyMid, smoothstep(0.3, 0.62, vUv.y));
    col = mix(col, uSkyTop, smoothstep(0.62, 1.0, vUv.y));

    float breathe = 0.94 + 0.06 * sin(uTime * 0.16);

    vec2 b = vUv - uBloomPos;
    b.x *= uAspect;
    float bloom = exp(-dot(b, b) * 5.2) * breathe;
    col = mix(col, uBloom, clamp(bloom, 0.0, 1.0) * 0.9);

    vec2 s = vUv - uSidePos;
    s.x *= uAspect;
    float side = exp(-dot(s, s) * 9.0);
    col = mix(col, uSideGlow, side * 0.35);

    // the faintest vignette so the corners settle
    vec2 v = (vUv - 0.5) * vec2(uAspect, 1.0);
    col *= 1.0 - clamp(dot(v, v) * 0.28, 0.0, 0.3);

    gl_FragColor = vec4(col, uOpacity);
  }
`;

export function createBackdrop(width: number, height: number, aspect: number) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uSkyTop: { value: new THREE.Color("#5f5a73") },
      uSkyMid: { value: new THREE.Color("#847d95") },
      uHorizon: { value: new THREE.Color("#8f9285") },
      uGround: { value: new THREE.Color("#4c7d43") },
      uGroundDeep: { value: new THREE.Color("#274a26") },
      uBloom: { value: new THREE.Color("#f7dcee") },
      uSideGlow: { value: new THREE.Color("#cfc7e4") },
      uBloomPos: { value: new THREE.Vector2(0.63, 0.78) },
      uSidePos: { value: new THREE.Vector2(0.2, 0.5) },
      uAspect: { value: aspect },
      uOpacity: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.frustumCulled = false;

  return { mesh, material };
}
