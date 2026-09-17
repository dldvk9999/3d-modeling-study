"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { fragmentFor, type SceneVariant } from "./chapterVariants";

// A full-screen quad running one of the procedural chapter backdrops.
const VERT = `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export default function ChapterScene({
  warm = "#d19a57",
  cool = "#75a8c2",
  variant = "aurora",
  tilt = 0,
}: {
  variant?: SceneVariant;
  tilt?: number;
  warm?: string;
  cool?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // A page of chapters would otherwise hold a dozen live WebGL contexts and
    // the browser starts dropping the oldest, so each scene only builds one
    // when it comes near the viewport and gives it back when it leaves.
    const el = mount;
    let stop: (() => void) | null = null;
    const nearby = new IntersectionObserver(
      (entries) => {
        const near = entries[0]?.isIntersecting ?? false;
        if (near && !stop) stop = startScene();
        else if (!near && stop) {
          stop();
          stop = null;
        }
      },
      { rootMargin: "120% 0px" },
    );
    nearby.observe(mount);

    return () => {
      nearby.disconnect();
      stop?.();
    };

    function startScene() {
      const renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(el.clientWidth, el.clientHeight);
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      el.appendChild(renderer.domElement);

      const material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uRes: {
            value: new THREE.Vector2(
              el.clientWidth * renderer.getPixelRatio(),
              el.clientHeight * renderer.getPixelRatio(),
            ),
          },
          uCenter: { value: new THREE.Vector2(0.06, 0.02) },
          uWarm: { value: new THREE.Color(warm) },
          uCool: { value: new THREE.Color(cool) },
          uFade: { value: 0 },
          uTilt: { value: tilt },
        },
        vertexShader: VERT,
        fragmentShader: fragmentFor(variant),
        depthTest: false,
        depthWrite: false,
      });

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
      quad.frustumCulled = false;
      scene.add(quad);

      const onResize = () => {
        const w = el.clientWidth;
        const h = el.clientHeight;
        renderer.setSize(w, h);
        material.uniforms.uRes.value.set(
          w * renderer.getPixelRatio(),
          h * renderer.getPixelRatio(),
        );
      };
      window.addEventListener("resize", onResize);

      // the pointer nudges the vanishing point, so the tunnel leans as you move
      const target = new THREE.Vector2(0.06, 0.02);
      const onPointerMove = (event: PointerEvent) => {
        const rect = el.getBoundingClientRect();
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
        { threshold: 0 },
      );
      observer.observe(el);

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
        if (renderer.domElement.parentNode === el)
          el.removeChild(renderer.domElement);
      };
    }
  }, [warm, cool, variant, tilt]);

  return <div ref={mountRef} className="absolute inset-0 h-full w-full" />;
}
