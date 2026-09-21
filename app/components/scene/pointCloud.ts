// The point cloud in front of the light, run through the original's point
// shader: per-point jitter, a curl or rising flow, snapping onto a grid, the
// conveyor that slides every point along one axis and loops it, the pointer's
// fluid, fading and sizing by distance, and caustic light sliding through.

import * as THREE from "three";
import { buildCloud } from "./clouds";
import type { CloudSettings } from "./presets";

const VERT = `
  uniform float uTime;
  uniform float uPointSize;
  uniform float uMaxPointSize;
  uniform float uDPR;
  uniform float uOpacity;
  uniform float uTransparent;
  uniform vec3 uRandomize;
  uniform float uCamFadeEnabled;
  uniform float uCamFadeNear;
  uniform float uCamFadeFar;
  uniform float uDistanceSizeInfluence;
  uniform float uDistanceSizeNear;
  uniform float uDistanceSizeFar;
  uniform float uDistanceSizeMax;
  uniform float uFlowEnabled;
  uniform float uFlowType;
  uniform float uFlowStrength;
  uniform float uFlowSpeed;
  uniform float uFlowScale;
  uniform float uFlowDistanceNear;
  uniform float uFlowDistanceFar;
  uniform float uFlowRandomnessExponent;
  uniform float uGridEnabled;
  uniform float uGridSize;
  uniform vec3 uGridMix;
  uniform vec3 uGridRotation;
  uniform float uConveyorEnabled;
  uniform float uConveyorSpeed;
  uniform float uConveyorDepth;
  uniform float uConveyorNear;
  uniform float uConveyorFar;
  uniform vec3 uConveyorAxis;
  uniform sampler2D uFluid;
  uniform float uFluidInfluence;
  // the chapter's selective colour grade: nine ranges of (hue turn, saturation, lightness)
  uniform float uSelectiveAmount;
  uniform vec3 uSelectiveAdj[9];

  attribute vec3 color;
  attribute vec4 aRandom;
  attribute float aSize;

  varying vec3 vColor;
  varying vec3 vWorldPosition;
  varying float vCameraFade;
  varying float vSparkleSeed;
  varying float vProjectedPointSize;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
  }

  // a hue sector's pull, falling to nothing a sixth of a turn away
  float hueSectorWeight(float hue, float centre) {
    float d = abs(hue - centre);
    d = min(d, 1.0 - d);
    return clamp(1.0 - d * 6.0, 0.0, 1.0);
  }

  float hueToRgbChannel(float p, float q, float t) {
    t = fract(t);
    if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
    if (t < 0.5) return q;
    if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
    return p;
  }

  vec3 hslToRgb(vec3 hsl) {
    float h = hsl.x;
    float sat = clamp(hsl.y, 0.0, 1.0);
    float l = clamp(hsl.z, 0.0, 1.0);
    if (sat < 0.0001) return vec3(l);
    float q = l < 0.5 ? l * (1.0 + sat) : l + sat - l * sat;
    float p = 2.0 * l - q;
    return vec3(
      hueToRgbChannel(p, q, h + 1.0 / 3.0),
      hueToRgbChannel(p, q, h),
      hueToRgbChannel(p, q, h - 1.0 / 3.0)
    );
  }

  // the original's selective colour: per hue sector and per lightness band,
  // shift hue, saturation and lightness
  vec3 applySelectiveColor(vec3 rgb) {
    float amount = clamp(uSelectiveAmount, 0.0, 1.0);
    if (amount < 0.0001) return rgb;

    float maxC = max(rgb.r, max(rgb.g, rgb.b));
    float minC = min(rgb.r, min(rgb.g, rgb.b));
    float chroma = maxC - minC;

    float hue = 0.0;
    vec4 wRYGC = vec4(0.0);
    vec2 wBM = vec2(0.0);
    if (chroma > 0.0001) {
      if (rgb.r >= rgb.g && rgb.r >= rgb.b) {
        hue = (rgb.g - rgb.b) / chroma;
        if (hue < 0.0) hue += 6.0;
      } else if (rgb.g >= rgb.b) {
        hue = (rgb.b - rgb.r) / chroma + 2.0;
      } else {
        hue = (rgb.r - rgb.g) / chroma + 4.0;
      }
      hue *= 1.0 / 6.0;
      wRYGC = vec4(
        hueSectorWeight(hue, 0.0 / 6.0),
        hueSectorWeight(hue, 1.0 / 6.0),
        hueSectorWeight(hue, 2.0 / 6.0),
        hueSectorWeight(hue, 3.0 / 6.0)
      );
      wBM = vec2(hueSectorWeight(hue, 4.0 / 6.0), hueSectorWeight(hue, 5.0 / 6.0));
    }

    float L = (maxC + minC) * 0.5;
    float wW = smoothstep(0.5, 1.0, L);
    float wK = 1.0 - smoothstep(0.0, 0.5, L);
    float wN = clamp(1.0 - abs(L * 2.0 - 1.0), 0.0, 1.0);

    vec3 totalAdj =
      wRYGC.x * uSelectiveAdj[0] +
      wRYGC.y * uSelectiveAdj[1] +
      wRYGC.z * uSelectiveAdj[2] +
      wRYGC.w * uSelectiveAdj[3] +
      wBM.x * uSelectiveAdj[4] +
      wBM.y * uSelectiveAdj[5] +
      wW * uSelectiveAdj[6] +
      wN * uSelectiveAdj[7] +
      wK * uSelectiveAdj[8];
    totalAdj *= amount;

    float saturation = chroma > 0.0001
      ? (L > 0.5 ? chroma / max(2.0 - maxC - minC, 0.0001) : chroma / max(maxC + minC, 0.0001))
      : 0.0;

    vec3 hsl = vec3(
      fract(hue + totalAdj.x),
      clamp(saturation + totalAdj.y, 0.0, 1.0),
      clamp(L + totalAdj.z, 0.0, 1.0)
    );
    return clamp(hslToRgb(hsl), 0.0, 1.0);
  }

  float valueNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z
    );
  }

  vec3 curlNoise(vec3 p) {
    float e = 0.1;
    float a = (valueNoise(p + vec3(0.0, e, 0.0)) - valueNoise(p - vec3(0.0, e, 0.0))) / (2.0 * e);
    float b = (valueNoise(p + vec3(0.0, 0.0, e)) - valueNoise(p - vec3(0.0, 0.0, e))) / (2.0 * e);
    float c = (valueNoise(p + vec3(e, 0.0, 0.0)) - valueNoise(p - vec3(e, 0.0, 0.0))) / (2.0 * e);
    vec3 v = vec3(a - b, b - c, c - a);
    return v / max(length(v), 0.0001);
  }

  vec3 rotateX(vec3 p, float a) { float c = cos(a); float s = sin(a); return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c); }
  vec3 rotateY(vec3 p, float a) { float c = cos(a); float s = sin(a); return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c); }
  vec3 rotateZ(vec3 p, float a) { float c = cos(a); float s = sin(a); return vec3(p.x * c - p.y * s, p.x * s + p.y * c, p.z); }

  void main() {
    vSparkleSeed = fract(aRandom.x * 17.13 + aRandom.y * 3.71 + aRandom.z * 11.47);
    vec3 pos = position + (aRandom.xyz * 2.0 - 1.0) * uRandomize;
    pos.y += sin(uTime * 0.18 + aRandom.x * 12.0) * 0.006;
    vec4 preFlowMv = viewMatrix * modelMatrix * vec4(pos, 1.0);

    // the conveyor: every point slides along one axis on its own phase
    float conveyorLife = 1.0;
    float conveyorOffset = 0.0;
    float speed = uConveyorSpeed * 0.6;
    if (uConveyorEnabled > 0.5 && abs(speed) > 0.0001) {
      float depth = max(uConveyorDepth, 0.001);
      float mask = smoothstep(uConveyorFar, uConveyorNear, max(-preFlowMv.z, 0.001));
      if (mask > 0.0001) {
        float phase = fract(aRandom.x + uTime * abs(speed) / depth);
        conveyorLife = 1.0 - smoothstep(0.25, 0.5, abs(phase - 0.5));
        conveyorOffset = (phase - 0.5) * depth * sign(speed) * mask;
      }
    }

    float flowSize = 1.0;
    if (uFlowEnabled > 0.5 && uFlowStrength > 0.0) {
      float mask = smoothstep(uFlowDistanceFar, uFlowDistanceNear, length(preFlowMv.xyz));
      if (mask > 0.0001) {
        float t = uTime * uFlowSpeed;
        float strength = uFlowStrength * mask;
        if (uFlowType < 2.5) {
          vec3 curl = curlNoise(pos * max(uFlowScale, 0.0001) + vec3(t * 0.08, t * 0.05, -t * 0.04));
          pos += curl * strength * 0.16 * (0.45 + aRandom.w);
        } else {
          float sparse = pow(aRandom.x, max(uFlowRandomnessExponent, 1.0));
          float rise = fract(t * 0.04 + pow(aRandom.y, 10.0) * 20.0);
          flowSize = smoothstep(0.0, 0.08, rise) * (1.0 - smoothstep(0.82, 1.0, rise));
          pos.y += rise * sparse * strength * 7.0 * mix(0.4, 1.2, aRandom.z);
          pos.y += sin(t + aRandom.x * 20.0) * sparse * strength * 0.08 * aRandom.w;
        }
      }
    }

    // snap towards a (rotated) grid, per axis
    if (uGridEnabled > 0.5) {
      float size = max(uGridSize, 0.0001);
      vec3 gridPos = rotateX(rotateY(rotateZ(pos, -uGridRotation.z), -uGridRotation.y), -uGridRotation.x);
      vec3 snapped = floor(gridPos / size + 0.5) * size;
      gridPos = mix(gridPos, snapped, clamp(uGridMix, vec3(0.0), vec3(1.0)));
      pos = rotateZ(rotateY(rotateX(gridPos, uGridRotation.x), uGridRotation.y), uGridRotation.z);
    }

    vColor = applySelectiveColor(color);
    vec4 world = modelMatrix * vec4(pos, 1.0);
    world.xyz += normalize(mat3(modelMatrix) * uConveyorAxis) * conveyorOffset;
    vec4 mv = viewMatrix * world;
    vWorldPosition = world.xyz;

    if (uFluidInfluence > 0.0) {
      vec4 clip = projectionMatrix * mv;
      vec2 screenUv = clamp(clip.xy / max(clip.w, 0.0001) * 0.5 + 0.5, 0.0, 1.0);
      float depthAtten = 1.0 / (1.0 + max(-mv.z, 0.0) * 0.3);
      mv.xy += texture2D(uFluid, screenUv).xy * uFluidInfluence * 0.02 * depthAtten;
    }

    float dist = length(mv.xyz);
    vCameraFade = uCamFadeEnabled > 0.5
      ? 1.0 - smoothstep(uCamFadeNear, max(uCamFadeFar, uCamFadeNear + 0.0001), dist)
      : 1.0;

    float baseSize = mix(0.6, 1.6, pow(aRandom.z, 4.0));
    baseSize *= mix(1.0, mix(0.65, 1.35, aSize), 0.3);
    float distanceT = smoothstep(uDistanceSizeNear, uDistanceSizeFar, dist);
    baseSize *= mix(1.0, mix(1.0, uDistanceSizeMax, distanceT), uDistanceSizeInfluence);
    baseSize *= flowSize * conveyorLife;
    float opaqueSizeScale = uTransparent > 0.5 ? 1.0 : max(uOpacity, 0.0);
    float ps = uPointSize * baseSize * opaqueSizeScale * uDPR * (120.0 / max(dist, 0.1));
    vProjectedPointSize = ps;
    gl_PointSize = clamp(ps, 0.0, uMaxPointSize);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = `
  precision highp float;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uTransparent;
  uniform float uLoadFade;
  uniform float uCausticsStrength;
  uniform float uCausticsScale;
  uniform float uCausticsPower;
  uniform float uCausticsSparkle;
  uniform vec3 uCausticsAxisScale;
  uniform vec3 uCausticsSpeed;
  uniform vec3 uCausticsColor;

  varying vec3 vColor;
  varying vec3 vWorldPosition;
  varying float vCameraFade;
  varying float vSparkleSeed;
  varying float vProjectedPointSize;

  float dotNoise(vec3 p) {
    const float PHI = 1.618033988;
    const mat3 GOLD = mat3(
      -0.571464913, 0.814921382, 0.096597072,
      -0.278044873, -0.303026659, 0.911518454,
      0.772087367, 0.494042493, 0.399753815
    );
    return dot(cos(GOLD * p), sin(PHI * p * GOLD));
  }

  float caustics(vec3 worldPos) {
    vec3 p = worldPos * max(uCausticsScale, 0.0001) * max(uCausticsAxisScale, vec3(0.0001));
    vec3 drift = uTime * uCausticsSpeed;
    float n1 = dotNoise(p + drift);
    float n2 = dotNoise(p * 1.73 + vec3(-drift.y, drift.z, -drift.x));
    float n3 = dotNoise(p * 3.11 + vec3(drift.z, -drift.x, drift.y));
    float ridges = max(0.0, 1.0 - min(min(abs(n1), abs(n2)), abs(n3)) * 1.7);
    float crossings = max(0.0, 1.0 - abs(n1 + n2 * 0.55 - n3 * 0.35) * 1.15);
    return pow(clamp(ridges * 0.82 + crossings * 0.28, 0.0, 1.0), max(0.001, uCausticsPower));
  }

  void main() {
    float minSize = uTransparent > 0.5 ? 0.55 : 0.01;
    if (vProjectedPointSize < minSize) discard;
    vec2 uv = gl_PointCoord - 0.5;
    float r2 = dot(uv, uv);
    if (r2 > 0.25) discard;

    vec3 color = vColor;
    if (uCausticsStrength > 0.0 || uCausticsSparkle > 0.0) {
      float pointMask = 0.55 + 0.45 * smoothstep(0.25, 0.0, r2);
      color += uCausticsColor * caustics(vWorldPosition) * uCausticsStrength * pointMask;
      if (uCausticsSparkle > 0.0001) {
        float sparse = smoothstep(0.985, 1.0, vSparkleSeed);
        float twinkle = 0.5 + 0.5 * sin(uTime * mix(4.0, 11.0, vSparkleSeed) + vSparkleSeed * 37.699112);
        float pulse = pow(smoothstep(0.72, 1.0, twinkle), 3.0);
        color += mix(uCausticsColor, vec3(1.0), 0.82) * uCausticsSparkle * sparse * pulse * smoothstep(0.18, 0.0, r2);
      }
    }

    float alpha = (uTransparent > 0.5 ? uOpacity : 1.0) * vCameraFade * uLoadFade;
    gl_FragColor = vec4(clamp(color, 0.0, 1.0), alpha);
  }
