// The streaks behind Agentic are a short clip of prism light — rainbow bands
// fanning out of a white hot spot — stacked frame by frame into a 3D texture
// and raymarched inside a box. x and y are the frame, depth is time, so looking
// down the box every later frame sits a little further away, and anything that
// moves in the clip is drawn out into a streak running into the distance.
//
// We can't ship the original clip, so the frames are painted by a shader into
// the 3D texture once, up front, and the raymarch is the same as the original's.

import * as THREE from "three";
import { LIGHT_VOLUME } from "./preset";

const FRAMES = { width: 256, height: 144, depth: 64 };

const FULLSCREEN_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// One frame of the clip. uPhase runs 0..1 around a closed loop so the texture
// wraps seamlessly in depth.
const FRAME_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform float uPhase;
  uniform vec3 uHsl;

  float hash(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
          mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
          mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z
    );
  }

  // thin bright ridges around the hot spot; sampling on a circle keeps the
  // pattern continuous all the way round
  float ridges(float angle, float r, vec3 drift, float freq, float sharp) {
    vec3 q = vec3(cos(angle) * freq, sin(angle) * freq, r * 1.15) + drift;
    float n = noise(q) * 0.62 + noise(q * 2.07 + 7.3) * 0.38;
    return pow(1.0 - abs(n * 2.0 - 1.0), sharp);
  }

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

  void main() {
    const float TAU = 6.2831853;
    float phase = uPhase * TAU;
    vec2 loop = vec2(cos(phase), sin(phase));

    vec2 p = (vUv - 0.5) * vec2(16.0 / 9.0, 1.0);
    // the hot spot sits right of centre and wanders a little
    vec2 core = vec2(0.14 + 0.06 * sin(phase), 0.05 + 0.04 * cos(phase + 1.3));
    vec2 d = p - core;
    float r = length(d);
    float theta = atan(d.y, d.x);

    // broad sheets of light leave the hot spot and sweep round in long arcs
    float sweep = (0.7 + 0.35 * sin(theta + phase)) * r;
    vec3 drift = vec3(loop * 0.35, 0.0);

    vec3 sheets = vec3(0.0);
    for (int c = 0; c < 3; c++) {
      // each channel lands a little to the side, more so further out, which
      // puts a green fringe on one edge of a sheet and a pink one on the other
      float spread = (float(c) - 1.0) * (0.035 + 0.09 * r);
      float a = theta + sweep + spread;
      float broad = ridges(a, r * 0.6, drift, 1.5, 3.0);
      float detail = ridges(a, r * 0.8, drift * 1.3 + 4.0, 3.2, 7.0);
      float strands = ridges(a, r * 1.4, drift * 2.1 + 9.0, 7.5, 12.0);
      sheets[c] = broad * 0.6 + detail * 0.35 + strands * 0.35;
    }

    // whole sectors of the fan fall dark, and which ones changes as it plays
    float sectorAngle = theta + sweep * 0.4;
    float lobes = smoothstep(0.42, 0.8,
      noise(vec3(cos(sectorAngle) * 1.1, sin(sectorAngle) * 1.1, 2.0) + vec3(loop * 0.25, 0.0)));

    float reach = 0.22 + 1.2 * exp(-r * 1.6);
    vec3 col = sheets * lobes * reach;

    // small glints caught in the sheets; stacked through depth each one turns
    // into its own thin streak, which is most of the texture of the original
    float glintAngle = theta + sweep;
    float glints = pow(noise(vec3(cos(glintAngle) * 16.0, sin(glintAngle) * 16.0, r * 10.0) + drift * 3.0), 9.0);
    col += glints * dot(sheets, vec3(0.3333)) * lobes * 2.2;

    // pastel, not a pure spectrum: pull the fringes back towards white, then
    // let a faint warm tint drift across the fan
    col = mix(vec3(dot(col, vec3(0.3333))), col, 0.7) * 1.15;
    vec3 tint = 0.72 + 0.28 * cos(TAU * (vec3(0.0, 0.22, 0.5) + cos(theta) * 0.25 + r * 0.6 + uPhase * 0.2));
    col *= mix(vec3(1.0), tint, 0.6);

    // a small, hard hot spot and its halo
    col += vec3(1.0, 0.97, 0.93) * (exp(-r * r * 260.0) * 0.6 + exp(-r * 8.0) * 0.1);

    col = clamp(col, 0.0, 1.0);
    vec3 hsl = rgb2hsl(col);
    hsl.x += uHsl.x;
    hsl.y = clamp(hsl.y + uHsl.y, 0.0, 1.0);
    hsl.z = clamp(hsl.z + uHsl.z, 0.0, 1.0);
    gl_FragColor = vec4(hsl2rgb(hsl), 1.0);
  }
