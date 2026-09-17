"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createCardCloud } from "./agentic/cardCloud";
import { createComposite } from "./agentic/composite";
import { CAMERA, LIGHT_VOLUME, POINT_CLOUD, POST } from "./agentic/preset";
import { createPrismVolume } from "./agentic/prismVolume";
import { createFluid } from "./hero/fluid";

// The Agentic backdrop, built the way the original builds it: a raymarched
// volume of prism light, a point cloud sliding towards the camera, and a post
// pass with a long afterimage. It appears twice on the page — behind the
// chapter intro and pinned behind the chapter's content — so everything that
// moves is driven by the page clock and the page scroll, not by the instance,
// and the two meet without a seam.

const ANCHOR_ID = "agentic";

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

// the cubic-bezier easing Theatre uses between the two keyframes
function bezierEase(t: number, [x1, y1, x2, y2]: readonly number[]) {
  const sample = (a: number, b: number, s: number) =>
    3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (sample(x1, x2, mid) < t) lo = mid;
    else hi = mid;
  }
  return sample(y1, y2, (lo + hi) / 2);
}

// keeps the scroll drift inside a cone around the target, easing into the edge
function softLimit(value: number, limit: number) {
  const knee = limit * 0.8;
  const size = Math.abs(value);
  if (size <= knee) return value;
  const room = limit - knee;
  return Math.sign(value) * (knee + room * (1 - Math.exp(-(size - knee) / room)));
}

