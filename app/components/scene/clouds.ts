// Stand-ins for the captured point clouds each chapter of the original loads.
// Each builder produces points in its own units; like the original's loader,
// the result is then centred on its bounds and scaled so its longest side is
// 5 units, which is the space the chapter presets position and rotate.

export type CloudId =
  | "cards" // Agentic: interface cards stepping away into depth
  | "arches" // Sidekick: a room of stone arches with a mossy floor
  | "forest" // Online: a path running between trees
  | "storefront" // Retail: a glass-fronted store on a plaza
  | "nebula" // Marketing, Payments, Finance, Developer: wispy filaments
  | "globe" // Operations: a planet's surface
  | "galaxy"; // Shop app: a spiral winding into a funnel

export type CloudData = {
  positions: Float32Array;
  colors: Float32Array;
  count: number;
};

const EXTENT = 5;

function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function hash3(x: number, y: number, z: number) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return h - Math.floor(h);
}

function noise3(x: number, y: number, z: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const sz = fz * fz * (3 - 2 * fz);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const corner = (dx: number, dy: number, dz: number) => hash3(ix + dx, iy + dy, iz + dz);
  return lerp(
    lerp(lerp(corner(0, 0, 0), corner(1, 0, 0), sx), lerp(corner(0, 1, 0), corner(1, 1, 0), sx), sy),
    lerp(lerp(corner(0, 0, 1), corner(1, 0, 1), sx), lerp(corner(0, 1, 1), corner(1, 1, 1), sx), sy),
    sz,
  );
}

