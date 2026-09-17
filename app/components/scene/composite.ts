// Puts a chapter's layers back together the way the original's pipeline does:
// an environment or nothing behind; the background light layer; the point
// cloud; bloom and chromatic fringing; an afterimage that keeps the points'
// trails but not the background light; the foreground light layer on top;
// grain and a vignette; then the chapter's gradient backdrop showing through
// wherever the scene is empty, the "behind content" tune-down, tone mapping.

import * as THREE from "three";
import type { Backdrop, PostSettings } from "./presets";

const FULLSCREEN_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BLUR_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tMap;
  uniform vec2 uDirection;
  uniform float uThreshold;
  vec3 bright(vec2 uv) {
    vec3 c = texture2D(tMap, uv).rgb;
    float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
    return c * smoothstep(uThreshold, uThreshold + 0.1, luma);
  }
  void main() {
    vec3 sum = bright(vUv) * 0.227027;
    sum += bright(vUv + uDirection * 1.384615) * 0.316216;
    sum += bright(vUv - uDirection * 1.384615) * 0.316216;
    sum += bright(vUv + uDirection * 3.230769) * 0.070270;
    sum += bright(vUv - uDirection * 3.230769) * 0.070270;
    gl_FragColor = vec4(sum, 1.0);
  }
`;

const LAYERS_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tBackground;
  uniform sampler2D tPoints;
  uniform float uBackgroundNormal;
  uniform float uPointsNormal;
  uniform float uEnvironment;
  uniform float uEnvironmentIntensity;
  uniform mat3 uEnvironmentRotation;
  uniform mat4 uCameraWorld;
  uniform mat4 uProjectionInverse;
  uniform float uLoadFade;

  // The original blurs and darkens HDR photographs behind some chapters; with
  // that much blur only the broad light is left, which these stand in for.
  vec3 apartment(vec3 dir) {
    vec3 col = mix(vec3(0.20, 0.16, 0.13), vec3(0.34, 0.31, 0.30), smoothstep(-0.6, 0.5, dir.y));
    col += vec3(1.6, 1.5, 1.35) * pow(max(dot(dir, normalize(vec3(0.75, 0.25, 0.6))), 0.0), 6.0);
    col += vec3(0.9, 0.6, 0.35) * pow(max(dot(dir, normalize(vec3(-0.8, 0.1, 0.35))), 0.0), 10.0);
    col *= 0.75 + 0.25 * smoothstep(-0.2, 0.3, dir.z);
    return col;
  }

  // mostly deep blue sky, which is all the blur leaves of it
  vec3 autumnField(vec3 dir) {
    vec3 sky = mix(vec3(0.2, 0.26, 0.66), vec3(0.03, 0.05, 0.26), smoothstep(0.0, 0.7, dir.y));
    vec3 field = mix(vec3(0.12, 0.13, 0.2), vec3(0.03, 0.035, 0.07), smoothstep(0.0, -0.5, dir.y));
    vec3 col = mix(field, sky, smoothstep(-0.35, 0.35, dir.y));
    col += vec3(1.0, 0.85, 0.65) * pow(max(dot(dir, normalize(vec3(0.6, 0.12, -0.8))), 0.0), 16.0) * 0.6;
    return col;
  }

  vec3 shopappOffice(vec3 dir) {
    vec3 col = mix(vec3(0.16, 0.08, 0.42), vec3(0.42, 0.28, 0.9), smoothstep(-0.5, 0.7, dir.y));
    col += vec3(1.1, 0.95, 1.3) * pow(max(dot(dir, normalize(vec3(-0.3, 0.5, -0.8))), 0.0), 8.0) * 0.6;
    col += vec3(0.6, 0.4, 1.0) * pow(max(dot(dir, normalize(vec3(0.7, 0.2, 0.3))), 0.0), 6.0);
    return col;
  }

  void main() {
    vec3 color = vec3(0.0);
    float alpha = 0.0;
    if (uEnvironment > 0.5) {
      vec4 ndc = vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
      vec4 view = uProjectionInverse * ndc;
      vec3 dir = normalize((uCameraWorld * vec4(view.xyz / view.w, 0.0)).xyz);
      dir = uEnvironmentRotation * dir;
      vec3 env = uEnvironment < 1.5 ? apartment(dir) : uEnvironment < 2.5 ? autumnField(dir) : shopappOffice(dir);
      color = env * uEnvironmentIntensity * uLoadFade;
      alpha = 1.0;
    }

    vec4 background = texture2D(tBackground, vUv);
    color = uBackgroundNormal > 0.5 ? color * (1.0 - background.a) + background.rgb : color + background.rgb;
    alpha += clamp(background.a, 0.0, 1.0) * (1.0 - alpha);

    vec4 points = texture2D(tPoints, vUv);
    color = uPointsNormal > 0.5 ? color * (1.0 - points.a) + points.rgb : color + points.rgb;
    alpha += clamp(points.a, 0.0, 1.0) * (1.0 - alpha);

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`;