function damp(current: number, target: number, lambda: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

// screens scrolled since the intro finished arriving, shared by both instances
function screenOffset() {
  const anchor = document.getElementById(ANCHOR_ID);
  if (!anchor) return 0;
  const vh = window.innerHeight || 1;
  return (vh - anchor.getBoundingClientRect().top) / vh;
}

export default function AgenticScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const el = mount;

    // only hold a WebGL context while this copy is anywhere near the screen
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
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        powerPreference: coarse ? "default" : "high-performance",
      });
      // the main layer renders below full resolution, like the original's
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * POST.mainScale);
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      renderer.setClearColor(0x000000, 0);
      renderer.autoClear = false;
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      el.appendChild(renderer.domElement);

      const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.01, 100);
      const rig = new THREE.Group();
      rig.add(camera);

      const fluid = createFluid(renderer, 128);
      const prism = createPrismVolume(renderer, coarse ? 56 : LIGHT_VOLUME.raymarchSteps);
      const cloud = createCardCloud(coarse ? 40000 : POINT_CLOUD.count);
      const composite = createComposite(renderer);

      const volumeScene = new THREE.Scene();
      volumeScene.add(prism.group);
      const pointsScene = new THREE.Scene();
      pointsScene.add(cloud.points);

      const volumeResolution = new THREE.Vector2(1, 1);
      const bufferSize = new THREE.Vector2();
      const resize = () => {
        const w = Math.max(1, el.clientWidth);
        const h = Math.max(1, el.clientHeight);
        renderer.setSize(w, h, false);
        renderer.getDrawingBufferSize(bufferSize);
        composite.setSize(bufferSize.x, bufferSize.y);
        volumeResolution.set(composite.volumeTarget.width, composite.volumeTarget.height);
        fluid.setAspect(w / h);
      };
      resize();
      window.addEventListener("resize", resize);

      // pointer: feeds the fluid and orbits the camera round its target
      const pointer = new THREE.Vector2(-10, -10);
      const pointerVel = new THREE.Vector2();
      const pointerNdc = new THREE.Vector2();
      let pointerActive = false;
      const onPointerMove = (event: PointerEvent) => {
        const rect = el.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = 1 - (event.clientY - rect.top) / rect.height;
        if (pointerActive) {
          pointerVel.set((x - pointer.x) * 6.5, (y - pointer.y) * 6.5);
        }
        pointer.set(x, y);
        // the orbit follows the pointer across the viewport, so both copies agree
        pointerNdc.set(
          (event.clientX / window.innerWidth) * 2 - 1,
          1 - (event.clientY / window.innerHeight) * 2,
        );
        pointerActive = true;
      };
      const onPointerLeave = () => {
        pointerActive = false;
        pointerVel.set(0, 0);
      };
      window.addEventListener("pointermove", onPointerMove);
      document.documentElement.addEventListener("pointerleave", onPointerLeave);

      let visible = true;
      const onScreen = new IntersectionObserver(
        (entries) => {
          visible = entries[0]?.isIntersecting ?? true;
        },
        { threshold: 0 },
      );
      onScreen.observe(el);

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const orbit = { yaw: 0, pitch: 0 };
      const localPosition = new THREE.Vector3();
      const target = new THREE.Vector3();
      const up = new THREE.Vector3();
      const offset = new THREE.Vector3();
      const spherical = new THREE.Spherical();
      const lookMatrix = new THREE.Matrix4();
      const lookRotation = new THREE.Matrix4();

      const placeCamera = (dt: number) => {
        const n = reducedMotion ? 0 : screenOffset();

        // Theatre's keyframes lean the rig over the first screens
        const kf = CAMERA.keyframes;
        const k = bezierEase(clamp01((n - kf.from) / (kf.to - kf.from)), kf.ease);
        rig.position.set(
          CAMERA.positionOffset[0] + kf.positionOffsetX * k,
          CAMERA.positionOffset[1],
          CAMERA.positionOffset[2],
        );
        rig.rotation.set(kf.rotationOffsetX * k, kf.rotationOffsetY * k, 0);

        // scroll drift: slide along the camera's up axis, then dolly
        localPosition.set(...CAMERA.position);
        target.set(...CAMERA.target);
        lookMatrix.lookAt(localPosition, target, camera.up);
        up.set(0, 1, 0).applyMatrix4(lookRotation.extractRotation(lookMatrix));
        const reach = localPosition.distanceTo(target) * Math.tan(0.2) / CAMERA.scrollDrift.up;
        localPosition.addScaledVector(up, CAMERA.scrollDrift.up * softLimit(-n, reach));

        // the pointer orbits the camera round its target
        const activeLambda = pointerActive ? 6 : 14;
        const yawGoal = pointerActive && !reducedMotion
          ? THREE.MathUtils.mapLinear(pointerNdc.x, -1, 1, CAMERA.pointerYaw[0], CAMERA.pointerYaw[1]) * Math.PI / 2
          : 0;
        const pitchGoal = pointerActive && !reducedMotion
          ? THREE.MathUtils.mapLinear(-pointerNdc.y, -1, 1, CAMERA.pointerPitch[0], CAMERA.pointerPitch[1]) * Math.PI / 2
          : 0;
        orbit.yaw = damp(orbit.yaw, yawGoal, activeLambda, dt);
        orbit.pitch = damp(orbit.pitch, pitchGoal, activeLambda, dt);
        offset.subVectors(localPosition, target);
        spherical.setFromVector3(offset);
        spherical.theta += orbit.yaw;
        spherical.phi += orbit.pitch;
        spherical.makeSafe();
        offset.setFromSpherical(spherical);
        localPosition.addVectors(target, offset);

        camera.position.copy(localPosition);
        lookMatrix.lookAt(localPosition, target, camera.up);
        camera.quaternion.setFromRotationMatrix(lookMatrix);
        camera.translateZ(-n * CAMERA.scrollDrift.back);
        rig.updateMatrixWorld(true);
        return n;
      };

      // Each copy draws only the slice of one fixed, viewport-sized view that
      // it covers, so when both are on screen the picture runs straight across.
      const view = { top: Number.NaN, width: 0, height: 0, viewportHeight: 0 };
      let lastTop: number | null = null;
      const frameView = () => {
        const top = el.getBoundingClientRect().top;
        const width = el.clientWidth;
        const height = el.clientHeight;
        const viewportHeight = window.innerHeight || height;
        if (
          top !== view.top ||
          width !== view.width ||
          height !== view.height ||
          viewportHeight !== view.viewportHeight
        ) {
          Object.assign(view, { top, width, height, viewportHeight });
          camera.aspect = width / viewportHeight;
          camera.setViewOffset(width, viewportHeight, 0, top, width, height);
        }
        const shift = lastTop === null ? 0 : top - lastTop;
        lastTop = top;
        return { top, width, height, viewportHeight, shift };
      };

      const startedAt = performance.now();
      let last = startedAt;
      let raf = 0;
      const tick = () => {
        raf = requestAnimationFrame(tick);
        if (!visible) {
          last = performance.now();
          lastTop = null;
          return;
        }
        const now = performance.now();
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        // the page clock, so both copies show the same moment
        const time = now / 1000;
        const loadFade = clamp01((now - startedAt) / 1200);

        fluid.step(dt, pointer, pointerVel);
        pointerVel.multiplyScalar(0.86);
        const screen = frameView();
        const n = placeCamera(dt);

        prism.update({
          scrubOffset: reducedMotion ? 0 : (time / LIGHT_VOLUME.playbackSeconds) % 1,
          loadFade,
          fluid: fluid.texture,
          resolution: volumeResolution,
        });
        cloud.update({
          time: reducedMotion ? 0 : time,
          dpr: renderer.getPixelRatio(),
          loadFade,
          fluid: fluid.texture,
        });

        renderer.setRenderTarget(composite.volumeTarget);
        renderer.clear(true, false, false);
        renderer.render(volumeScene, camera);
        renderer.setRenderTarget(composite.pointsTarget);
        renderer.clear(true, false, false);
        renderer.render(pointsScene, camera);

        // once the chapter's content is over it, the scene steps back
        const behind = THREE.MathUtils.smoothstep(n, 0.1, 0.9);
        composite.render({
          camera,
          time,
          loadFade,
          behindDarken: POST.behindContent.darken * behind,
          behindSaturation: 1 - (1 - POST.behindContent.saturation) * behind,
          screen,
        });
      };
      tick();

      return () => {
        cancelAnimationFrame(raf);
        onScreen.disconnect();
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", onPointerMove);
        document.documentElement.removeEventListener("pointerleave", onPointerLeave);
        prism.dispose();
        cloud.dispose();
        composite.dispose();
        fluid.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
      };
    }
  }, []);

  return <div ref={mountRef} className="absolute inset-0 h-full w-full" />;
}