`;

export type PointCloud = {
  points: THREE.Points;
  update: (opts: { time: number; dpr: number; loadFade: number; fluid: THREE.Texture }) => void;
  dispose: () => void;
};

export function createPointCloud(settings: CloudSettings, count: number): PointCloud {
  const data = buildCloud(settings.builder, count);
  const rand = (() => {
    let state = 1234567;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  })();
  const randoms = new Float32Array(data.count * 4);
  const sizes = new Float32Array(data.count);
  for (let i = 0; i < data.count; i++) {
    randoms[i * 4] = rand();
    randoms[i * 4 + 1] = rand();
    randoms[i * 4 + 2] = rand();
    randoms[i * 4 + 3] = rand();
    sizes[i] = rand();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(data.colors, 3));
  geometry.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 4));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

  const conveyorAxis = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(...settings.conveyor.rotation));
  const { flow, grid, conveyor, caustics } = settings;
  const opaque = !settings.transparent;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPointSize: { value: settings.pointSize * settings.sizeScalar },
      uMaxPointSize: { value: settings.maxPointSize * settings.sizeScalar },
      uDPR: { value: 1 },
      uOpacity: { value: settings.opacity },
      uTransparent: { value: opaque ? 0 : 1 },
      uLoadFade: { value: 0 },
      uRandomize: { value: new THREE.Vector3(...settings.randomize) },
      uCamFadeEnabled: { value: settings.cameraFade.enabled ? 1 : 0 },
      uCamFadeNear: { value: settings.cameraFade.near },
      uCamFadeFar: { value: settings.cameraFade.far },
      uDistanceSizeInfluence: { value: settings.distanceSize.influence },
      uDistanceSizeNear: { value: settings.distanceSize.near },
      uDistanceSizeFar: { value: settings.distanceSize.far },
      uDistanceSizeMax: { value: settings.distanceSize.max },
      uFlowEnabled: { value: flow.enabled ? 1 : 0 },
      uFlowType: { value: flow.type === "curl" ? 1 : 3 },
      uFlowStrength: { value: flow.strength },
      uFlowSpeed: { value: flow.speed },
      uFlowScale: { value: flow.scale },
      uFlowDistanceNear: { value: flow.distanceNear },
      uFlowDistanceFar: { value: flow.distanceFar },
      uFlowRandomnessExponent: { value: flow.randomnessExponent },
      uGridEnabled: { value: grid.enabled && grid.strength > 0 ? 1 : 0 },
      uGridSize: { value: grid.size },
      uGridMix: { value: new THREE.Vector3(...grid.mix) },
      uGridRotation: { value: new THREE.Vector3(...grid.rotation) },
      uConveyorEnabled: { value: conveyor.enabled ? 1 : 0 },
      uConveyorSpeed: { value: conveyor.speed },
      uConveyorDepth: { value: conveyor.depth },
      uConveyorNear: { value: conveyor.near },
      uConveyorFar: { value: conveyor.far },
      uConveyorAxis: { value: conveyorAxis },
      uFluid: { value: null },
      uFluidInfluence: { value: settings.fluidInfluence },
      uSelectiveAmount: { value: settings.colorCorrection?.amount ?? 0 },
      uSelectiveAdj: {
        value: Array.from({ length: 9 }, (_, i) =>
          new THREE.Vector3(...(settings.colorCorrection?.ranges[i] ?? [0, 0, 0])),
        ),
      },
      uCausticsStrength: { value: caustics.strength },
      uCausticsScale: { value: caustics.scale },
      uCausticsPower: { value: caustics.power },
      uCausticsSparkle: { value: caustics.sparkle },
      uCausticsAxisScale: { value: new THREE.Vector3(...caustics.axisScale) },
      uCausticsSpeed: { value: new THREE.Vector3(...caustics.speed) },
      uCausticsColor: { value: new THREE.Vector3(...caustics.color) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: !opaque,
    depthTest: opaque,
    depthWrite: opaque,
    blending: opaque
      ? THREE.NoBlending
      : settings.blend === "additive"
        ? THREE.AdditiveBlending
        : THREE.NormalBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.position.set(...settings.position);
  const d2r = Math.PI / 180;
  points.rotation.set(settings.rotationDeg[0] * d2r, settings.rotationDeg[1] * d2r, settings.rotationDeg[2] * d2r);
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
      // the positions are cached and shared, so only the GPU side goes
      geometry.dispose();
      material.dispose();
    },
  };
}
