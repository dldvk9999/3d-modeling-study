"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createBackdrop } from "./hero/backdrop";
import { createFluid } from "./hero/fluid";
import { createParticleField } from "./hero/particleField";
import { RING, createTextRing } from "./hero/textRing";

const DEG = Math.PI / 180;
// Closer than the original's 5400px so the ring's depth reads clearly: letters
// at the front loom larger, the ones behind the tree shrink away.
const PERSPECTIVE_PX = 1900;
// on load the camera begins this much further back and glides in
const ARRIVAL_PULLBACK = 1.14;
const ARRIVAL_SECONDS = 7;
// the camera sits a little to the left of and below the tree, still aimed at
// its center, so the scene is seen slightly from the lower left (fractions of
// the camera distance)
const CAMERA_ANGLE = { x: -0.08, y: -0.055 };
// extra margin on the backdrop so the off-axis view never shows its edge
const BACKDROP_MARGIN = 1.15;

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
      // where the camera settles; it starts further back and pushes in to it
      let restDistance = cameraDistance;
      const fov = 2 * Math.atan(height / 2 / PERSPECTIVE_PX) * (180 / Math.PI);
      const camera = new THREE.PerspectiveCamera(fov, width / height, 1, cameraDistance * 4);
      camera.position.z = cameraDistance * ARRIVAL_PULLBACK;

      const viewHeight = (height / vmin) * 1.02;
      const viewWidth = (width / vmin) * 1.02;

      const fluid = createFluid(renderer, 160);
      fluid.setAspect(width / height);

      // --- gradient backdrop ----------------------------------------------------
      const backdropDepth = 260;
      // sized for the pulled-back start so it still fills the frame then
      const backdropScale =
        ((cameraDistance + backdropDepth) / cameraDistance) * ARRIVAL_PULLBACK * BACKDROP_MARGIN;
      const backdrop = createBackdrop(
        viewWidth * backdropScale,
        viewHeight * backdropScale,
        width / height
      );
      backdrop.mesh.position.z = -backdropDepth;
      scene.add(backdrop.mesh);

      // --- particles -----------------------------------------------------------
      const isCoarse = window.matchMedia("(pointer: coarse)").matches;
      const count = isCoarse ? 60000 : 150000;
      const field = createParticleField(count, viewWidth * 1.1, viewHeight, fluid.texture);
      field.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
      field.material.uniforms.uCamDist.value = cameraDistance;
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
        restDistance = PERSPECTIVE_PX / v;
        camera.updateProjectionMatrix();
        fluid.setAspect(w / h);
        field.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
        field.material.uniforms.uCamDist.value = restDistance;

        const vh = (h / v) * 1.02;
        const vw = (w / v) * 1.02;
        const s =
          ((restDistance + backdropDepth) / restDistance) * ARRIVAL_PULLBACK * BACKDROP_MARGIN;
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

        // glide in from the pulled-back start, easing out as it settles
        const arrival = Math.min(1, elapsed / ARRIVAL_SECONDS);
        const arrivalEased = 1 - Math.pow(1 - arrival, 3);
        const camZ = restDistance * (1 + (ARRIVAL_PULLBACK - 1) * (1 - arrivalEased));
        camera.position.set(camZ * CAMERA_ANGLE.x, camZ * CAMERA_ANGLE.y, camZ);
        camera.lookAt(0, 0, 0);

        // pointer tips the ring on its X axis, damped
        const targetRotation = pointerActive ? pointerX * RING.pointerXRotationDeg : 0;
        const lerpAmount = 1 - Math.exp(-RING.pointerXRotationDamping * dt);
        smoothedPointerRotation += (targetRotation - smoothedPointerRotation) * lerpAmount;

        ring.tiltGroup.rotation.x = RING.tiltDeg * DEG;
        ring.tiltGroup.position.y = scrollYOffset;
        ring.spinGroup.rotation.y =
          (ring.angleAt(elapsedMs) + scrollSpinDeg + smoothedPointerRotation) * DEG;
        ring.update(
          elapsedMs,
          fluid.texture,
          RING.pointerRepulseStrength,
          eased,
          camera.position.z
        );

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
