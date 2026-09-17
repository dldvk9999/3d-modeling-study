// Values lifted from the original's `prod-2-agentic` scene preset and the
// Theatre.js state that sits on top of it. Units are the original's world
// units, so the camera, the light volume and the cloud line up the same way.

export const CAMERA = {
  // Theatre overrides the preset camera, so these are the Theatre values
  position: [-0.012337694942119056, 0.07944265448797339, -0.44905051315225064],
  target: [0.2057636663094521, -0.0705398556730998, 0.5073804838572582],
  positionOffset: [0, 0.05382072480346186, 0.24],
  fov: 40,
  // pointer x swings yaw between these, pointer y swings pitch
  pointerYaw: [0.15, -0.15],
  pointerPitch: [0.05, -0.05],
  scrollDrift: { up: 0.2, back: 0.2 },
  // one Theatre keyframe pair, laid over the first screens of the section
  keyframes: {
    from: 0.967,
    to: 4.967,
    ease: [0.5, 0, 0.324, 0.969] as const,
    positionOffsetX: -0.124,
    rotationOffsetX: -0.114,
    rotationOffsetY: 0.046,
  },
} as const;

export const LIGHT_VOLUME = {
  position: [0, -0.093, 1.3],
  rotationY: 0.017453292519943295,
  scale: [1.6, 1.6, 1],
  width: 1,
  depth: 3.5,
  aspect: 640 / 360,
  opacity: 2,
  brightness: 2.1,
  threshold: 0.025,
  softness: 0.441,
  loopCount: 2.5,
  raymarchSteps: 100,
  playbackSeconds: 5.94,
  fluidStrength: [-0.25, 0.25],
  fluidDepthStrength: [3, -2],
  // hue turn and saturation push the preset applies to the clip
  hsl: [0.0215, 0.1, 0],
  grid: {
    columns: 3,
    rows: 3,
    spacing: [0.815, 0.9],
    randomTimeOffset: 0.87,
    outerOpacity: 0.24,
  },
} as const;

export const POINT_CLOUD = {
  count: 65515,
  position: [-0.51, 0.13, 0.67],
  scale: 0.5,
  // the loader fits every capture into a 5-unit box before the preset scale
  normalizedExtent: 5,
  pointSize: 0.005 * 1.25,
  maxPointSize: 2 * 1.25,
  opacity: 0.53,
  randomize: [0.198, 0.002, 0.004],
  cameraFade: { near: 0, far: 1.95 },
  conveyor: { speed: -0.2, depth: 4.544303797468353, near: 0, far: 7.974683544303791 },
  fluidInfluence: 0.6,
  caustics: {
    strength: 0.41139240506329117,
    scale: 1,
    axisScale: [2, 1, 1],
    speed: [0, 0, 0.5],
    power: 8,
    color: [1, 0.9725490196078431, 0.9333333333333333],
  },
} as const;

export const POST = {
  // how much of the screen each layer is rendered at
  volumeScale: 0.45,
  mainScale: 0.75,
  bloom: { intensity: 0.22151898734177217, opacity: 0.15189873417721517, radius: 0.46835443037974667 },
  chromatic: { amount: 0.0015822784810126582, angle: 1.5509128289873633 },
  vignette: { amount: 0.23417721518987358, radius: 0.895, softness: 0.441 },
  afterimage: { strength: 0.99, damp: 0.99 },
  noise: 0.010443037974683544,
  environment: { blur: 0.6708860759493668, darken: 0.9240506329113923 },
  behindContent: { darken: 0.35, saturation: 0.8 },
} as const;
