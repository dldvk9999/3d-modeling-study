// A clip stacked into a 3D texture and raymarched inside a box, the way every
// chapter of the original draws its light: x and y are the frame, depth is
// time, so anything that moves in the clip becomes a shape running into the
// distance. The clip itself is painted by a stand-in shader (painters.ts).

import * as THREE from "three";
import { painterShader } from "./painters";
import type { VolumeSettings } from "./presets";

const FRAME_DEPTH = 56;
const FRAME_PIXELS = 36000;
const MAX_STEPS = 128;

const FULLSCREEN_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

function paintFrames(renderer: THREE.WebGLRenderer, settings: VolumeSettings) {
  const height = Math.round(Math.sqrt(FRAME_PIXELS / settings.aspect));
  const width = Math.round(height * settings.aspect);
  const target = new THREE.WebGL3DRenderTarget(width, height, FRAME_DEPTH, {
    depthBuffer: false,
    stencilBuffer: false,
  });
  const texture = target.texture;
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.wrapR = THREE.RepeatWrapping;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPhase: { value: 0 },
      uAspect: { value: settings.aspect },
    },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: painterShader(settings.painter),
    depthTest: false,
    depthWrite: false,
  });
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  scene.add(quad);

  const previous = renderer.getRenderTarget();
  for (let layer = 0; layer < FRAME_DEPTH; layer++) {
    material.uniforms.uPhase.value = layer / FRAME_DEPTH;
    renderer.setRenderTarget(target, layer);
    renderer.render(scene, camera);
  }
  renderer.setRenderTarget(previous);

  quad.geometry.dispose();
  material.dispose();
  return target;
}

const VOLUME_VERT = `
  varying vec3 vLocalPos;
  varying vec3 vCameraLocal;
  varying vec3 vWorldPos;
  void main() {
    vLocalPos = position;
    vCameraLocal = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const VOLUME_FRAG = `
  precision highp float;
  precision highp sampler3D;

  uniform sampler3D uVolume;
  uniform sampler2D uFluid;
  uniform vec2 uResolution;
  uniform float uOpacity;
  uniform float uBrightness;
  uniform float uThreshold;
  uniform float uSoftness;
  uniform float uEdgeFade;
  uniform float uLoopCount;
  uniform float uGridTimeOffset;
  uniform float uGridOpacity;
  uniform float uNearFade;
  uniform float uSteps;
  uniform float uScrubOffset;
  uniform float uLoadFade;
  uniform float uSrgbLuma;
  uniform vec3 uHsl;
  uniform vec2 uFluidStrength;
  uniform vec2 uFluidDepthStrength;

  varying vec3 vLocalPos;
  varying vec3 vCameraLocal;
  varying vec3 vWorldPos;

  vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  // the original's colour adjustment: turn the hue, scale saturation and value
  vec3 applyHsl(vec3 col, vec3 hsl) {
    if (dot(abs(hsl), vec3(1.0)) < 0.0001) return col;
    vec3 hsv = rgb2hsv(col);
    hsv.x = fract(hsv.x + hsl.x);
    hsv.y = clamp(hsv.y * (1.0 + hsl.y), 0.0, 1.0);
    hsv.z = clamp(hsv.z * (1.0 + hsl.z), 0.0, 2.0);
    return hsv2rgb(hsv);
  }

  vec2 hitBox(vec3 orig, vec3 dir) {
    vec3 invDir = 1.0 / dir;
    vec3 t0s = (vec3(-0.5) - orig) * invDir;
    vec3 t1s = (vec3(0.5) - orig) * invDir;
    vec3 tMin = min(t0s, t1s);
    vec3 tMax = max(t0s, t1s);
    return vec2(max(max(tMin.x, tMin.y), tMin.z), min(min(tMax.x, tMax.y), tMax.z));
  }

  void main() {
    vec3 rayDir = normalize(vLocalPos - vCameraLocal);
    vec2 bounds = hitBox(vCameraLocal, rayDir);
    if (bounds.x > bounds.y) discard;
    bounds.x = max(bounds.x, 0.0);

    float steps = clamp(uSteps, 8.0, ${MAX_STEPS}.0);
    float dt = (bounds.y - bounds.x) / steps;
    float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);

    // the pointer's fluid bends the frames, near and far by different amounts
    vec2 fluidUv = clamp(gl_FragCoord.xy / uResolution, 0.0, 1.0);
    vec2 fluidOffset = -texture(uFluid, fluidUv).xy * uFluidStrength * vec2(-1.0, 1.0) * 0.06;

    vec3 accum = vec3(0.0);
    float alpha = 0.0;
    for (int i = 0; i < ${MAX_STEPS}; i++) {
      if (float(i) >= steps) break;
      float t = bounds.x + (float(i) + jitter) * dt;
      vec3 p = vCameraLocal + rayDir * t;
      float rayDepth01 = clamp((t - bounds.x) / max(bounds.y - bounds.x, 0.0001), 0.0, 1.0);

      vec3 rawUvw = p + 0.5;
      rawUvw.xy += fluidOffset * mix(uFluidDepthStrength.x, uFluidDepthStrength.y, smoothstep(0.0, 1.0, rayDepth01));
      float sideDistance = min(min(rawUvw.x, 1.0 - rawUvw.x), min(rawUvw.y, 1.0 - rawUvw.y));
      float sideMask = uEdgeFade > 0.0001 ? smoothstep(0.0, uEdgeFade, sideDistance) : 1.0;
      float sideFeather = mix(1.0, sideMask, 1.0 - smoothstep(0.25, 0.85, rayDepth01));

      vec3 uvw = clamp(rawUvw, vec3(0.001), vec3(0.999));
      // depth is time: a few loops of the clip fit in the box, scrubbed along
      float z = fract(uvw.z * uLoopCount + uScrubOffset + uGridTimeOffset);
      vec4 tex = texture(uVolume, vec3(uvw.x, uvw.y, z));
      vec3 linear = pow(tex.rgb, vec3(2.2));

      vec3 measured = uSrgbLuma > 0.5 ? tex.rgb : linear;
      float luma = max(max(measured.r, measured.g), measured.b);
      float density = smoothstep(uThreshold, uThreshold + max(0.0001, uSoftness), luma)
        * uOpacity * sideFeather * uGridOpacity;
      float a = density / steps;
      accum += applyHsl(linear, uHsl) * uBrightness * a * (1.0 - alpha);
      alpha += a * (1.0 - alpha);
      if (alpha > 0.96) break;
    }

    float nearFade = smoothstep(0.0, max(0.0001, uNearFade), length(vWorldPos - cameraPosition));
    gl_FragColor = vec4(accum * nearFade, alpha * nearFade) * uLoadFade;
  }
