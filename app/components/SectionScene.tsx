"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createComposite } from "./scene/composite";
import { createLightVolume } from "./scene/lightVolume";
import { createPointCloud } from "./scene/pointCloud";
import { PRESETS } from "./scene/presets";
import { createFluid } from "./hero/fluid";

// A chapter's backdrop, built the way the original builds every chapter: raymarched
// light volumes, a point cloud, and a post pass with an afterimage, all driven
// by the chapter's preset. Each chapter shows it twice — behind its intro and
// pinned behind its content — so whatever moves is driven by a clock shared
// per chapter and by the page scroll, and the two copies meet without a seam.

const clocks = new Map<string, { time: number; last: number }>();

// one clock per chapter, advanced once per animation frame whichever copy asks
function chapterTime(section: string, frameTime: number, rate: number) {
  let clock = clocks.get(section);
  if (!clock) {
    clock = { time: frameTime / 1000, last: frameTime };
    clocks.set(section, clock);
  }
  if (frameTime !== clock.last) {
    clock.time += (Math.min(100, Math.max(0, frameTime - clock.last)) / 1000) * rate;
    clock.last = frameTime;
  }
  return clock.time;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

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

// screens scrolled since the chapter's intro finished arriving
function screenOffset(section: string) {
  const anchor = document.getElementById(section);
  if (!anchor) return 0;
  const vh = window.innerHeight || 1;
  return (vh - anchor.getBoundingClientRect().top) / vh;
}

const MAIN_SCALE = 0.75;

export default function SectionScene({ section }: { section: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    const preset = PRESETS[section];
    if (!mount || !preset) return;
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
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        powerPreference: coarse ? "default" : "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * MAIN_SCALE);
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      renderer.setClearColor(0x000000, 0);
      renderer.autoClear = false;
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      el.appendChild(renderer.domElement);

      const { camera: cameraSettings, cloud: cloudSettings, post, behind } = preset;
      const camera = new THREE.PerspectiveCamera(cameraSettings.fov, 1, 0.01, 200);
      const rig = new THREE.Group();
      rig.add(camera);

      const fluid = createFluid(renderer, 128);
      const volumes = preset.volumes.map((settings) =>
        createLightVolume(renderer, settings, coarse ? 0.6 : 1),
      );
      const cloud = createPointCloud(
        cloudSettings,
        coarse ? Math.round(cloudSettings.count * 0.4) : cloudSettings.count,
      );

      const layerNormal = (layer: "background" | "foreground") =>
        preset.volumes.find((v) => v.layer === layer)?.blend === "normal";
      const composite = createComposite(renderer, {
        backdrop: preset.backdrop,
        post,
        mainScale: MAIN_SCALE,
        backgroundNormal: layerNormal("background"),
        pointsNormal: !cloudSettings.transparent || cloudSettings.blend === "normal",
        foregroundNormal: layerNormal("foreground"),
      });

      const backgroundScene = new THREE.Scene();
      const foregroundScene = new THREE.Scene();
      for (const volume of volumes) {
        (volume.settings.layer === "background" ? backgroundScene : foregroundScene).add(volume.group);
      }
      const pointsScene = new THREE.Scene();
      pointsScene.add(cloud.points);

      const backgroundResolution = new THREE.Vector2(1, 1);
      const foregroundResolution = new THREE.Vector2(1, 1);
      const bufferSize = new THREE.Vector2();
      const resize = () => {
        const w = Math.max(1, el.clientWidth);
        const h = Math.max(1, el.clientHeight);
        renderer.setSize(w, h, false);
        renderer.getDrawingBufferSize(bufferSize);
        composite.setSize(bufferSize.x, bufferSize.y);
        backgroundResolution.set(composite.backgroundTarget.width, composite.backgroundTarget.height);
        foregroundResolution.set(composite.foregroundTarget.width, composite.foregroundTarget.height);
        fluid.setAspect(w / h);
      };
      resize();
      window.addEventListener("resize", resize);

      const pointer = new THREE.Vector2(-10, -10);
      const pointerVel = new THREE.Vector2();
      const pointerNdc = new THREE.Vector2();
      let pointerActive = false;
      const onPointerMove = (event: PointerEvent) => {
        const rect = el.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = 1 - (event.clientY - rect.top) / rect.height;
        if (pointerActive) pointerVel.set((x - pointer.x) * 6.5, (y - pointer.y) * 6.5);
        pointer.set(x, y);
        // the orbit follows the pointer across the viewport, so both copies agree
        pointerNdc.set((event.clientX / window.innerWidth) * 2 - 1, 1 - (event.clientY / window.innerHeight) * 2);
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

      const orbit = { yaw: 0, pitch: 0 };
      const localPosition = new THREE.Vector3();
      const target = new THREE.Vector3();
      const up = new THREE.Vector3();
      const offset = new THREE.Vector3();
      const spherical = new THREE.Spherical();
      const lookMatrix = new THREE.Matrix4();
      const lookRotation = new THREE.Matrix4();

      const placeCamera = (n: number, dt: number) => {
        const kf = cameraSettings.keyframes;
        const k = kf ? bezierEase(clamp01((n - kf.from) / (kf.to - kf.from)), kf.ease) : 0;
        rig.position.set(
          cameraSettings.positionOffset[0] + (kf ? kf.positionOffsetX * k : 0),
          cameraSettings.positionOffset[1],
          cameraSettings.positionOffset[2],
        );
        rig.rotation.set(
          cameraSettings.rotationOffset[0] + (kf ? kf.rotationOffsetX * k : 0),
          cameraSettings.rotationOffset[1] + (kf ? kf.rotationOffsetY * k : 0),
          cameraSettings.rotationOffset[2],
        );

        // scroll drift: slide along the camera's up axis, then dolly
        localPosition.set(...cameraSettings.position);
        target.set(...cameraSettings.target);
        lookMatrix.lookAt(localPosition, target, camera.up);
        up.set(0, 1, 0).applyMatrix4(lookRotation.extractRotation(lookMatrix));
        const { up: driftUp, back: driftBack } = cameraSettings.scrollDrift;
        if (Math.abs(driftUp) > 0.0001) {
          const reach = (localPosition.distanceTo(target) * Math.tan(0.2)) / Math.abs(driftUp);
          localPosition.addScaledVector(up, driftUp * softLimit(-n, reach));
        }

        // the pointer orbits the camera round its target
        const influence = cameraSettings.pointer;
        const active = pointerActive && !reducedMotion && influence !== null;
        const yawGoal = active
          ? THREE.MathUtils.mapLinear(pointerNdc.x, -1, 1, influence.yaw[0], influence.yaw[1]) * (Math.PI / 2)
          : 0;
        const pitchGoal = active
          ? THREE.MathUtils.mapLinear(-pointerNdc.y, -1, 1, influence.pitch[0], influence.pitch[1]) * (Math.PI / 2)
          : 0;
        const lambda = active ? 6 : 14;
        orbit.yaw = damp(orbit.yaw, yawGoal, lambda, dt);
        orbit.pitch = damp(orbit.pitch, pitchGoal, lambda, dt);
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
        camera.translateZ(-n * driftBack);
        rig.updateMatrixWorld(true);
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
        if (top !== view.top || width !== view.width || height !== view.height || viewportHeight !== view.viewportHeight) {
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
      const tick = (frameTime: number) => {
        raf = requestAnimationFrame(tick);
        if (!visible) {
          last = frameTime;
          lastTop = null;
          return;
        }
        const dt = Math.min(0.1, Math.max(0, (frameTime - last) / 1000));
        last = frameTime;
        const loadFade = clamp01((performance.now() - startedAt) / 1200);

        const n = reducedMotion ? 0 : screenOffset(section);
        // with the chapter's content over it, the scene steps back and slows
        const behindness = THREE.MathUtils.smoothstep(n, 0.25, 0.75);
        const time = reducedMotion ? 0 : chapterTime(section, frameTime, 1 - behindness * (1 - behind.speed));

        fluid.step(dt, pointer, pointerVel);
        pointerVel.multiplyScalar(0.86);
        const screen = frameView();
        placeCamera(n, dt);

        for (const volume of volumes) {
          const s = volume.settings;
          const passes = (time * s.playbackSpeed) / (s.duration ?? 1) + n * s.scrollScrub;
          volume.update({
            scrubOffset: ((passes % 1) + 1) % 1,
            loadFade,
            fluid: fluid.texture,
            resolution: s.layer === "background" ? backgroundResolution : foregroundResolution,
          });
        }
        cloud.update({ time, dpr: renderer.getPixelRatio(), loadFade, fluid: fluid.texture });

        renderer.setRenderTarget(composite.backgroundTarget);
        renderer.clear(true, false, false);
        renderer.render(backgroundScene, camera);
        renderer.setRenderTarget(composite.pointsTarget);
        renderer.clear(true, true, false);
        renderer.render(pointsScene, camera);
        renderer.setRenderTarget(composite.foregroundTarget);
        renderer.clear(true, false, false);
        renderer.render(foregroundScene, camera);

        composite.render({
          camera,
          time,
          loadFade,
          behindDarken: behind.darken * behindness,
          behindSaturation: 1 - (1 - behind.saturation) * behindness,
          screen,
        });
      };
      raf = requestAnimationFrame(tick);

      return () => {
        cancelAnimationFrame(raf);
        onScreen.disconnect();
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", onPointerMove);
        document.documentElement.removeEventListener("pointerleave", onPointerLeave);
        for (const volume of volumes) volume.dispose();
        cloud.dispose();
        composite.dispose();
        fluid.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
      };
    }
  }, [section]);

  return <div ref={mountRef} className="absolute inset-0 h-full w-full" />;
}
