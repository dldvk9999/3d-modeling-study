// Stitches the layers back together the way the original's pipeline does:
// a dim blurred room behind everything, the light volume (rendered small, so
// it's soft), the point cloud with a long afterimage trail, a touch of bloom,
// chromatic fringing, grain, a vignette over the top half, neutral tone mapping.

import * as THREE from "three";
import { POST } from "./preset";

const FULLSCREEN_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// separable blur used for the bloom
const BLUR_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tMap;
  uniform vec2 uDirection;
  void main() {
    vec3 sum = texture2D(tMap, vUv).rgb * 0.227027;
    sum += texture2D(tMap, vUv + uDirection * 1.384615).rgb * 0.316216;
    sum += texture2D(tMap, vUv - uDirection * 1.384615).rgb * 0.316216;
    sum += texture2D(tMap, vUv + uDirection * 3.230769).rgb * 0.070270;
    sum += texture2D(tMap, vUv - uDirection * 3.230769).rgb * 0.070270;
    gl_FragColor = vec4(sum, 1.0);
  }
`;

// background + volume + points, before any trails
const LAYERS_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tVolume;
  uniform sampler2D tPoints;
  uniform mat4 uCameraWorld;
  uniform mat4 uProjectionInverse;
  uniform float uEnvironment;
  uniform float uLoadFade;

  // A heavily blurred interior seen through the dark: a warm floor, a wall,
  // and the soft bloom of a window off to one side.
  vec3 room(vec3 dir) {
    float up = dir.y;
    vec3 col = mix(vec3(0.20, 0.16, 0.13), vec3(0.34, 0.31, 0.30), smoothstep(-0.6, 0.5, up));
    vec3 window = normalize(vec3(0.75, 0.25, 0.6));
    col += vec3(1.6, 1.5, 1.35) * pow(max(dot(dir, window), 0.0), 6.0);
    vec3 lamp = normalize(vec3(-0.8, 0.1, 0.35));
    col += vec3(0.9, 0.6, 0.35) * pow(max(dot(dir, lamp), 0.0), 10.0);
    col *= 0.75 + 0.25 * smoothstep(-0.2, 0.3, dir.z);
    return col;
  }

  void main() {
    vec4 ndc = vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
    vec4 view = uProjectionInverse * ndc;
    vec3 dir = normalize((uCameraWorld * vec4(view.xyz / view.w, 0.0)).xyz);

    vec3 color = room(dir) * uEnvironment * uLoadFade;
    vec4 volume = texture2D(tVolume, vUv);
    color += volume.rgb + texture2D(tPoints, vUv).rgb;
    // the volume's coverage rides along in alpha, so the trail pass can keep
    // the afterimage off it
    gl_FragColor = vec4(color, clamp(volume.a, 0.0, 1.0));
  }
`;

