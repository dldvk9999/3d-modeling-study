"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createBackdrop } from "./hero/backdrop";
import { createFluid } from "./hero/fluid";
import { createParticleField } from "./hero/particleField";
import { RING, createTextRing } from "./hero/textRing";

const DEG = Math.PI / 180;
const PERSPECTIVE_PX = 5400;

export default function HeroScene({ fontFamily }: { fontFamily: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let cleanup = () => {};

    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const start = async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      // the mount can still be measuring zero on the frame the effect runs
      for (let i = 0; i < 90 && !disposed; i++) {
        if (mount.clientWidth > 0 && mount.clientHeight > 0) break;
        await nextFrame();
      }
      if (disposed || mount.clientWidth === 0 || mount.clientHeight === 0) return;

      const width = mount.clientWidth;
      const height = mount.clientHeight;
      // the scene is measured in vmin units, exactly like the original
      const vmin = Math.min(width, height) / 100;

      const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.setClearColor(new THREE.Color("#1b1a22"), 1);
      // colors are authored in the 2D canvas already, so pass them straight through
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const cameraDistance = PERSPECTIVE_PX / vmin;
      const fov = 2 * Math.atan(height / 2 / PERSPECTIVE_PX) * (180 / Math.PI);
      const camera = new THREE.PerspectiveCamera(fov, width / height, 1, cameraDistance * 4);
      camera.position.z = cameraDistance;

      const viewHeight = (height / vmin) * 1.02;
      const viewWidth = (width / vmin) * 1.02;

      const fluid = createFluid(renderer, 160);
      fluid.setAspect(width / height);

      // --- gradient backdrop ----------------------------------------------------
      const backdropDepth = 260;
      const backdropScale = (cameraDistance + backdropDepth) / cameraDistance;
      const backdrop = createBackdrop(
        viewWidth * backdropScale,
        viewHeight * backdropScale,
        width / height
      );
      backdrop.mesh.position.z = -backdropDepth;
      scene.add(backdrop.mesh);

      // --- particles -----------------------------------------------------------
      const isCoarse = window.matchMedia("(pointer: coarse)").matches;
      const count = isCoarse ? 36000 : 86000;
      const field = createParticleField(count, viewWidth * 1.1, viewHeight, fluid.texture);
      field.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
      scene.add(field.points);

      // --- the "Everywhere" ring ----------------------------------------------
      // canvas2d can't parse var(), so let the browser resolve the stack first
      const probe = document.createElement("span");
      probe.style.fontFamily = fontFamily;
      mount.appendChild(probe);
      const resolvedFont = getComputedStyle(probe).fontFamily || "Helvetica, Arial, sans-serif";
      mount.removeChild(probe);

      const ring = createTextRing(resolvedFont, fluid.texture);
      scene.add(ring.tiltGroup);

      // --- pointer -------------------------------------------------------------
      const pointer = new THREE.Vector2(-10, -10);
      const pointerVel = new THREE.Vector2();
      const lastPointer = new THREE.Vector2(-10, -10);
      let pointerActive = false;
      let pointerX = 0;
      let smoothedPointerRotation = 0;

      const onPointerMove = (event: PointerEvent) => {
        const rect = mount.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = 1 - (event.clientY - rect.top) / rect.height;
        if (pointerActive) {
          pointerVel.set((x - lastPointer.x) * 6.5, (y - lastPointer.y) * 6.5);
        }
        pointer.set(x, y);
        lastPointer.set(x, y);
        pointerX = x * 2 - 1;
        pointerActive = true;
      };
      const onPointerLeave = () => {
        pointerActive = false;
        pointerVel.set(0, 0);
      };
      window.addEventListener("pointermove", onPointerMove);
      mount.addEventListener("pointerleave", onPointerLeave);

      // --- scroll --------------------------------------------------------------
      const scrollOrigin = window.scrollY;
      let lastScrollY = window.scrollY;
      let scrollSpinDeg = 0;
      let scrollYOffset = 0;
      const readScroll = () => {
        const y = window.scrollY;
        const delta = Math.max(-180, Math.min(180, y - lastScrollY));
        scrollSpinDeg -= delta * RING.scrollSpinDegPerPx;
        lastScrollY = y;
        scrollYOffset = Math.max(0, (y - scrollOrigin) * RING.scrollYPerPx);
      };

      // --- resize --------------------------------------------------------------
      const onResize = () => {
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        const v = Math.min(w, h) / 100;
        renderer.setSize(w, h);
        camera.fov = 2 * Math.atan(h / 2 / PERSPECTIVE_PX) * (180 / Math.PI);
        camera.aspect = w / h;
        camera.position.z = PERSPECTIVE_PX / v;
        camera.updateProjectionMatrix();
        fluid.setAspect(w / h);
        field.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();

        const vh = (h / v) * 1.02;
        const vw = (w / v) * 1.02;
        const s = (camera.position.z + backdropDepth) / camera.position.z;
        backdrop.mesh.geometry.dispose();
        backdrop.mesh.geometry = new THREE.PlaneGeometry(vw * s, vh * s);
        backdrop.material.uniforms.uAspect.value = w / h;
      };
      window.addEventListener("resize", onResize);

      // --- loop ----------------------------------------------------------------
      const startedAt = performance.now();
      let lastFrameAt = startedAt;
      let raf = 0;
      const tick = () => {
        frame();
        raf = requestAnimationFrame(tick);
      };

      const frame = () => {
        const now = performance.now();
        const dt = Math.min((now - lastFrameAt) / 1000, 1 / 24);
        lastFrameAt = now;
        const elapsedMs = now - startedAt;
        const elapsed = elapsedMs / 1000;

        readScroll();
        fluid.step(dt, pointer, pointerVel);
        pointerVel.multiplyScalar(0.86);

        const intro = Math.min(1, elapsed / 2.6);
        const eased = intro * intro * (3 - 2 * intro);

        // pointer tips the ring on its X axis, damped
        const targetRotation = pointerActive ? pointerX * RING.pointerXRotationDeg : 0;
        const lerpAmount = 1 - Math.exp(-RING.pointerXRotationDamping * dt);
        smoothedPointerRotation += (targetRotation - smoothedPointerRotation) * lerpAmount;

        ring.tiltGroup.rotation.x = RING.tiltDeg * DEG;
        ring.tiltGroup.position.y = scrollYOffset;
        ring.spinGroup.rotation.y =
          (ring.angleAt(elapsedMs) + scrollSpinDeg + smoothedPointerRotation) * DEG;
        ring.update(elapsedMs, fluid.texture, RING.pointerRepulseStrength, eased);

        field.material.uniforms.uTime.value = elapsed;
        field.material.uniforms.uIntro.value = eased;
        field.material.uniforms.uFluid.value = fluid.texture;
        field.material.uniforms.uFluidInfluence.value = 26;
        backdrop.material.uniforms.uOpacity.value = eased;
        backdrop.material.uniforms.uTime.value = elapsed;

        renderer.render(scene, camera);
      };
      tick();

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("resize", onResize);
        mount.removeEventListener("pointerleave", onPointerLeave);
        ring.dispose();
        field.dispose();
        fluid.dispose();
        backdrop.mesh.geometry.dispose();
        backdrop.material.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      };
    };

    start();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [fontFamily]);

  return <div ref={mountRef} className="absolute inset-0 h-full w-full" />;
}