`;

export type LightVolume = {
  group: THREE.Group;
  settings: VolumeSettings;
  update: (opts: {
    scrubOffset: number;
    loadFade: number;
    fluid: THREE.Texture;
    resolution: THREE.Vector2;
  }) => void;
  dispose: () => void;
};

export function createLightVolume(
  renderer: THREE.WebGLRenderer,
  settings: VolumeSettings,
  stepScale: number,
): LightVolume {
  const frames = paintFrames(renderer, settings);

  // built fresh per box: cloning would try to copy the render target's texture
  const makeMaterial = () =>
    new THREE.ShaderMaterial({
      uniforms: {
        uVolume: { value: frames.texture },
        uFluid: { value: null },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uOpacity: { value: settings.opacity },
        uBrightness: { value: settings.brightness },
        uThreshold: { value: Math.max(settings.threshold, 0.025) },
        uSoftness: { value: settings.softness },
        uEdgeFade: { value: settings.edgeFade },
        uLoopCount: { value: settings.loopCount },
        uGridTimeOffset: { value: 0 },
        uGridOpacity: { value: 1 },
        uNearFade: { value: settings.nearFade },
        uSteps: { value: Math.max(8, Math.round(settings.steps * stepScale)) },
        uScrubOffset: { value: 0 },
        uLoadFade: { value: 0 },
        uSrgbLuma: { value: settings.srgbLuma ? 1 : 0 },
        uHsl: { value: new THREE.Vector3(...settings.hsl) },
        uFluidStrength: { value: new THREE.Vector2(...settings.fluidStrength) },
        uFluidDepthStrength: { value: new THREE.Vector2(...settings.fluidDepthStrength) },
      },
      vertexShader: VOLUME_VERT,
      fragmentShader: VOLUME_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: settings.blend === "additive" ? THREE.AdditiveBlending : THREE.NormalBlending,
      // the camera often sits inside the box, so draw the far faces
      side: THREE.BackSide,
    });

  const group = new THREE.Group();
  group.position.set(...settings.position);
  group.rotation.set(...settings.rotation);
  group.scale.set(
    settings.scale[0] * settings.width,
    settings.scale[1] * (settings.width / settings.aspect),
    settings.scale[2] * settings.depth,
  );

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const grid = settings.grid ?? { columns: 1, rows: 1, spacing: [1.1, 1.1], randomTimeOffset: 0, outerOpacity: 1 };
  const { columns, rows, spacing, randomTimeOffset, outerOpacity } = grid;
  const midColumn = Math.floor((columns - 1) * 0.5);
  const midRow = Math.floor((rows - 1) * 0.5);
  const reach = Math.max(midColumn, columns - 1 - midColumn, midRow, rows - 1 - midRow, 1);
  const materials: THREE.ShaderMaterial[] = [];

  for (let index = 0; index < columns * rows; index++) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const ring = Math.max(Math.abs(column - midColumn), Math.abs(row - midRow)) / reach;
    const centre = column === midColumn && row === midRow;
    const seed = (Math.sin((index + 1) * 12.9898 + columns * 78.233) * 43758.5453) % 1;

    const material = makeMaterial();
    material.uniforms.uGridTimeOffset.value = centre ? 0 : ((seed + 1) % 1) * randomTimeOffset;
    material.uniforms.uGridOpacity.value = 1 - Math.min(ring, 1) * (1 - outerOpacity);
    materials.push(material);

    const box = new THREE.Mesh(geometry, material);
    box.position.set(
      (column - (columns - 1) * 0.5) * spacing[0],
      (row - (rows - 1) * 0.5) * spacing[1],
      0,
    );
    box.frustumCulled = false;
    group.add(box);
  }

  return {
    group,
    settings,
    update({ scrubOffset, loadFade, fluid, resolution }) {
      for (const material of materials) {
        material.uniforms.uScrubOffset.value = scrubOffset;
        material.uniforms.uLoadFade.value = loadFade;
        material.uniforms.uFluid.value = fluid;
        material.uniforms.uResolution.value.copy(resolution);
      }
    },
    dispose() {
      geometry.dispose();
      for (const material of materials) material.dispose();
      frames.dispose();
    },
  };
}