const AFTERIMAGE_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tDiffuse;
  uniform sampler2D tOld;
  uniform sampler2D tBloom;
  uniform sampler2D tBackground;
  uniform float uDamp;
  uniform float uStrength;
  uniform float uThreshold;
  uniform float uBloomOpacity;
  uniform float uChromaticAmount;
  uniform float uChromaticAngle;
  uniform float uScreenOffset;
  uniform float uScreenScale;
  uniform float uTrailShift;

  void main() {
    vec4 current = texture2D(tDiffuse, vUv);
    vec2 screenUv = vec2(vUv.x, vUv.y * uScreenScale + uScreenOffset);

    if (uChromaticAmount > 0.0) {
      vec2 centre = screenUv - 0.5;
      float radius = length(centre);
      vec2 dir = radius > 0.00001 ? centre / radius : vec2(0.0);
      float c = cos(uChromaticAngle);
      float s = sin(uChromaticAngle);
      dir = vec2(dir.x * c - dir.y * s, dir.x * s + dir.y * c);
      vec2 offset = dir * uChromaticAmount * (radius + 0.15) * smoothstep(0.0, 0.05, radius);
      offset.y /= uScreenScale;
      current.r = texture2D(tDiffuse, clamp(vUv + offset, 0.0, 1.0)).r;
      current.b = texture2D(tDiffuse, clamp(vUv - offset, 0.0, 1.0)).b;
    }

    current.rgb += texture2D(tBloom, vUv).rgb * uBloomOpacity;

    // keep the brighter of now and a fading past, except over the background
    // light, whose coverage masks the trail out
    vec4 previous = texture2D(tOld, vUv - vec2(0.0, uTrailShift));
    float keep = step(uThreshold, dot(previous.rgb, vec3(0.299, 0.587, 0.114)));
    vec3 trail = max(current.rgb, previous.rgb * uDamp * keep);
    float trailAlpha = max(current.a, previous.a * uDamp * keep);
    float mixAfter = clamp(uStrength, 0.0, 1.0) * (1.0 - clamp(texture2D(tBackground, vUv).a, 0.0, 1.0));
    gl_FragColor = vec4(mix(current.rgb, trail, mixAfter), mix(current.a, trailAlpha, mixAfter));
  }
