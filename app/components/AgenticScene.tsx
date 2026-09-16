"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

// A warp tunnel: colored light streaks pulled out of the center and flying past
// the viewer. The streaking comes from sampling noise in (angle, log radius)
// space, which stretches every feature along the radial direction.
const FRAG = `
  precision highp float;

  uniform float uTime;
  uniform vec2 uRes;
  uniform vec2 uCenter;
  uniform float uFade;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 w = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
  }

  float fbm(vec2 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      sum += noise(p) * amp;
      p *= 2.02;
      amp *= 0.5;
    }
    return sum;
  }

  vec3 tintFor(float angle, float layer) {
    // muted bronze on one side, steel blue on the other, a little lavender
    // between — the original is desaturated and dark, not rainbow
    vec3 bronze = vec3(0.82, 0.60, 0.34);
    vec3 steel = vec3(0.46, 0.66, 0.76);
    vec3 lavender = vec3(0.60, 0.55, 0.72);
    vec3 pale = vec3(0.88, 0.88, 0.92);
    float a = angle + layer * 0.35;
    float w1 = 0.5 + 0.5 * sin(a);
    float w2 = 0.5 + 0.5 * sin(a * 1.3 + 2.1);
    vec3 col = mix(bronze, steel, w1);
    col = mix(col, lavender, w2 * 0.35);
    return mix(col, pale, 0.12);
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
    vec2 d = uv - uCenter;
    float r = length(d);
    float angle = atan(d.y, d.x);
    float lr = log(r + 0.05);

    vec3 col = vec3(0.0);
    // High angular frequency with a low radial one stretches every feature into
    // a long streak; several layers at different speeds blur them together.
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float flow = uTime * (0.055 + fi * 0.011) + fi * 0.37;
      float n = fbm(vec2(angle * 26.0 + fi * 2.3, lr * 0.16 - flow * 1.1));
      float fine = fbm(vec2(angle * 62.0 + fi * 5.1, lr * 0.12 - flow * 1.5));
      // a high floor keeps the gaps between streaks properly black
      float streak = smoothstep(0.46, 0.92, n) * (0.35 + 0.9 * fine);
      col += tintFor(angle, fi) * streak * 0.30;
    }

    // everything falls away toward the edges and blooms at the vanishing point
    col *= smoothstep(1.3, 0.06, r);
    col += vec3(1.0, 0.90, 0.78) * 0.13 * exp(-r * r * 11.0);

    // sparse stars, thicker away from the center
    vec2 cell = floor(uv * uRes.y * 0.55);
    float star = step(0.9977, hash21(cell));
    float twinkle = 0.6 + 0.4 * sin(uTime * 2.0 + hash21(cell + 3.1) * 6.283);
    col += vec3(0.95, 0.95, 1.0) * star * twinkle * smoothstep(0.08, 0.8, r);

    col = max(col, vec3(0.015, 0.014, 0.022));
    gl_FragColor = vec4(col * uFade, 1.0);
  }
`;

const VERT = `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export default function AgenticScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uRes: {
          value: new THREE.Vector2(
            mount.clientWidth * renderer.getPixelRatio(),
            mount.clientHeight * renderer.getPixelRatio()
          ),
        },
        uCenter: { value: new THREE.Vector2(0.06, 0.02) },
        uFade: { value: 0 },
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

    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      material.uniforms.uRes.value.set(
        w * renderer.getPixelRatio(),
        h * renderer.getPixelRatio()
      );
    };
    window.addEventListener("resize", onResize);

    // the pointer nudges the vanishing point, so the tunnel leans as you move
    const target = new THREE.Vector2(0.06, 0.02);
    const onPointerMove = (event: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = 0.5 - (event.clientY - rect.top) / rect.height;
      target.set(0.06 + x * 0.18, 0.02 + y * 0.14);
    };
    window.addEventListener("pointermove", onPointerMove);

    // only run while the section is on screen
    let visible = true;
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0 }
    );
    observer.observe(mount);

    const startedAt = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      if (visible) {
        material.uniforms.uTime.value = elapsed;
        material.uniforms.uFade.value = Math.min(1, elapsed / 1.4);
        material.uniforms.uCenter.value.lerp(target, 0.03);
        renderer.render(scene, camera);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      quad.geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 h-full w-full" />;
}