const AFTERIMAGE_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tDiffuse;
  uniform sampler2D tOld;
  uniform sampler2D tBloom;
  uniform float uDamp;
  uniform float uStrength;
  uniform float uBloomOpacity;
  uniform float uChromaticAmount;
  uniform float uChromaticAngle;
  uniform float uNoiseAmount;
  uniform float uNoiseTime;
  uniform float uVignetteAmount;
  uniform float uVignetteRadius;
  uniform float uVignetteSoftness;
  uniform float uVignetteAspect;
  // where this canvas sits in the viewport, in viewport uv
  uniform float uScreenOffset;
  uniform float uScreenScale;
  // how far the canvas slid since last frame, so the trail stays put on screen
  uniform float uTrailShift;

  float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  void main() {
    vec4 current = texture2D(tDiffuse, vUv);
    vec2 screenUv = vec2(vUv.x, vUv.y * uScreenScale + uScreenOffset);

    // colour fringes that grow towards the edges
    vec2 centre = screenUv - 0.5;
    float radius = length(centre);
    vec2 dir = radius > 0.00001 ? centre / radius : vec2(0.0);
    float c = cos(uChromaticAngle);
    float s = sin(uChromaticAngle);
    dir = vec2(dir.x * c - dir.y * s, dir.x * s + dir.y * c);
    vec2 offset = dir * uChromaticAmount * (radius + 0.15) * smoothstep(0.0, 0.05, radius);
    offset.y /= uScreenScale;
    float red = texture2D(tDiffuse, clamp(vUv + offset, 0.0, 1.0)).r;
    float blue = texture2D(tDiffuse, clamp(vUv - offset, 0.0, 1.0)).b;
    current.rgb = vec3(red, current.g, blue);

    current.rgb += texture2D(tBloom, vUv).rgb * uBloomOpacity;

    // the afterimage: keep the brighter of now and a slowly fading past, but
    // not over the light volume, whose alpha masks the trail out
    vec3 decayed = texture2D(tOld, vUv - vec2(0.0, uTrailShift)).rgb * uDamp;
    vec3 trail = max(current.rgb, decayed);
    float mixAfter = clamp(uStrength, 0.0, 1.0) * (1.0 - clamp(current.a, 0.0, 1.0));
    vec3 color = mix(current.rgb, trail, mixAfter);

    vec2 cell = floor(gl_FragCoord.xy);
    color += (rand(cell + vec2(uNoiseTime * 59.0, uNoiseTime * 83.0)) - 0.5) * uNoiseAmount;

    vec2 v = centre;
    v.x *= uVignetteAspect;
    float edge = smoothstep(uVignetteRadius - max(uVignetteSoftness, 0.0001), uVignetteRadius, length(v));
    float shade = mix(1.0, 1.0 - uVignetteAmount, edge);
    shade = mix(1.0, shade, smoothstep(0.5, 1.0, screenUv.y));
    color *= shade;

    gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
  }