`;

const OUTPUT_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tMap;
  uniform sampler2D tForeground;
  uniform float uForegroundNormal;
  uniform float uNoiseAmount;
  uniform float uNoiseTime;
  uniform float uVignetteAmount;
  uniform float uVignetteRadius;
  uniform float uVignetteSoftness;
  uniform float uVignetteAspect;
  uniform float uScreenOffset;
  uniform float uScreenScale;
  uniform float uGradient;
  uniform vec3 uGradientColor1;
  uniform vec3 uGradientColor2;
  uniform vec3 uGradientColor3;
  uniform float uGradientAngle;
  uniform float uGradientSmooth;
  uniform float uGradientPoints;
  uniform float uGradientBias1;
  uniform float uGradientBias2;
  uniform float uGradientDarken;
  uniform float uLoadFade;
  uniform float uBehindDarken;
  uniform float uBehindSaturation;

  ${THREE.ShaderChunk.tonemapping_pars_fragment}

  vec3 linearToSRGB(vec3 c) {
    c = max(c, vec3(0.0));
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }

  float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  float gradientMix(float position, float bias) {
    float centre = clamp(0.5 + bias, 0.0, 1.0);
    float halfSmooth = clamp(uGradientSmooth, 0.0, 100.0) / 200.0;
    if (halfSmooth <= 0.0001) return step(centre, position);
    return smoothstep(centre - halfSmooth, centre + halfSmooth, position);
  }

  // the original's gradient, which it composes in sRGB
  vec3 gradientColor(vec2 uv) {
    float angle = radians(uGradientAngle);
    vec2 direction = vec2(sin(angle), cos(angle));
    vec2 aspectUv = (uv - 0.5) * vec2(uVignetteAspect, 1.0);
    float extent = abs(direction.x) * uVignetteAspect + abs(direction.y);
    float position = dot(aspectUv, direction) / extent + 0.5;
    if (uGradientPoints < 2.5) {
      return mix(uGradientColor1, uGradientColor3, gradientMix(position, uGradientBias1));
    }
    if (position < 0.5) {
      return mix(uGradientColor1, uGradientColor2, gradientMix(position * 2.0, uGradientBias1));
    }
    return mix(uGradientColor2, uGradientColor3, gradientMix((position - 0.5) * 2.0, uGradientBias2));
  }

  void main() {
    vec4 scene = texture2D(tMap, vUv);
    vec3 color = scene.rgb;
    float alpha = scene.a;
    vec2 screenUv = vec2(vUv.x, vUv.y * uScreenScale + uScreenOffset);

    vec4 foreground = texture2D(tForeground, vUv);
    color = uForegroundNormal > 0.5 ? color * (1.0 - foreground.a) + foreground.rgb : color + foreground.rgb;
    alpha += clamp(foreground.a, 0.0, 1.0) * (1.0 - alpha);

    if (uNoiseAmount > 0.0001) {
      color += (rand(floor(gl_FragCoord.xy) + vec2(uNoiseTime * 59.0, uNoiseTime * 83.0)) - 0.5) * uNoiseAmount;
    }

    if (uVignetteAmount > 0.0) {
      vec2 v = screenUv - 0.5;
      v.x *= uVignetteAspect;
      float edge = smoothstep(uVignetteRadius - max(uVignetteSoftness, 0.0001), uVignetteRadius, length(v));
      float shade = mix(1.0, 1.0 - uVignetteAmount, edge);
      color *= mix(1.0, shade, smoothstep(0.5, 1.0, screenUv.y));
    }

    if (uGradient > 0.5) {
      vec3 gradient = gradientColor(screenUv) * (1.0 - clamp(uGradientDarken, 0.0, 1.0));
      gradient *= mix(0.05, 1.0, clamp(uLoadFade, 0.0, 1.0));
      color = mix(pow(gradient, vec3(2.2)), color, clamp(alpha, 0.0, 1.0));
    }

    color = NeutralToneMapping(max(color, vec3(0.0)));
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(vec3(luma), color, uBehindSaturation) * (1.0 - uBehindDarken);
    gl_FragColor = vec4(linearToSRGB(color), 1.0);
  }
`;

function fullscreenPass(fragmentShader: string, uniforms: Record<string, THREE.IUniform>) {
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: FULLSCREEN_VERT,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { material, scene, mesh };
}

const TARGET_OPTIONS: THREE.RenderTargetOptions = {
  type: THREE.HalfFloatType,
  format: THREE.RGBAFormat,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  depthBuffer: false,
  stencilBuffer: false,
};

const ENVIRONMENTS = { apartment: 1, autumnField: 2, shopappOffice: 3 } as const;

export type ScreenPlacement = {
  top: number;
  width: number;
  height: number;
  viewportHeight: number;
  shift: number;
};

export type Composite = {
  backgroundTarget: THREE.WebGLRenderTarget;
  pointsTarget: THREE.WebGLRenderTarget;
  foregroundTarget: THREE.WebGLRenderTarget;
  setSize: (width: number, height: number) => void;
  render: (opts: {
    camera: THREE.PerspectiveCamera;
    time: number;
    loadFade: number;
    behindDarken: number;
    behindSaturation: number;
    screen: ScreenPlacement;
  }) => void;
  dispose: () => void;
};