`;

function paintFrames(renderer: THREE.WebGLRenderer) {
  const target = new THREE.WebGL3DRenderTarget(
    FRAMES.width,
    FRAMES.height,
    FRAMES.depth,
    { depthBuffer: false, stencilBuffer: false },
  );
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
      uHsl: { value: new THREE.Vector3(...LIGHT_VOLUME.hsl) },
    },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: FRAME_FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  scene.add(quad);

  const previous = renderer.getRenderTarget();
  for (let layer = 0; layer < FRAMES.depth; layer++) {
    material.uniforms.uPhase.value = layer / FRAMES.depth;
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
  void main() {
    vLocalPos = position;
    vCameraLocal = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const MAX_STEPS = 100;

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
  uniform float uLoopCount;
  uniform float uGridTimeOffset;
  uniform float uGridOpacity;
  uniform float uSteps;
  uniform float uScrubOffset;
  uniform float uLoadFade;
  uniform vec2 uFluidStrength;
  uniform vec2 uFluidDepthStrength;

  varying vec3 vLocalPos;
  varying vec3 vCameraLocal;

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

    // the pointer's fluid bends the frames, pushing near and far in opposite ways
    vec2 fluidUv = clamp(gl_FragCoord.xy / uResolution, 0.0, 1.0);
    vec2 fluidOffset = -texture(uFluid, fluidUv).xy * uFluidStrength * vec2(-1.0, 1.0) * 0.06;

    vec3 accum = vec3(0.0);
    float alpha = 0.0;
    for (int i = 0; i < ${MAX_STEPS}; i++) {
      if (float(i) >= steps) break;
      float t = bounds.x + (float(i) + jitter) * dt;
      vec3 p = vCameraLocal + rayDir * t;
      float rayDepth01 = clamp((t - bounds.x) / max(bounds.y - bounds.x, 0.0001), 0.0, 1.0);

      vec3 uvw = p + 0.5;
      uvw.xy += fluidOffset * mix(uFluidDepthStrength.x, uFluidDepthStrength.y, smoothstep(0.0, 1.0, rayDepth01));
      uvw = clamp(uvw, vec3(0.001), vec3(0.999));
      // depth is time: several loops of the clip fit in the box, scrubbed forward
      float z = fract(uvw.z * uLoopCount + uScrubOffset + uGridTimeOffset);
      vec4 tex = texture(uVolume, vec3(uvw.x, uvw.y, z));
      vec3 linear = pow(tex.rgb, vec3(2.2));

      float luma = max(max(tex.r, tex.g), tex.b);
      float density = smoothstep(uThreshold, uThreshold + max(0.0001, uSoftness), luma)
        * uOpacity * uGridOpacity;
      float a = density / steps;
      accum += linear * uBrightness * a * (1.0 - alpha);
      alpha += a * (1.0 - alpha);
      if (alpha > 0.96) break;
    }

    gl_FragColor = vec4(accum, alpha) * uLoadFade;
  }
`;

export type PrismVolume = {
  group: THREE.Group;
  update: (opts: {
    scrubOffset: number;
    loadFade: number;
    fluid: THREE.Texture;
    resolution: THREE.Vector2;
  }) => void;
  dispose: () => void;
};

export function createPrismVolume(
  renderer: THREE.WebGLRenderer,
  steps: number,
): PrismVolume {
  const frames = paintFrames(renderer);
  const settings = LIGHT_VOLUME;

  // built fresh per box: cloning would try to copy the render target's texture
  const makeMaterial = () => new THREE.ShaderMaterial({
    uniforms: {
      uVolume: { value: frames.texture },
      uFluid: { value: null },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uOpacity: { value: settings.opacity },
      uBrightness: { value: settings.brightness },
      uThreshold: { value: settings.threshold },
      uSoftness: { value: settings.softness },
      uLoopCount: { value: settings.loopCount },
      uGridTimeOffset: { value: 0 },
      uGridOpacity: { value: 1 },
      uSteps: { value: steps },
      uScrubOffset: { value: 0 },
      uLoadFade: { value: 0 },
      uFluidStrength: { value: new THREE.Vector2(...settings.fluidStrength) },
      uFluidDepthStrength: {
        value: new THREE.Vector2(...settings.fluidDepthStrength),
      },
    },
    vertexShader: VOLUME_VERT,
    fragmentShader: VOLUME_FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    // the camera sits inside the middle box, so draw the far faces
    side: THREE.BackSide,
  });

  const group = new THREE.Group();
  group.position.set(...settings.position);
  group.rotation.y = settings.rotationY;
  group.scale.set(
    settings.scale[0] * settings.width,
    settings.scale[1] * (settings.width / settings.aspect),
    settings.scale[2] * settings.depth,
  );

  // a 3x3 wall of boxes, each playing from its own point in the clip; only the
  // middle one is at full strength
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const { columns, rows, spacing, randomTimeOffset, outerOpacity } = settings.grid;
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
    material.uniforms.uGridTimeOffset.value = centre
      ? 0
      : ((seed + 1) % 1) * randomTimeOffset;
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