`;

const OUTPUT_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tMap;
  uniform float uBehindDarken;
  uniform float uBehindSaturation;

  ${THREE.ShaderChunk.tonemapping_pars_fragment}

  vec3 linearToSRGB(vec3 c) {
    c = max(c, vec3(0.0));
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }

  void main() {
    vec3 color = texture2D(tMap, vUv).rgb;
    color = NeutralToneMapping(color);
    // with the section's content scrolled over it, the scene steps back
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

export type Composite = {
  volumeTarget: THREE.WebGLRenderTarget;
  pointsTarget: THREE.WebGLRenderTarget;
  setSize: (width: number, height: number) => void;
  render: (opts: {
    camera: THREE.PerspectiveCamera;
    time: number;
    loadFade: number;
    behindDarken: number;
    behindSaturation: number;
    /** the canvas's place in the viewport, in CSS px; shift is how far its top moved */
    screen: { top: number; width: number; height: number; viewportHeight: number; shift: number };
  }) => void;
  dispose: () => void;
};

export function createComposite(renderer: THREE.WebGLRenderer): Composite {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const volumeTarget = new THREE.WebGLRenderTarget(1, 1, TARGET_OPTIONS);
  const pointsTarget = new THREE.WebGLRenderTarget(1, 1, TARGET_OPTIONS);
  const layersTarget = new THREE.WebGLRenderTarget(1, 1, TARGET_OPTIONS);
  const bloomA = new THREE.WebGLRenderTarget(1, 1, TARGET_OPTIONS);
  const bloomB = new THREE.WebGLRenderTarget(1, 1, TARGET_OPTIONS);
  let trailRead = new THREE.WebGLRenderTarget(1, 1, TARGET_OPTIONS);
  let trailWrite = new THREE.WebGLRenderTarget(1, 1, TARGET_OPTIONS);

  const layers = fullscreenPass(LAYERS_FRAG, {
    tVolume: { value: volumeTarget.texture },
    tPoints: { value: pointsTarget.texture },
    uCameraWorld: { value: new THREE.Matrix4() },
    uProjectionInverse: { value: new THREE.Matrix4() },
    uEnvironment: { value: 1 - POST.environment.darken },
    uLoadFade: { value: 0 },
  });

  const blur = fullscreenPass(BLUR_FRAG, {
    tMap: { value: null },
    uDirection: { value: new THREE.Vector2() },
  });

  const afterimage = fullscreenPass(AFTERIMAGE_FRAG, {
    tDiffuse: { value: layersTarget.texture },
    tOld: { value: trailRead.texture },
    tBloom: { value: bloomB.texture },
    uDamp: { value: POST.afterimage.damp },
    uStrength: { value: POST.afterimage.strength },
    // the original sums several blur levels; one wide level stands in for them
    uBloomOpacity: { value: POST.bloom.intensity * POST.bloom.opacity * 2 },
    uChromaticAmount: { value: POST.chromatic.amount },
    uChromaticAngle: { value: POST.chromatic.angle },
    uNoiseAmount: { value: POST.noise },
    uNoiseTime: { value: 0 },
    uVignetteAmount: { value: POST.vignette.amount },
    uVignetteRadius: { value: POST.vignette.radius },
    uVignetteSoftness: { value: POST.vignette.softness },
    uVignetteAspect: { value: 1 },
    uScreenOffset: { value: 0 },
    uScreenScale: { value: 1 },
    uTrailShift: { value: 0 },
  });

  const output = fullscreenPass(OUTPUT_FRAG, {
    tMap: { value: trailRead.texture },
    uBehindDarken: { value: 0 },
    uBehindSaturation: { value: 1 },
  });

  const clearTargets = () => {
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
    volumeTarget,
    pointsTarget,
    setSize(width, height) {
      const w = Math.max(1, Math.round(width));
      const h = Math.max(1, Math.round(height));
      const volumeRatio = POST.volumeScale / POST.mainScale;
      volumeTarget.setSize(Math.max(1, Math.round(w * volumeRatio)), Math.max(1, Math.round(h * volumeRatio)));
      pointsTarget.setSize(w, h);
      layersTarget.setSize(w, h);
      trailRead.setSize(w, h);
      trailWrite.setSize(w, h);
      const bw = Math.max(1, Math.round(w / 6));
      const bh = Math.max(1, Math.round(h / 6));
      bloomA.setSize(bw, bh);
      bloomB.setSize(bw, bh);
      bloomTexel = new THREE.Vector2(1 / bw, 1 / bh).multiplyScalar(1 + POST.bloom.radius * 2);
      clearTargets();
    },
    render({ camera: sceneCamera, time, loadFade, behindDarken, behindSaturation, screen }) {
      const uniforms = afterimage.material.uniforms;
      uniforms.uScreenScale.value = screen.height / screen.viewportHeight;
      uniforms.uScreenOffset.value =
        (screen.viewportHeight - screen.top - screen.height) / screen.viewportHeight;
      uniforms.uVignetteAspect.value = screen.width / screen.viewportHeight;
      uniforms.uTrailShift.value = screen.shift / screen.height;

      layers.material.uniforms.uCameraWorld.value.copy(sceneCamera.matrixWorld);
      layers.material.uniforms.uProjectionInverse.value.copy(sceneCamera.projectionMatrixInverse);
      layers.material.uniforms.uLoadFade.value = loadFade;
      renderer.setRenderTarget(layersTarget);
      renderer.render(layers.scene, camera);

      // bloom off a small blurred copy
      blur.material.uniforms.tMap.value = layersTarget.texture;
      blur.material.uniforms.uDirection.value.set(bloomTexel.x, 0);
      renderer.setRenderTarget(bloomA);
      renderer.render(blur.scene, camera);
      blur.material.uniforms.tMap.value = bloomA.texture;
      blur.material.uniforms.uDirection.value.set(0, bloomTexel.y);
      renderer.setRenderTarget(bloomB);
      renderer.render(blur.scene, camera);

      afterimage.material.uniforms.tOld.value = trailRead.texture;
      afterimage.material.uniforms.uNoiseTime.value = time % 10;
      renderer.setRenderTarget(trailWrite);
      renderer.render(afterimage.scene, camera);
      const swap = trailRead;
      trailRead = trailWrite;
      trailWrite = swap;

      output.material.uniforms.tMap.value = trailRead.texture;
      output.material.uniforms.uBehindDarken.value = behindDarken;
      output.material.uniforms.uBehindSaturation.value = behindSaturation;
      renderer.setRenderTarget(null);
      renderer.render(output.scene, camera);
    },
    dispose() {
      for (const target of [volumeTarget, pointsTarget, layersTarget, bloomA, bloomB, trailRead, trailWrite]) {
        target.dispose();
      }
      for (const pass of [layers, blur, afterimage, output]) {
        pass.mesh.geometry.dispose();
        pass.material.dispose();
      }
    },
  };
}
