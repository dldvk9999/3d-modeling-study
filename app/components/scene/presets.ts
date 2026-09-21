// Every chapter's scene, lifted from the original's scene presets and the
// Theatre.js state layered on top of them (camera fov/offsets, scroll drift,
// volume scrub, layer resolutions). Units are the original's world units.
// Where the original loads footage or a captured point cloud, `painter` and
// `builder` name the stand-in we draw instead.

import type { CloudId } from "./clouds";
import type { PainterId } from "./painters";

export type Vec3 = [number, number, number];
export type Pair = [number, number];

export type VolumeSettings = {
  painter: PainterId;
  /** width / height of the original clip */
  aspect: number;
  layer: "background" | "foreground";
  blend: "additive" | "normal";
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  width: number;
  depth: number;
  opacity: number;
  brightness: number;
  threshold: number;
  softness: number;
  edgeFade: number;
  loopCount: number;
  nearFade: number;
  steps: number;
  /** clip passes per second (the original's KTX2 clips last one second) */
  playbackSpeed: number;
  /** extra clip passes per screen scrolled */
  scrollScrub: number;
  fluidStrength: Pair;
  fluidDepthStrength: Pair;
  /** hue turn, saturation and value multipliers, as the original applies them */
  hsl: Vec3;
  grid?: {
    columns: number;
    rows: number;
    spacing: Pair;
    randomTimeOffset: number;
    outerOpacity: number;
  };
  /** seconds for one pass through the clip; the original's clips are 1s */
  duration?: number;
  /** measure brightness on the stored (sRGB) values rather than linear ones */
};

export type CloudSettings = {
  builder: CloudId;
  count: number;
  position: Vec3;
  rotationDeg: Vec3;
  scale: number;
  pointSize: number;
  maxPointSize: number;
  /** the loader's point size multiplier for the resolution it picked; counts
   *  and multipliers follow the original's 256² captures */
  sizeScalar: number;
  opacity: number;
  transparent: boolean;
  blend: "additive" | "normal";
  randomize: Vec3;
  cameraFade: { enabled: boolean; near: number; far: number };
  distanceSize: { influence: number; near: number; far: number; max: number };
  flow: {
    enabled: boolean;
    type: "curl" | "rise";
    strength: number;
    speed: number;
    scale: number;
    distanceNear: number;
    distanceFar: number;
    randomnessExponent: number;
  };
  grid: { enabled: boolean; size: number; strength: number; mix: Vec3; rotation: Vec3 };
  conveyor: { enabled: boolean; speed: number; depth: number; rotation: Vec3; near: number; far: number };
  fluidInfluence: number;
  /** the original's selective colour grade: nine ranges (reds, yellows, greens,
   *  cyans, blues, magentas, whites, neutrals, blacks) of hue turn, saturation
   *  and lightness offsets */
  colorCorrection: { amount: number; ranges: Vec3[] } | null;
  caustics: {
    strength: number;
    scale: number;
    axisScale: Vec3;
    speed: Vec3;
    power: number;
    sparkle: number;
    color: Vec3;
  };
};

export type Backdrop =
  | {
      kind: "gradient";
      colors: [string, string, string];
      angle: number;
      smooth: number;
      points: 2 | 3;
      bias1: number;
      bias2: number;
      darken: number;
    }
  | { kind: "environment"; environment: "apartment" | "autumnField" | "shopappOffice"; intensity: number; rotation: Vec3 };

export type PostSettings = {
  volumeScale: { background: number; foreground: number };
  bloom: { intensity: number; opacity: number; threshold: number; radius: number };
  chromatic: { amount: number; angle: number } | null;
  vignette: { amount: number; radius: number; softness: number } | null;
  afterimage: { strength: number; damp: number; threshold: number } | null;
  noise: number;
};

export type CameraSettings = {
  position: Vec3;
  target: Vec3;
  fov: number;
  positionOffset: Vec3;
  rotationOffset: Vec3;
  pointer: { yaw: Pair; pitch: Pair } | null;
  scrollDrift: { up: number; back: number };
  keyframes?: {
    from: number;
    to: number;
    ease: [number, number, number, number];
    positionOffsetX: number;
    rotationOffsetX: number;
    rotationOffsetY: number;
  };
};

export type SectionPreset = {
  camera: CameraSettings;
  backdrop: Backdrop;
  cloud: CloudSettings;
  volumes: VolumeSettings[];
  post: PostSettings;
  behind: { darken: number; saturation: number; speed: number };
};

const noGrid = { enabled: false, size: 1, strength: 0, mix: [0, 0, 0] as Vec3, rotation: [0, 0, 0] as Vec3 };