export function createComposite(
  renderer: THREE.WebGLRenderer,
  options: {
    backdrop: Backdrop;
    post: PostSettings;
    mainScale: number;
    backgroundNormal: boolean;
    pointsNormal: boolean;
    foregroundNormal: boolean;
  },
): Composite {
  const { backdrop, post } = options;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const backgroundTarget = new THREE.WebGLRenderTarget(1, 1, TARGET_OPTIONS);
  const pointsTarget = new THREE.WebGLRenderTarget(1, 1, { ...TARGET_OPTIONS, depthBuffer: true });
  const foregroundTarget = new THREE.WebGLRenderTarget(1, 1, TARGET_OPTIONS);
  const layersTarget = new THREE.WebGLRenderTarget(1, 1, TARGET_OPTIONS);
  const bloomA = new THREE.WebGLRenderTarget(1, 1, TARGET_OPTIONS);
  const bloomB = new THREE.WebGLRenderTarget(1, 1, TARGET_OPTIONS);
  let trailRead = new THREE.WebGLRenderTarget(1, 1, TARGET_OPTIONS);
  let trailWrite = new THREE.WebGLRenderTarget(1, 1, TARGET_OPTIONS);

  const environmentRotation = new THREE.Matrix3();
  let environment = 0;
  let environmentIntensity = 0;
  if (backdrop.kind === "environment") {
    environment = ENVIRONMENTS[backdrop.environment];
    environmentIntensity = backdrop.intensity;
    const rotation = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...backdrop.rotation)).invert();
    environmentRotation.setFromMatrix4(rotation);
  }

  const layers = fullscreenPass(LAYERS_FRAG, {
    tBackground: { value: backgroundTarget.texture },
    tPoints: { value: pointsTarget.texture },
    uBackgroundNormal: { value: options.backgroundNormal ? 1 : 0 },
    uPointsNormal: { value: options.pointsNormal ? 1 : 0 },
    uEnvironment: { value: environment },
    uEnvironmentIntensity: { value: environmentIntensity },
    uEnvironmentRotation: { value: environmentRotation },
    uCameraWorld: { value: new THREE.Matrix4() },
    uProjectionInverse: { value: new THREE.Matrix4() },
    uLoadFade: { value: 0 },
  });

  const blur = fullscreenPass(BLUR_FRAG, {
    tMap: { value: null },
    uDirection: { value: new THREE.Vector2() },
    uThreshold: { value: 0 },
  });

  const afterimage = fullscreenPass(AFTERIMAGE_FRAG, {
    tDiffuse: { value: layersTarget.texture },
    tOld: { value: trailRead.texture },
    tBloom: { value: bloomB.texture },
    tBackground: { value: backgroundTarget.texture },
    uDamp: { value: post.afterimage?.damp ?? 0 },
    uStrength: { value: post.afterimage?.strength ?? 0 },
    uThreshold: { value: post.afterimage?.threshold ?? 0 },
    // the original sums several blur levels; one wide level stands in for them
    uBloomOpacity: { value: post.bloom.intensity * post.bloom.opacity * 2 },
    uChromaticAmount: { value: post.chromatic?.amount ?? 0 },
    uChromaticAngle: { value: post.chromatic?.angle ?? 0 },
    uScreenOffset: { value: 0 },
    uScreenScale: { value: 1 },
    uTrailShift: { value: 0 },
  });

  const gradient = backdrop.kind === "gradient" ? backdrop : null;
  // the gradient is authored as sRGB hex and mixed in sRGB, so keep the raw values
  const srgb = (hex: string) => {
    const color = new THREE.Color(hex);
    color.convertLinearToSRGB();
    return new THREE.Vector3(color.r, color.g, color.b);
  };
  const output = fullscreenPass(OUTPUT_FRAG, {
    tMap: { value: trailRead.texture },
    tForeground: { value: foregroundTarget.texture },
    uForegroundNormal: { value: options.foregroundNormal ? 1 : 0 },
    uNoiseAmount: { value: post.noise },
    uNoiseTime: { value: 0 },
    uVignetteAmount: { value: post.vignette?.amount ?? 0 },
    uVignetteRadius: { value: post.vignette?.radius ?? 1 },
    uVignetteSoftness: { value: post.vignette?.softness ?? 0.5 },
    uVignetteAspect: { value: 1 },
    uScreenOffset: { value: 0 },
    uScreenScale: { value: 1 },
    uGradient: { value: gradient ? 1 : 0 },
    uGradientColor1: { value: srgb(gradient?.colors[0] ?? "#000000") },
    uGradientColor2: { value: srgb(gradient?.colors[1] ?? "#000000") },
    uGradientColor3: { value: srgb(gradient?.colors[2] ?? "#000000") },
    uGradientAngle: { value: gradient?.angle ?? 0 },
    uGradientSmooth: { value: gradient?.smooth ?? 0 },
    uGradientPoints: { value: gradient?.points ?? 2 },
    uGradientBias1: { value: gradient?.bias1 ?? 0 },
    uGradientBias2: { value: gradient?.bias2 ?? 0 },
    uGradientDarken: { value: gradient?.darken ?? 0 },
    uLoadFade: { value: 0 },
    uBehindDarken: { value: 0 },
    uBehindSaturation: { value: 1 },
  });

  const clearTrails = () => {
    const previousColor = new THREE.Color();
    renderer.getClearColor(previousColor);
    const previousAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    for (const target of [trailRead, trailWrite]) {
      renderer.setRenderTarget(target);
      renderer.clear(true, false, false);
    }
    renderer.setRenderTarget(null);
    renderer.setClearColor(previousColor, previousAlpha);
  };

  let bloomTexel = new THREE.Vector2(1, 1);

  return {
    backgroundTarget,
    pointsTarget,
    foregroundTarget,
    setSize(width, height) {
      const w = Math.max(1, Math.round(width));
      const h = Math.max(1, Math.round(height));
      const scaled = (scale: number) => [
        Math.max(1, Math.round(w * (scale / options.mainScale))),
        Math.max(1, Math.round(h * (scale / options.mainScale))),
      ] as const;
      backgroundTarget.setSize(...scaled(post.volumeScale.background));
      foregroundTarget.setSize(...scaled(post.volumeScale.foreground));
      pointsTarget.setSize(w, h);
      layersTarget.setSize(w, h);
      trailRead.setSize(w, h);
      trailWrite.setSize(w, h);
      const bw = Math.max(1, Math.round(w / 6));
      const bh = Math.max(1, Math.round(h / 6));
      bloomA.setSize(bw, bh);
      bloomB.setSize(bw, bh);
      bloomTexel = new THREE.Vector2(1 / bw, 1 / bh).multiplyScalar(1 + post.bloom.radius * 2);
      clearTrails();
    },
    render({ camera: sceneCamera, time, loadFade, behindDarken, behindSaturation, screen }) {
      const screenScale = screen.height / screen.viewportHeight;
      const screenOffset = (screen.viewportHeight - screen.top - screen.height) / screen.viewportHeight;

      layers.material.uniforms.uCameraWorld.value.copy(sceneCamera.matrixWorld);
      layers.material.uniforms.uProjectionInverse.value.copy(sceneCamera.projectionMatrixInverse);
      layers.material.uniforms.uLoadFade.value = loadFade;
      renderer.setRenderTarget(layersTarget);
      renderer.render(layers.scene, camera);

      blur.material.uniforms.tMap.value = layersTarget.texture;
      blur.material.uniforms.uDirection.value.set(bloomTexel.x, 0);
      blur.material.uniforms.uThreshold.value = post.bloom.threshold;
      renderer.setRenderTarget(bloomA);
      renderer.render(blur.scene, camera);
      blur.material.uniforms.tMap.value = bloomA.texture;
      blur.material.uniforms.uDirection.value.set(0, bloomTexel.y);
      blur.material.uniforms.uThreshold.value = 0;
      renderer.setRenderTarget(bloomB);
      renderer.render(blur.scene, camera);

      const a = afterimage.material.uniforms;
      a.tOld.value = trailRead.texture;
      a.uScreenScale.value = screenScale;
      a.uScreenOffset.value = screenOffset;
      a.uTrailShift.value = screen.shift / screen.height;
      renderer.setRenderTarget(trailWrite);
      renderer.render(afterimage.scene, camera);
      const swap = trailRead;
      trailRead = trailWrite;
      trailWrite = swap;

      const o = output.material.uniforms;
      o.tMap.value = trailRead.texture;
      o.uNoiseTime.value = time % 10;
      o.uScreenScale.value = screenScale;
      o.uScreenOffset.value = screenOffset;
      o.uVignetteAspect.value = screen.width / screen.viewportHeight;
      o.uLoadFade.value = loadFade;
      o.uBehindDarken.value = behindDarken;
      o.uBehindSaturation.value = behindSaturation;
      renderer.setRenderTarget(null);
      renderer.render(output.scene, camera);
    },
    dispose() {
      for (const target of [backgroundTarget, pointsTarget, foregroundTarget, layersTarget, bloomA, bloomB, trailRead, trailWrite]) {
        target.dispose();
      }
      for (const pass of [layers, blur, afterimage, output]) {
        pass.mesh.geometry.dispose();
        pass.material.dispose();
      }
    },
  };
}
