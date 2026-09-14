// A cheap advected velocity field. The pointer stamps momentum into it, the
// field carries that momentum along and dissipates it — which is what gives the
// particles and the letters their rolling, liquid wobble.

import * as THREE from "three";

export type Fluid = {
  texture: THREE.Texture;
  step: (dt: number, pointer: THREE.Vector2, pointerVel: THREE.Vector2) => void;
  setAspect: (aspect: number) => void;
  dispose: () => void;
};

const VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPrev;
  uniform vec2 uPointer;
  uniform vec2 uPointerVel;
  uniform float uDt;
  uniform float uDissipation;
  uniform float uRadius;
  uniform float uAspect;

  void main() {
    vec2 vel = texture2D(uPrev, vUv).xy;
    vec2 src = vUv - vel * uDt * 0.35;
    vec2 carried = texture2D(uPrev, src).xy * uDissipation;

    vec2 d = vUv - uPointer;
    d.x *= uAspect;
    float fall = exp(-dot(d, d) / uRadius);
    carried += uPointerVel * fall;

    // let the field curl a little so it never settles into a straight push
    float swirl = fall * 0.6;
    carried += vec2(-d.y, d.x) * swirl * length(uPointerVel) * 1.4;

    gl_FragColor = vec4(clamp(carried, -4.0, 4.0), 0.0, 1.0);
  }
`;

export function createFluid(renderer: THREE.WebGLRenderer, size = 160): Fluid {
  const options: THREE.RenderTargetOptions = {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
  };

  let read = new THREE.WebGLRenderTarget(size, size, options);
  let write = new THREE.WebGLRenderTarget(size, size, options);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPrev: { value: read.texture },
      uPointer: { value: new THREE.Vector2(-10, -10) },
      uPointerVel: { value: new THREE.Vector2() },
      uDt: { value: 0 },
      uDissipation: { value: 0.965 },
      uRadius: { value: 0.008 },
      uAspect: { value: 1 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    depthTest: false,
    depthWrite: false,
  });

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  scene.add(quad);

  const clearAll = () => {
    const prevTarget = renderer.getRenderTarget();
    const prevClear = new THREE.Color();
    renderer.getClearColor(prevClear);
    const prevAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 1); // zero velocity, not the scene's backdrop
    for (const rt of [read, write]) {
      renderer.setRenderTarget(rt);
      renderer.clearColor();
    }
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevClear, prevAlpha);
  };
  clearAll();

  const fluid: Fluid = {
    texture: read.texture,
    step(dt, pointer, pointerVel) {
      material.uniforms.uPrev.value = read.texture;
      material.uniforms.uPointer.value.copy(pointer);
      material.uniforms.uPointerVel.value.copy(pointerVel);
      material.uniforms.uDt.value = Math.min(dt, 1 / 30);

      const prevTarget = renderer.getRenderTarget();
      renderer.setRenderTarget(write);
      renderer.render(scene, camera);
      renderer.setRenderTarget(prevTarget);

      const swap = read;
      read = write;
      write = swap;
      fluid.texture = read.texture;
    },
    setAspect(aspect) {
      material.uniforms.uAspect.value = aspect;
    },
    dispose() {
      read.dispose();
      write.dispose();
      quad.geometry.dispose();
      material.dispose();
    },
  };

  return fluid;
}