function fbm3(x: number, y: number, z: number) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < 4; i++) {
    sum += noise3(x * f, y * f, z * f) * amp;
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

class Writer {
  positions: Float32Array;
  colors: Float32Array;
  index = 0;
  constructor(readonly count: number) {
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
  }
  get full() {
    return this.index >= this.count;
  }
  push(x: number, y: number, z: number, r: number, g: number, b: number) {
    if (this.full) return;
    const i = this.index++;
    this.positions[i * 3] = x;
    this.positions[i * 3 + 1] = y;
    this.positions[i * 3 + 2] = z;
    this.colors[i * 3] = Math.min(1, Math.max(0, r));
    this.colors[i * 3 + 1] = Math.min(1, Math.max(0, g));
    this.colors[i * 3 + 2] = Math.min(1, Math.max(0, b));
  }
}

// ---------------------------------------------------------------------------

function roundedRectPoint(
  cx: number,
  cy: number,
  w: number,
  h: number,
  radius: number,
  rand: () => number,
): [number, number] {
  const hw = w / 2 - radius;
  const hh = h / 2 - radius;
  const straight = 4 * (hw + hh);
  const arcs = 2 * Math.PI * radius;
  let s = rand() * (straight + arcs);
  const edges: [number, number, number, number, number][] = [
    [2 * hw, -hw, h / 2, 1, 0],
    [2 * hh, w / 2, hh, 0, -1],
    [2 * hw, hw, -h / 2, -1, 0],
    [2 * hh, -w / 2, -hh, 0, 1],
  ];
  for (const [length, x0, y0, dx, dy] of edges) {
    if (s < length) return [cx + x0 + dx * s, cy + y0 + dy * s];
    s -= length;
  }
  const corners: [number, number][] = [
    [hw, hh],
    [hw, -hh],
    [-hw, -hh],
    [-hw, hh],
  ];
  const which = Math.floor(rand() * 4);
  const a = rand() * Math.PI * 0.5 - (Math.PI * 0.5) * which;
  const [ox, oy] = corners[which];
  return [cx + ox + Math.cos(a) * radius, cy + oy + Math.sin(a) * radius];
}

function buildCards(count: number, rand: () => number) {
  const out = new Writer(count);
  const cardCount = 7;
  const cards = Array.from({ length: cardCount }, (_, i) => {
    const t = i / (cardCount - 1);
    const teal = i === 3 || i === 4;
    return {
      cx: -4.3 + t * 5.5,
      cy: 0.3 + Math.sin(t * 2.6) * 0.3,
      cz: -2.3 + t * 5.6,
      w: 2.2 - t * 0.35,
      h: 1.55 - t * 0.2,
      tint: teal ? [0.62, 0.92, 0.84] : [1.0, 0.91, 0.76],
    };
  });
  // keep the capture's overall bounds so the loader fits it the same way
  out.push(-5.478, -1.108, -2.904, 0, 0, 0);
  out.push(2.132, 1.797, 4.061, 0, 0, 0);
  while (!out.full) {
    const card = cards[Math.floor(rand() * cardCount)];
    const roll = rand();
    let x: number;
    let y: number;
    let bright: number;
    if (roll < 0.46) {
      [x, y] = roundedRectPoint(card.cx, card.cy, card.w, card.h, 0.16, rand);
      x += (rand() - 0.5) * 0.04;
      y += (rand() - 0.5) * 0.04;
      bright = 0.8 + rand() * 0.2;
    } else if (roll < 0.58) {
      const a = rand() * Math.PI * 2;
      const r = 0.2 + (rand() - 0.5) * 0.03;
      x = card.cx - card.w * 0.28 + Math.cos(a) * r;
      y = card.cy + card.h * 0.12 + Math.sin(a) * r;
      bright = 0.75 + rand() * 0.25;
    } else if (roll < 0.72) {
      const line = Math.floor(rand() * 3);
      x = card.cx - card.w * 0.05 + rand() * [0.9, 0.7, 0.5][line];
      y = card.cy + card.h * 0.2 - line * 0.22 + (rand() - 0.5) * 0.03;
      bright = 0.5 + rand() * 0.3;
    } else {
      x = card.cx + (rand() - 0.5) * card.w;
      y = card.cy + (rand() - 0.5) * card.h;
      bright = 0.18 + rand() * 0.3;
    }
    const grain = 0.85 + rand() * 0.15;
    out.push(
      x,
      y,
      card.cz + (rand() - 0.5) * 0.18,
      card.tint[0] * bright * grain,
      card.tint[1] * bright * grain,
      card.tint[2] * bright * grain,
    );
  }
  return out;
}

// Submerged arches: a flooded floor and low arches on piers, most of it in a
// thin band around the viewer, with a scatter of far strays setting the bounds.
function buildArches(count: number, rand: () => number) {
  const out = new Writer(count);
  // the capture's bounds, held by two unlit strays so the loader fits the same
  out.push(-54.19, -19.86, -52.13, 0, 0, 0);
  out.push(35.47, 41.38, 40.87, 0, 0, 0);
  const floorY = -0.6;
  const stone = (shade: number, moss: number): [number, number, number] => [
    0.5 * shade + 0.08 * moss,
    0.5 * shade + 0.2 * moss,
    0.44 * shade,
  ];
  const arches = [
    { x: -3, z: -6, dir: 0 },
    { x: 4, z: -12, dir: 1 },
    { x: -9, z: 2, dir: 1 },
    { x: 1, z: -1, dir: 0 },
  ];
  while (!out.full) {
    const roll = rand();
    if (roll < 0.5) {
      // the wet floor, densest around the room's middle
      const x = (rand() - 0.5) * 34 + (rand() - 0.5) * 10;
      const z = -4 + (rand() - 0.5) * 32 + (rand() - 0.5) * 10;
      const bump = fbm3(x * 0.3, 0, z * 0.3);
      const moss = Math.max(0, fbm3(x * 0.2 + 9, 1, z * 0.2) * 2 - 0.9);
      const [r, g, b] = stone(0.5 + bump * 0.6, moss);
      out.push(x, floorY + bump * 0.6, z, r, g, b);
    } else if (roll < 0.9) {
      const arch = arches[Math.floor(rand() * arches.length)];
      const radius = 2.6;
      const pier = 0.8;
      const height = 4;
      let u: number;
      let v: number;
      if (rand() < 0.55) {
        u = (rand() < 0.5 ? -1 : 1) * (radius + (rand() - 0.5) * pier);
        v = floorY + rand() * height;
      } else {
        const a = rand() * Math.PI;
        const r = radius + (rand() - 0.5) * pier;
        u = Math.cos(a) * r;
        v = floorY + height + Math.sin(a) * r;
      }
      const depth = (rand() - 0.5) * pier * 2;
      const x = arch.dir === 0 ? arch.x + u : arch.x + depth;
      const z = arch.dir === 0 ? arch.z + depth : arch.z + u;
      const moss = Math.max(0, fbm3(x * 0.4, v * 0.4, z * 0.4) * 2 - 0.85);
      const [r, g, b] = stone(0.7 + rand() * 0.3, moss);
      out.push(x, v, z, r, g, b);
    } else {
      // greenery and dust hanging in the air
      const x = (rand() - 0.5) * 30;
      const y = floorY + rand() * 8;
      const z = -4 + (rand() - 0.5) * 30;
      out.push(x, y, z, 0.3, 0.45, 0.25);
    }
  }
  return out;
}

// A path between two rows of trees.
function buildForest(count: number, rand: () => number) {
  const out = new Writer(count);
  const groundY = -0.32;
  const trees = Array.from({ length: 22 }, (_, i) => ({
    x: (i % 2 === 0 ? -1 : 1) * (0.2 + rand() * 0.18),
    z: -2.8 + (i / 22) * 2.5 + rand() * 0.05,
    height: 0.55 + rand() * 0.2,
    crown: 0.1 + rand() * 0.07,
  }));
  while (!out.full) {
    const roll = rand();
    if (roll < 0.28) {
      const x = -0.36 + rand() * 0.84;
      const z = -2.81 + rand() * 2.51;
      const onPath = Math.abs(x - 0.05 - Math.sin(z * 2.2) * 0.04) < 0.07;
      const bump = fbm3(x * 20, 0, z * 20);
      if (onPath) out.push(x, groundY + bump * 0.01, z, 0.72, 0.52, 0.42);
      else out.push(x, groundY + bump * 0.03, z, 0.32 + bump * 0.2, 0.5 + bump * 0.2, 0.24);
    } else if (roll < 0.82) {
      const tree = trees[Math.floor(rand() * trees.length)];
      if (rand() < 0.15) {
        out.push(
          tree.x + (rand() - 0.5) * 0.02,
          groundY + rand() * tree.height,
          tree.z + (rand() - 0.5) * 0.02,
          0.35,
          0.3,
          0.22,
        );
      } else {
        // clumps of leaves; the tops catch the light and go gold
        const u = rand() * Math.PI * 2;
        const w = Math.acos(rand() * 2 - 1);
        const r = tree.crown * Math.cbrt(rand());
        const x = tree.x + Math.sin(w) * Math.cos(u) * r * 1.3;
        const y = groundY + tree.height * 0.7 + Math.cos(w) * r * 1.6;
        const z = tree.z + Math.sin(w) * Math.sin(u) * r;
        const lit = Math.min(1, Math.max(0, (y - groundY) / 0.8 + fbm3(x * 12, y * 12, z * 12) - 0.5));
        out.push(x, Math.min(0.46, y), z, 0.45 + lit * 0.45, 0.5 + lit * 0.3, 0.2 + lit * 0.1);
      }
    } else {
      const x = -0.36 + rand() * 0.84;
      const y = groundY + rand() * 0.78;
      const z = -2.81 + rand() * 2.51;
      out.push(x, y, z, 0.7, 0.62, 0.4);
    }
  }
  return out;
}

// A long glass store under a roof slab, lit warm from inside.
function buildStorefront(count: number, rand: () => number) {
  const out = new Writer(count);
  const ground = -0.15;
  // the store stands back from the plaza the viewer is on
  const box = { x0: -0.62, x1: 0.38, y1: 0.24, z0: -1.55, z1: -0.72 };
  // pin the capture's bounds so the loader fits it the same way
  out.push(-0.81, -0.15, -1.81, 0, 0, 0);
  out.push(0.54, 0.29, -0.3, 0, 0, 0);
  while (!out.full) {
    const roll = rand();
    if (roll < 0.22) {
      const x = -0.81 + rand() * 1.35;
      const z = -1.81 + rand() * 1.51;
      const shade = 0.55 + fbm3(x * 8, 0, z * 8) * 0.3;
      out.push(x, ground, z, 0.3 * shade + 0.04, 0.27 * shade + 0.04, 0.32 * shade + 0.05);
    } else if (roll < 0.62) {
      // glass walls: warm interior showing between mullions
      const side = Math.floor(rand() * 3);
      const y = ground + rand() * (box.y1 - ground);
      let x: number;
      let z: number;
      let along: number;
      if (side === 0) {
        x = box.x0 + rand() * (box.x1 - box.x0);
        z = box.z1;
        along = x;
      } else if (side === 1) {
        x = box.x1;
        z = box.z0 + rand() * (box.z1 - box.z0);
        along = z;
      } else {
        x = box.x0;
        z = box.z0 + rand() * (box.z1 - box.z0);
        along = z;
      }
      const mullion = Math.abs(((along * 9) % 1) - 0.5) > 0.44;
      const glow = fbm3(x * 6, y * 6, z * 6);
      if (mullion) out.push(x, y, z, 0.55, 0.5, 0.42);
      else if (glow > 0.55) out.push(x, y, z, 0.48, 0.64, 0.58);
      else out.push(x, y, z, 0.88, 0.45 + glow * 0.2, 0.26 + glow * 0.15);
    } else if (roll < 0.8) {
      // the roof slab overhanging all round
      const x = box.x0 - 0.16 + rand() * (box.x1 - box.x0 + 0.32);
      const z = box.z0 - 0.16 + rand() * (box.z1 - box.z0 + 0.32);
      const y = box.y1 + rand() * 0.04;
      out.push(x, y, z, 0.22, 0.23, 0.2);
    } else if (roll < 0.93) {
      // the warm room inside
      const x = box.x0 + rand() * (box.x1 - box.x0);
      const y = ground + rand() * (box.y1 - ground) * 0.8;
      const z = box.z0 + rand() * (box.z1 - box.z0);
      out.push(x, y, z, 0.85, 0.45, 0.25);
    } else {
      // a tree by the corner
      const u = rand() * Math.PI * 2;
      const r = 0.12 * Math.cbrt(rand());
      out.push(-0.62 + Math.cos(u) * r, 0.18 + (rand() - 0.5) * 0.2, -0.32 + Math.sin(u) * r, 0.34, 0.45, 0.32);
    }
  }
  return out;
}

// Wispy filaments: random walks bending through a noise field, bright white
// cores with magenta at the tips.
function buildNebula(count: number, rand: () => number) {
  const out = new Writer(count);
  // the capture's bounds, held by two unlit strays so the loader fits the same
  out.push(-111.77, -77.69, -105.62, 0, 0, 0);
  out.push(120.09, 104.39, 114.51, 0, 0, 0);
  const strands = 70;
  const perStrand = Math.floor((count * 0.88) / strands);
  // each filament wanders about this far from where it starts
  const strandLength = 70;
  for (let s = 0; s < strands && !out.full; s++) {
    let x = (rand() - 0.5) * 30;
    let y = (rand() - 0.5) * 30;
    let z = (rand() - 0.5) * 30 - 10;
    const heading = [rand() - 0.5, rand() - 0.5, rand() - 0.5];
    const magentaStrand = rand() < 0.3;
    const step = strandLength / perStrand;
    for (let i = 0; i < perStrand && !out.full; i++) {
      const t = i / perStrand;
      // steer through the noise field every few steps; it changes slowly anyway
      if (i % 4 === 0) {
        heading[0] = heading[0] * 0.85 + (noise3(x * 0.03 + s, y * 0.03, z * 0.03) - 0.5) * 0.8;
        heading[1] = heading[1] * 0.85 + (noise3(x * 0.03, y * 0.03 + s, z * 0.03) - 0.5) * 0.8;
        heading[2] = heading[2] * 0.85 + (noise3(x * 0.03, y * 0.03, z * 0.03 + s) - 0.5) * 0.8;
        // and turn back before leaving the cloud
        const r = Math.hypot(x, y, z + 10);
        if (r > 45) {
          heading[0] -= (x / r) * 0.5;
          heading[1] -= (y / r) * 0.5;
          heading[2] -= ((z + 10) / r) * 0.5;
        }
      }
      const len = Math.hypot(heading[0], heading[1], heading[2]) || 1;
      x += (heading[0] / len) * step;
      y += (heading[1] / len) * step;
      z += (heading[2] / len) * step;
      const spread = 0.6 + t * 2;
      const px = x + (rand() - 0.5) * spread;
      const py = y + (rand() - 0.5) * spread;
      const pz = z + (rand() - 0.5) * spread;
      const magenta = magentaStrand && t > 0.4 ? (t - 0.4) / 0.6 : 0;
      const bright = 0.75 + rand() * 0.25;
      out.push(px, py, pz, bright * (0.9 - magenta * 0.05), bright * (0.92 - magenta * 0.7), bright * (0.95 - magenta * 0.05));
    }
  }
  while (!out.full) {
    const r = 110 * Math.cbrt(rand());
    const u = rand() * Math.PI * 2;
    const w = Math.acos(rand() * 2 - 1);
    out.push(Math.sin(w) * Math.cos(u) * r, Math.cos(w) * r, Math.sin(w) * Math.sin(u) * r, 0.7, 0.7, 0.75);
  }
  return out;
}

// A planet: points on the shell, coloured by continent noise.
function buildGlobe(count: number, rand: () => number) {
  const out = new Writer(count);
  const radius = 0.165;
  while (!out.full) {
    const u = rand() * Math.PI * 2;
    const v = Math.acos(rand() * 2 - 1);
    const nx = Math.sin(v) * Math.cos(u);
    const ny = Math.cos(v);
    const nz = Math.sin(v) * Math.sin(u);
    const land = fbm3(nx * 2.2 + 5, ny * 2.2 + 5, nz * 2.2 + 5) > 0.54;
    const cloud = fbm3(nx * 4 + 20, ny * 4 + 20, nz * 4 + 20) > 0.66;
    const ice = Math.abs(ny) > 0.88;
    let color: [number, number, number];
    if (cloud || ice) color = [0.85, 0.9, 0.95];
    else if (land) color = [0.72, 0.62, 0.48];
    else color = [0.22, 0.42, 0.62];
    const r = radius * (1 - rand() * 0.02);
    out.push(nx * r, ny * r - 0.0, nz * r - 1.0, color[0], color[1], color[2]);
  }
  return out;
}

// A two-armed spiral dropping into a funnel.
function buildGalaxy(count: number, rand: () => number) {
  const out = new Writer(count);
  while (!out.full) {
    const arm = Math.floor(rand() * 2);
    const t = Math.pow(rand(), 0.7);
    const r = 0.02 + t * 0.53;
    const angle = arm * Math.PI + Math.log(r / 0.02) * 1.9 + (rand() - 0.5) * 0.5;
    const scatter = 0.015 + t * 0.05;
    const x = Math.cos(angle) * r + (rand() - 0.5) * scatter;
    const y = Math.sin(angle) * r + (rand() - 0.5) * scatter + 0.04;
    const z = -0.5 + Math.pow(1 - t, 2) * -0.5 + (rand() - 0.5) * 0.06 + 0.5;
    const core = 1 - t;
    out.push(x, y, z, 0.55 + core * 0.4, 0.5 + core * 0.45, 0.95);
  }
  return out;
}

const BUILDERS: Record<CloudId, (count: number, rand: () => number) => Writer> = {
  cards: buildCards,
  arches: buildArches,
  forest: buildForest,
  storefront: buildStorefront,
  nebula: buildNebula,
  globe: buildGlobe,
  galaxy: buildGalaxy,
};

const cache = new Map<string, CloudData>();

export function buildCloud(id: CloudId, count: number): CloudData {
  const key = `${id}:${count}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const writer = BUILDERS[id](count, makeRandom(7));
  const { positions } = writer;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 3; k++) {
      const v = positions[i * 3 + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  const centre = [0, 1, 2].map((k) => (min[k] + max[k]) / 2);
  const fit = EXTENT / Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], 1e-6);
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 3; k++) {
      positions[i * 3 + k] = (positions[i * 3 + k] - centre[k]) * fit;
    }
  }

  const data = { positions, colors: writer.colors, count };
  cache.set(key, data);
  return data;
}