export const PRESETS: Record<string, SectionPreset> = {
  agentic: {
    camera: {
      position: [-0.012337694942119056, 0.07944265448797339, -0.44905051315225064],
      target: [0.2057636663094521, -0.0705398556730998, 0.5073804838572582],
      fov: 40,
      positionOffset: [0, 0.05382072480346186, 0.24],
      rotationOffset: [0, 0, 0],
      pointer: { yaw: [0.15, -0.15], pitch: [0.05, -0.05] },
      scrollDrift: { up: 0.2, back: 0.2 },
      keyframes: {
        from: 0.967,
        to: 4.967,
        ease: [0.5, 0, 0.324, 0.969],
        positionOffsetX: -0.124,
        rotationOffsetX: -0.114,
        rotationOffsetY: 0.046,
      },
    },
    backdrop: { kind: "environment", environment: "apartment", intensity: 1 - 0.9240506329113923, rotation: [0, 0, 0] },
    cloud: {
      builder: "cards",
      count: 65515,
      position: [-0.51, 0.13, 0.67],
      rotationDeg: [0, 0, 0],
      scale: 0.5,
      pointSize: 0.005,
      maxPointSize: 2,
      sizeScalar: 1.25,
      opacity: 0.53,
      transparent: true,
      blend: "additive",
      randomize: [0.198, 0.002, 0.004],
      cameraFade: { enabled: true, near: 0, far: 1.95 },
      distanceSize: { influence: 0.25, near: 4, far: 18, max: 1.55 },
      flow: { enabled: false, type: "rise", strength: 0.028, speed: 0.46, scale: 2, distanceNear: 0, distanceFar: 2.475, randomnessExponent: 300 },
      grid: noGrid,
      conveyor: { enabled: true, speed: -0.2, depth: 4.544303797468353, rotation: [0, 0, 0], near: 0, far: 7.974683544303791 },
      fluidInfluence: 0.6,
      colorCorrection: null,
      caustics: { strength: 0.41139240506329117, scale: 1, axisScale: [2, 1, 1], speed: [0, 0, 0.5], power: 8, sparkle: 0, color: [1, 0.9725490196078431, 0.9333333333333333] },
    },
    volumes: [
      {
        painter: "prism",
        aspect: 640 / 360,
        layer: "background",
        blend: "additive",
        position: [0, -0.093, 1.3],
        rotation: [0, 0.017453292519943295, 0],
        scale: [1.6, 1.6, 1],
        width: 1,
        depth: 3.5,
        opacity: 2,
        brightness: 2.1,
        threshold: 0.025,
        softness: 0.441,
        edgeFade: 0,
        loopCount: 2.5,
        nearFade: 0,
        steps: 100,
        playbackSpeed: 1,
        scrollScrub: 0,
        fluidStrength: [-0.25, 0.25],
        fluidDepthStrength: [3, -2],
        hsl: [0, 0, 0],
        grid: { columns: 3, rows: 3, spacing: [0.815, 0.9], randomTimeOffset: 0.87, outerOpacity: 0.24 },
        duration: 5.94,
      },
    ],
    post: {
      volumeScale: { background: 0.45, foreground: 0.1 },
      bloom: { intensity: 0.22151898734177217, opacity: 0.15189873417721517, threshold: 0, radius: 0.46835443037974667 },
      chromatic: { amount: 0.0015822784810126582, angle: 1.5509128289873633 },
      vignette: { amount: 0.23417721518987358, radius: 0.895, softness: 0.441 },
      afterimage: { strength: 0.99, damp: 0.99, threshold: 0 },
      noise: 0.010443037974683544,
    },
    behind: { darken: 0.35, saturation: 0.8, speed: 0.02 },
  },

  sidekick: {
    camera: {
      position: [-0.065, -0.838, 1.385],
      target: [-0.763, -0.698, 0.086],
      fov: 50,
      positionOffset: [0, 0, 0],
      rotationOffset: [0, 0, -0.04],
      pointer: { yaw: [0.15, -0.15], pitch: [0.1, -0.1] },
      scrollDrift: { up: 0.4, back: 0.2 },
    },
    backdrop: { kind: "environment", environment: "autumnField", intensity: 1 - 0.6075949367088608, rotation: [0, 0, Math.PI] },
    cloud: {
      builder: "arches",
      count: 65536,
      position: [-2.7, 1.96, -2.44],
      rotationDeg: [0, -21.9, -2.9],
      scale: 5.19,
      pointSize: 0.015,
      maxPointSize: 1.804,
      sizeScalar: 1,
      opacity: 0.89,
      transparent: true,
      blend: "additive",
      randomize: [0.05, 0, 0],
      cameraFade: { enabled: true, near: 0, far: 4.5 },
      distanceSize: { influence: 0.19, near: 4, far: 18, max: 1.5 },
      flow: { enabled: true, type: "curl", strength: 0.177, speed: 1, scale: 3.861, distanceNear: 0.253, distanceFar: 1.266, randomnessExponent: 142 },
      grid: noGrid,
      conveyor: { enabled: true, speed: 0.3, depth: 6, rotation: [0, 0.746, 0], near: 0.063, far: 3 },
      fluidInfluence: 0.6,
      colorCorrection: {
        amount: 1,
        ranges: [[0.5, -1, 0.18], [0, 0, 0], [0.0111, 0.15, 0], [0, 0, 0], [0, 0, 0], [0, -1, 0.07], [0, -0.41, -0.51], [0.5, 0, -0.32], [0.225, -0.05, 0.22]],
      },
      caustics: { strength: 5, scale: 2, axisScale: [1, 1, 10], speed: [-0.15, -0.1, -0.2], power: 10, sparkle: 0, color: [0.502, 0.306, 0.871] },
    },
    volumes: [
      {
        painter: "stripes",
        aspect: 429 / 239,
        layer: "background",
        blend: "additive",
        position: [-0.239, -0.685, 0.97],
        rotation: [0.06, 0.476, 3.077],
        scale: [2, 3, 2.01],
        width: 1,
        depth: 1.21,
        opacity: 1.58,
        brightness: 1.6,
        threshold: 0.055,
        softness: 0.96,
        edgeFade: 0.28,
        loopCount: 2,
        nearFade: 1.5,
        steps: 50,
        playbackSpeed: -0.6,
        scrollScrub: -0.4,
        fluidStrength: [0.1, 0.1],
        fluidDepthStrength: [3, 0],
        hsl: [0.025, -0.18, 0],
      },
      {
        painter: "pills",
        aspect: 427 / 539,
        layer: "background",
        blend: "normal",
        position: [1.997, -0.584, 4],
        rotation: [-0.052, 0.602, 0],
        scale: [5.88, 6, 4],
        width: 1,
        depth: 3.8,
        opacity: 1.13,
        brightness: 4,
        threshold: 0.025,
        softness: 0.001,
        edgeFade: 0,
        loopCount: 2,
        nearFade: 5.5,
        steps: 30,
        playbackSpeed: -0.5,
        scrollScrub: -0.2,
        fluidStrength: [-0.2, 0.2],
        fluidDepthStrength: [2, 0],
        hsl: [-0.015, 0.25, 0],
      },
    ],
    post: {
      volumeScale: { background: 0.5, foreground: 0.25 },
      bloom: { intensity: 0.886, opacity: 0.051, threshold: 0.358, radius: 0.235 },
      chromatic: { amount: 0.005, angle: 0.358 },
      vignette: { amount: 0.627, radius: 1.009, softness: 0.713 },
      afterimage: { strength: 0.835, damp: 0.329, threshold: 0.2 },
      noise: 0,
    },
    behind: { darken: 0, saturation: 1, speed: 0.2 },
  },

  online: {
    camera: {
      position: [-0.043, -0.246, 0.52],
      target: [-0.085, -0.161, 0.015],
      fov: 60,
      positionOffset: [0, 0.008, 0.041],
      rotationOffset: [0, 0, 0],
      pointer: { yaw: [0.1, -0.1], pitch: [0.1, -0.1] },
      scrollDrift: { up: 0.15, back: 0.05 },
    },
    backdrop: {
      kind: "gradient",
      colors: ["#203d27", "#496f85", "#3d7fd6"],
      angle: 11,
      smooth: 100,
      points: 3,
      bias1: 0.092,
      bias2: -0.05,
      darken: 0.392,
    },
    cloud: {
      builder: "forest",
      count: 180000,
      position: [-0.075, 0.326, -0.712],
      rotationDeg: [370.4, 7.4, 0],
      scale: 1,
      pointSize: 0.011,
      maxPointSize: 3,
      sizeScalar: 1.1,
      opacity: 1,
      transparent: false,
      blend: "normal",
      randomize: [0.001, 0.001, 0.001],
      cameraFade: { enabled: false, near: 1.9, far: 8.25 },
      distanceSize: { influence: 0.25, near: 4, far: 18, max: 1.5 },
      flow: { enabled: true, type: "curl", strength: 0.5, speed: 0.5, scale: 2, distanceNear: 0, distanceFar: 5, randomnessExponent: 300 },
      grid: noGrid,
      conveyor: { enabled: true, speed: 0.06, depth: 0.051, rotation: [0, 0, 0], near: 0, far: 2.532 },
      fluidInfluence: 0.5,
      colorCorrection: {
        amount: 0.5316,
        ranges: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0.15]],
      },
      caustics: { strength: 0.6, scale: 3, axisScale: [1, 1, 1], speed: [0.1, -0.1, -0.05], power: 10, sparkle: 0, color: [0.776, 0.722, 0.639] },
    },
    volumes: [
      {
        painter: "coins",
        aspect: 640 / 360,
        layer: "background",
        blend: "normal",
        position: [-0.011, -0.15, -0.069],
        rotation: [-0.108, 0.101, 2.854],
        scale: [1.49, 1.177, 1],
        width: 1,
        depth: 4.3,
        opacity: 1.37,
        brightness: 3.95,
        threshold: 0.235,
        softness: 0.161,
        edgeFade: 0,
        loopCount: 3,
        nearFade: 0.41,
        steps: 45,
        playbackSpeed: -0.5,
        scrollScrub: -0.5,
        fluidStrength: [0.2, 0.2],
        fluidDepthStrength: [4, 0],
        hsl: [0.25, -0.6, -0.338],
      },
      {
        painter: "phone",
        aspect: 640 / 360,
        layer: "foreground",
        blend: "normal",
        position: [-0.128, -0.195, -0.225],
        rotation: [0.012, 0.126, 0.007],
        scale: [0.2, 0.2, 0.283],
        width: 1,
        depth: 4.5,
        opacity: 2 * 0.7699999999999997,
        brightness: 1.6,
        threshold: 0.025,
        softness: 0.001,
        edgeFade: 0,
        loopCount: 2.5,
        nearFade: 0.7,
        steps: 60,
        playbackSpeed: -0.7,
        scrollScrub: -1,
        fluidStrength: [-0.8, 0.8],
        fluidDepthStrength: [4, 0],
        hsl: [-0.008, 2, 1],
        grid: { columns: 3, rows: 3, spacing: [0.29, 0.645], randomTimeOffset: 0.64, outerOpacity: 0.2 },
      },
    ],
    post: {
      volumeScale: { background: 0.2, foreground: 0.4 },
      bloom: { intensity: 0.342, opacity: 0.089, threshold: 0.171, radius: 1 },
      chromatic: null,
      vignette: null,
      afterimage: { strength: 0.99, damp: 0.99, threshold: 0 },
      noise: 0,
    },
    behind: { darken: 0.4, saturation: 0.87, speed: 0.1 },
  },

  retail: {
    camera: {
      position: [-0.484, -0.689, 0.884],
      target: [-0.281, -0.672, 0.421],
      fov: 50,
      positionOffset: [0, 0, 0],
      rotationOffset: [0, 0, 0],
      pointer: { yaw: [0.1, -0.1], pitch: [0.05, -0.05] },
      scrollDrift: { up: 0.2, back: 0.2 },
    },
    backdrop: {
      kind: "gradient",
      colors: ["#ffffff", "#bababa", "#afeeff"],
      angle: 0,
      smooth: 30,
      points: 2,
      bias1: -0.03,
      bias2: 0,
      darken: 0.9430379746835437,
    },
    cloud: {
      builder: "storefront",
      count: 65536,
      position: [0, -0.593, 0.1],
      rotationDeg: [0, -9.9, 0],
      scale: 0.44,
      pointSize: 0.2,
      maxPointSize: 2.688,
      sizeScalar: 1.1,
      opacity: 0.83,
      transparent: true,
      blend: "normal",
      randomize: [0.014, 0.009, 0.056],
      cameraFade: { enabled: true, near: 0.2, far: 2.5 },
      distanceSize: { influence: 0.25, near: 4, far: 18, max: 1.5 },
      flow: { enabled: true, type: "curl", strength: 0.068, speed: 0.719, scale: 1.21, distanceNear: 0.525, distanceFar: 0.823, randomnessExponent: 0 },
      grid: noGrid,
      conveyor: { enabled: true, speed: 0.087, depth: 0.076, rotation: [0, 0, 0], near: 0.525, far: 0.823 },
      fluidInfluence: 0.5,
      colorCorrection: {
        amount: 1,
        ranges: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0.02]],
      },
      caustics: { strength: 0.4, scale: 1.519, axisScale: [0.5, 1, 0.5], speed: [0.1, -0.1, -0.1], power: 2.5, sparkle: 0, color: [0.89, 0.847, 0.737] },
    },
    volumes: [
      {
        painter: "storefront",
        aspect: 643 / 358,
        layer: "background",
        blend: "additive",
        position: [-0.655, -0.695, 0.24],
        rotation: [-0.027, 0.469, -3.142],
        scale: [1.144, 1.116, 1],
        width: 1,
        depth: 3.2,
        opacity: 2,
        brightness: 2.7,
        threshold: 0.075,
        softness: 0.3,
        edgeFade: 0,
        loopCount: 2.5,
        nearFade: 0,
        steps: 50,
        playbackSpeed: -0.1,
        scrollScrub: 0.1,
        fluidStrength: [0.2, 0.2],
        fluidDepthStrength: [1, 0],
        hsl: [0.01, -0.26, 0],
      },
      {
        painter: "rays",
        aspect: 427 / 240,
        layer: "foreground",
        blend: "additive",
        position: [0.37, 0.29, -2.1],
        rotation: [-0.052, 0.314, 0.541],
        scale: [3.15, 3.15, 0.721],
        width: 1,
        depth: 8.31,
        opacity: 1.71,
        brightness: 1,
        threshold: 0.025,
        softness: 0.591,
        edgeFade: 0.06,
        loopCount: 1,
        nearFade: 0,
        steps: 30,
        playbackSpeed: -0.1,
        scrollScrub: -0.5,
        fluidStrength: [0.5, 0.5],
        fluidDepthStrength: [1, 0],
        hsl: [0, 0, 0],
      },
    ],
    post: {
      volumeScale: { background: 0.15, foreground: 0.15 },
      bloom: { intensity: 0.424, opacity: 0.051, threshold: 0.08, radius: 0.235 },
      chromatic: { amount: 0.004, angle: 1 },
      vignette: null,
      afterimage: { strength: 0.835, damp: 0.329, threshold: 0.2 },
      noise: 0,
    },
    behind: { darken: 0.25, saturation: 0.91, speed: 0.15 },
  },

  marketing: {
    camera: {
      position: [0.534, 0.23, -0.653],
      target: [0.052, 0.307, 1.482],
      fov: 50,
      positionOffset: [0, 0.07, 0.24],
      rotationOffset: [0, 0, 0],
      pointer: { yaw: [0.1, -0.1], pitch: [0.1, -0.1] },
      scrollDrift: { up: 1, back: 0.2 },
    },
    backdrop: { kind: "environment", environment: "autumnField", intensity: 1 - 0.867, rotation: [0, 0, 0] },
    cloud: {
      builder: "nebula",
      count: 65536,
      position: [-0.22, -0.32, 1.37],
      rotationDeg: [0, 0, 0],
      scale: 1,
      pointSize: 0.035,
      maxPointSize: 2,
      sizeScalar: 1,
      opacity: 0.5,
      transparent: true,
      blend: "additive",
      randomize: [0, 0, 0],
      cameraFade: { enabled: true, near: 0, far: 4.2 },
      distanceSize: { influence: 0.25, near: 4, far: 18, max: 1.55 },
      flow: { enabled: true, type: "rise", strength: 0.373, speed: 0, scale: 2, distanceNear: 0, distanceFar: 2.475, randomnessExponent: 300 },
      grid: { enabled: true, size: 0.399, strength: 0.54, mix: [0.54, 0.19, 0.39], rotation: [0, 3.47, 0] },
      conveyor: { enabled: true, speed: -0.4, depth: 4.544, rotation: [0, 0, 0], near: 0, far: 7.975 },
      fluidInfluence: 0.6,
      colorCorrection: {
        amount: 1,
        ranges: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, -0.58, 0], [0, 0, 0]],
      },
      caustics: { strength: 0.411, scale: 1, axisScale: [2, 1, 1], speed: [0, 0, 0.5], power: 8, sparkle: 0, color: [1, 0.973, 0.933] },
    },
    volumes: [
      {
        painter: "collage",
        aspect: 1,
        layer: "background",
        blend: "additive",
        position: [-0.33, 0.263, 2.194],
        rotation: [0, 0, 0],
        scale: [1.71, 1.6, 1],
        width: 1,
        depth: 4,
        opacity: 2,
        brightness: 1.6,
        threshold: 0.025,
        softness: 0.001,
        edgeFade: 0,
        loopCount: 1.5,
        nearFade: 0,
        steps: 80,
        playbackSpeed: 0.5,
        scrollScrub: 0.5,
        fluidStrength: [0.5, 0.5],
        fluidDepthStrength: [3, 0],
        hsl: [-0.02, 0.05, 0],
        grid: { columns: 3, rows: 3, spacing: [0.735, 0.815], randomTimeOffset: 0.39, outerOpacity: 0.61 },
      },
    ],
    post: {
      volumeScale: { background: 0.25, foreground: 0.25 },
      bloom: { intensity: 0.158, opacity: 0.139, threshold: 0, radius: 0.468 },
      chromatic: { amount: 0.004, angle: 1.511 },
      vignette: { amount: 0.532, radius: 0.829, softness: 0.441 },
      afterimage: { strength: 0.99, damp: 0.999, threshold: 0 },
      noise: 0,
    },
    behind: { darken: 0.5, saturation: 0.6, speed: 0.06 },
  },

  operations: {
    camera: {
      position: [-1.721, -0.03, -0.369],
      target: [-0.335, -0.008, -0.396],
      fov: 50,
      positionOffset: [0.1, 0, 0],
      rotationOffset: [0, 0, 0],
      pointer: { yaw: [0.1, -0.1], pitch: [0.1, -0.1] },
      scrollDrift: { up: 0.25, back: 0.3 },
    },
    backdrop: {
      kind: "gradient",
      colors: ["#19182d", "#000000", "#998ad7"],
      angle: 86,
      smooth: 100,
      points: 2,
      bias1: 0.08,
      bias2: 0,
      darken: 0,
    },
    cloud: {
      builder: "globe",
      count: 130000,
      position: [-0.001, -0.096, -0.375],
      rotationDeg: [183, -11.7, 38],
      scale: 0.26,
      pointSize: 0.01,
      maxPointSize: 2.286,
      sizeScalar: 1.5,
      opacity: 0.65,
      transparent: true,
      blend: "normal",
      randomize: [0.2, 0.2, 0.2],
      cameraFade: { enabled: false, near: 0, far: 5.8 },
      distanceSize: { influence: 0.25, near: 4, far: 18, max: 1.5 },
      flow: { enabled: true, type: "curl", strength: 1, speed: 2, scale: 2, distanceNear: 0, distanceFar: 6.076, randomnessExponent: 99 },
      grid: noGrid,
      conveyor: { enabled: true, speed: 0.443, depth: 1.203, rotation: [0, 0, 0], near: 0, far: 1.177 },
      fluidInfluence: 0.4,
      colorCorrection: {
        amount: 0.8481,
        ranges: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [-0.35, 1, 0], [0.0667, -1, 0], [0.5, -1, -0.3], [0, -1, 0]],
      },
      caustics: { strength: 2, scale: 3, axisScale: [2, 2.2, 2], speed: [0.1, -0.1, -0.05], power: 10, sparkle: 0, color: [0.525, 0.745, 0.678] },
    },
    volumes: [
      {
        painter: "globe",
        aspect: 427 / 240,
        layer: "background",
        blend: "additive",
        position: [-1.83, -0.11, -0.243],
        rotation: [0, -1.571, 0],
        scale: [2.18, 1.99, 1.5],
        width: 1,
        depth: 4.9,
        opacity: 2,
        brightness: 2,
        threshold: 0.025,
        softness: 0.001,
        edgeFade: 0,
        loopCount: 1,
        nearFade: 0,
        steps: 100,
        playbackSpeed: -0.2,
        scrollScrub: -0.1,
        fluidStrength: [0.25, 0.25],
        fluidDepthStrength: [2, 0],
        hsl: [0, -0.12, 0.86],
      },
    ],
    post: {
      volumeScale: { background: 0.25, foreground: 0.25 },
      bloom: { intensity: 0.57, opacity: 0.227, threshold: 0, radius: 0.437 },
      chromatic: null,
      vignette: { amount: 0.5, radius: 0.895, softness: 0.441 },
      afterimage: { strength: 0.99, damp: 0.99, threshold: 0 },
      noise: 0,
    },
    behind: { darken: 0.3, saturation: 0.88, speed: 0.15 },
  },

  "shop-app": {
    camera: {
      position: [-0.126, 0.384, 1.864],
      target: [-0.126, 0.369, -0.056],
      fov: 50,
      positionOffset: [0, 0, 0],
      rotationOffset: [0, 0, 0],
      pointer: { yaw: [0.1, -0.1], pitch: [0.05, -0.05] },
      scrollDrift: { up: 0.6, back: 0.4 },
    },
    backdrop: { kind: "environment", environment: "shopappOffice", intensity: 1 - 0.8354430379746833, rotation: [0, 0, 0] },
    cloud: {
      builder: "galaxy",
      count: 65536,
      position: [-1.37, 2.41, -12.69],
      rotationDeg: [0, 200, 178],
      scale: 4,
      pointSize: 0.118,
      maxPointSize: 2.125,
      sizeScalar: 1,
      opacity: 0.45,
      transparent: true,
      blend: "additive",
      randomize: [1.26, 1.69, 2],
      cameraFade: { enabled: true, near: 0, far: 14.05 },
      distanceSize: { influence: 1, near: 4, far: 18, max: 1.5 },
      flow: { enabled: true, type: "curl", strength: 0.051, speed: 1.51, scale: 3.488, distanceNear: 1.203, distanceFar: 3, randomnessExponent: 205 },
      grid: noGrid,
      conveyor: { enabled: true, speed: -2, depth: 4.494, rotation: [0, 0.44, 0], near: 1.203, far: 20 },
      fluidInfluence: 0.4,
      colorCorrection: null,
      caustics: { strength: 5, scale: 0.158, axisScale: [1.25, 1.09, 2.4], speed: [-0.11, -0.04, -0.04], power: 5.443, sparkle: 0, color: [0.373, 0.294, 1] },
    },
    volumes: [
      {
        painter: "swirl",
        aspect: 427 / 240,
        layer: "background",
        blend: "additive",
        position: [-0.09, 0.34, 0],
        rotation: [0, 0, 0],
        scale: [3, 3, 1],
        width: 1,
        depth: 2.61,
        opacity: 2,
        brightness: 2.3,
        threshold: 0.025,
        softness: 0.061,
        edgeFade: 0,
        loopCount: 1.2,
        nearFade: 0,
        steps: 100,
        playbackSpeed: -1,
        scrollScrub: -0.5,
        fluidStrength: [-0.05, 0.05],
        fluidDepthStrength: [4, -4],
        hsl: [0.03, 2, -0.17],
      },
    ],
    post: {
      volumeScale: { background: 0.5, foreground: 0.25 },
      bloom: { intensity: 0.4, opacity: 0.139, threshold: 0, radius: 0.481 },
      chromatic: { amount: 0.008, angle: 0.636 },
      vignette: { amount: 0.329, radius: 1.189, softness: 0.713 },
      afterimage: { strength: 0.99, damp: 0.99, threshold: 0 },
      noise: 0,
    },
    behind: { darken: 0.3, saturation: 0.8, speed: 0.1 },
  },

  payments: {
    camera: {
      position: [-0.597, -0.443, 0.532],
      target: [-0.685, -0.397, -0.35],
      fov: 115,
      positionOffset: [0, 0, 0],
      rotationOffset: [0, 0, 0],
      pointer: null,
      scrollDrift: { up: 0.3, back: 0.1 },
    },
    backdrop: { kind: "environment", environment: "shopappOffice", intensity: 1 - 0.7848101265822782, rotation: [0, 0, 0] },
    cloud: {
      builder: "nebula",
      count: 65536,
      position: [-0.59, -0.463, 0.37],
      rotationDeg: [-190, 134.1, 6],
      scale: 0.31,
      pointSize: 0.006,
      maxPointSize: 2,
      sizeScalar: 1.2,
      opacity: 0.45,
      transparent: true,
      blend: "normal",
      randomize: [0.19, 2, 2],
      cameraFade: { enabled: false, near: 0, far: 1.05 },
      distanceSize: { influence: 0.25, near: 4, far: 18, max: 1.5 },
      flow: { enabled: false, type: "rise", strength: 0, speed: 0, scale: 0, distanceNear: 1.772, distanceFar: 7.089, randomnessExponent: 0 },
      grid: { enabled: true, size: 0.496, strength: 0.94, mix: [0.58, 0.16, 0.94], rotation: [0, 0.94, 1.76] },
      conveyor: { enabled: false, speed: 0.08, depth: 1, rotation: [0, 0.37, 0], near: 0, far: 0 },
      fluidInfluence: 0.5,
      colorCorrection: null,
      caustics: { strength: 1.2, scale: 3, axisScale: [2, 3.14, 2.4], speed: [-0.1, -0.1, -0.2], power: 5, sparkle: 0.316, color: [0.388, 0.635, 1] },
    },
    volumes: [
      {
        painter: "cards",
        aspect: 853 / 480,
        layer: "foreground",
        blend: "additive",
        position: [-0.71, -0.48, -0.32],
        rotation: [-0.401, 0.436, 0],
        scale: [3, 3, 1.4],
        width: 1,
        depth: 1.34,
        opacity: 2,
        brightness: 2,
        threshold: 0.035,
        softness: 0.161,
        edgeFade: 0,
        loopCount: 2,
        nearFade: 0.8,
        steps: 128,
        playbackSpeed: -1,
        scrollScrub: 0,
        fluidStrength: [-0.4, 0.4],
        fluidDepthStrength: [1, 0],
        hsl: [0.5, -0.3, 1],
      },
      {
        painter: "vortex",
        aspect: 368 / 278,
        layer: "foreground",
        blend: "additive",
        position: [-0.92, -0.31, 0.27],
        rotation: [0, 0.332, 1.152],
        scale: [1, 4.03, 1],
        width: 1,
        depth: 5.86,
        opacity: 2,
        brightness: 2.65,
        threshold: 0.025,
        softness: 0.101,
        edgeFade: 0.4,
        loopCount: 1,
        nearFade: 1,
        steps: 100,
        playbackSpeed: -0.5,
        scrollScrub: 0,
        fluidStrength: [-0.4, 0.4],
        fluidDepthStrength: [1, 0],
        hsl: [-0.015, 0.6, -0.1],
      },
    ],
    post: {
      volumeScale: { background: 0.5, foreground: 0.25 },
      bloom: { intensity: 1.487, opacity: 0.051, threshold: 0.557, radius: 0 },
      chromatic: null,
      vignette: { amount: 0.241, radius: 1.009, softness: 0.713 },
      afterimage: { strength: 0.98, damp: 0.95, threshold: 0.2 },
      noise: 0,
    },
    behind: { darken: 0.35, saturation: 0.8, speed: 0.1 },
  },

  finance: {
    camera: {
      position: [-0.305, 0.025, 0.909],
      target: [-0.349, 0.029, -0.543],
      fov: 50,
      positionOffset: [-0.087, 0.019, 0.019],
      rotationOffset: [0, 0.183, 0],
      pointer: { yaw: [0.1, -0.1], pitch: [0.05, -0.05] },
      scrollDrift: { up: 0.5, back: 0.25 },
    },
    backdrop: {
      kind: "gradient",
      colors: ["#000000", "#000000", "#002435"],
      angle: 126,
      smooth: 100,
      points: 2,
      bias1: 0.38,
      bias2: 0,
      darken: 0,
    },
    cloud: {
      builder: "nebula",
      count: 65536,
      position: [0.64, -0.24, -0.09],
      rotationDeg: [183, 226, 0],
      scale: 1.5,
      pointSize: 0.068,
      maxPointSize: 1.804,
      sizeScalar: 1,
      opacity: 0.56,
      transparent: true,
      blend: "normal",
      randomize: [0, 0, 0],
      cameraFade: { enabled: true, near: 0, far: 5.8 },
      distanceSize: { influence: 0.25, near: 4, far: 18, max: 1.5 },
      flow: { enabled: true, type: "curl", strength: 1, speed: 1.861, scale: 10, distanceNear: 3.608, distanceFar: 0.759, randomnessExponent: 99 },
      grid: { enabled: true, size: 0.037, strength: 0.1, mix: [0.1, 0.1, 0.1], rotation: [0, 0, 0] },
      conveyor: { enabled: true, speed: 0.443, depth: 1.203, rotation: [0, 0, 0], near: 3.608, far: 0.759 },
      fluidInfluence: 0.8,
      colorCorrection: {
        amount: 1,
        ranges: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [-0.35, 1, 0], [0.0667, -1, 0], [0.5, -1, -0.3], [0, -1, 0]],
      },
      caustics: { strength: 5, scale: 2, axisScale: [1, 2, 2.4], speed: [0.1, -0.5, -0.05], power: 8, sparkle: 0, color: [0.114, 0.627, 1] },
    },
    volumes: [
      {
        painter: "bars",
        aspect: 429 / 239,
        layer: "foreground",
        blend: "additive",
        position: [-0.31, 0, 0],
        rotation: [0, 0.401, 0],
        scale: [2.3, 2.3, 0.48],
        width: 1,
        depth: 0.26,
        opacity: 2,
        brightness: 1.65,
        threshold: 0.025,
        softness: 1,
        edgeFade: 0,
        loopCount: 1,
        nearFade: 0,
        steps: 100,
        playbackSpeed: 4,
        scrollScrub: 3,
        fluidStrength: [-0.25, 0.25],
        fluidDepthStrength: [1, 0],
        hsl: [0.33, 0.92, 0],
      },
    ],
    post: {
      volumeScale: { background: 0.25, foreground: 0.25 },
      bloom: { intensity: 0.095, opacity: 0.177, threshold: 0, radius: 0.43 },
      chromatic: null,
      vignette: { amount: 0.5, radius: 0.895, softness: 0.441 },
      afterimage: { strength: 0.99, damp: 0.95, threshold: 0.2 },
      noise: 0,
    },
    behind: { darken: 0.5, saturation: 0.7, speed: 0.2 },
  },

  developer: {
    camera: {
      position: [0.376, -0.053, 0.809],
      target: [0.11, -0.019, -0.168],
      fov: 75.443,
      positionOffset: [0, 0, 0],
      rotationOffset: [0, 0, 0],
      pointer: { yaw: [0.15, -0.15], pitch: [0.1, -0.1] },
      scrollDrift: { up: 0.2, back: 0.2 },
    },
    backdrop: {
      kind: "gradient",
      colors: ["#2b2b2b", "#000000", "#323131"],
      angle: 0,
      smooth: 0,
      points: 2,
      bias1: 0,
      bias2: 0,
      darken: 0.5632911392405063,
    },
    cloud: {
      builder: "nebula",
      count: 45000,
      position: [0, -0.07, 0.1],
      rotationDeg: [-33, 13, 91],
      scale: 1,
      pointSize: 0.02,
      maxPointSize: 1.5,
      sizeScalar: 1.2,
      opacity: 0.63,
      transparent: true,
      blend: "normal",
      randomize: [0.008, 0.002, 0],
      cameraFade: { enabled: true, near: 1, far: 5 },
      distanceSize: { influence: 0.25, near: 4.4, far: 18, max: 1.5 },
      flow: { enabled: true, type: "rise", strength: 0.943, speed: 0.222, scale: 5.443, distanceNear: 0.127, distanceFar: 4.127, randomnessExponent: 310 },
      grid: { enabled: true, size: 0.041, strength: 1, mix: [1, 1, 1], rotation: [0, 0, 0] },
      conveyor: { enabled: true, speed: 0.5, depth: 10, rotation: [-0.06, -0.62, 0], near: 0.127, far: 4.127 },
      fluidInfluence: 0.6,
      colorCorrection: null,
      caustics: { strength: 2, scale: 0.981, axisScale: [1, 1, 1], speed: [0.1, -0.05, -0.05], power: 10, sparkle: 0, color: [1, 1, 1] },
    },
    volumes: [
      {
        painter: "screens",
        aspect: 427 / 240,
        layer: "foreground",
        blend: "normal",
        position: [0.17, 0, -0.15],
        rotation: [0, 0.227, 0],
        scale: [3, 3, 1],
        width: 1,
        depth: 1.26,
        opacity: 2,
        brightness: 4,
        threshold: 0.025,
        softness: 0.23,
        edgeFade: 0,
        loopCount: 1,
        nearFade: 3.3,
        steps: 128,
        playbackSpeed: -1.5,
        scrollScrub: 0,
        fluidStrength: [-0.2, 0.2],
        fluidDepthStrength: [4, 0],
        hsl: [0, -1, 1],
      },
      {
        painter: "tiles",
        aspect: 640 / 360,
        layer: "foreground",
        blend: "additive",
        position: [1.03, -0.01, -0.79],
        rotation: [0.052, -2.862, 3.142],
        scale: [2.65, 2, 1],
        width: 1,
        depth: 3.5,
        opacity: 2,
        brightness: 1.3,
        threshold: 0.36,
        softness: 0.451,
        edgeFade: 0.06,
        loopCount: 5,
        nearFade: 0,
        steps: 100,
        playbackSpeed: 0.85,
        scrollScrub: 0,
        fluidStrength: [0.4, 0.4],
        fluidDepthStrength: [1, 0],
        hsl: [0, -1, 0],
        grid: { columns: 3, rows: 3, spacing: [1.05, 1.35], randomTimeOffset: 0, outerOpacity: 0.4 },
      },
    ],
    post: {
      volumeScale: { background: 0.25, foreground: 0.25 },
      bloom: { intensity: 1.066, opacity: 0.24, threshold: 0, radius: 1 },
      chromatic: null,
      vignette: null,
      afterimage: { strength: 0.95, damp: 0.99, threshold: 0 },
      noise: 0,
    },
    behind: { darken: 0.2, saturation: 1, speed: 0.1 },
  },
};

