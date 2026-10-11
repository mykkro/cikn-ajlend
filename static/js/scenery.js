// Builds all static scenery (trees, rocks, bushes, grass) into one merged geometry,
// plus the solid obstacles used for collision. Placement comes from the server.

import * as mat4 from "./mat4.js";
import { cone, cylinder, ellipsoid, flatShade, jitter, merge, transform } from "./shapes.js";

const BARK = [0.45, 0.3, 0.18];
const LEAF = [0.33, 0.58, 0.22];
const LEAF_DARK = [0.24, 0.47, 0.2];
const PINE = [0.17, 0.4, 0.25];
const STONE = [0.56, 0.54, 0.51];
const BUSH = [0.27, 0.5, 0.2];
const GRASS_BASE = [0.26, 0.48, 0.18];
const GRASS_TIP = [0.52, 0.72, 0.3];

// Collision footprint radius at scale 1; mirrors SOLID_RADIUS in props.py.
const SOLID_RADIUS = { trees: 0.3, rocks: 0.5 };
const ROCK_VARIANTS = 4;

const X_AXIS = [1, 0, 0], Y_AXIS = [0, 1, 0];
const POINT_UP = mat4.rotationAxis(X_AXIS, -Math.PI / 2); // turns +z-pointing cones to +y

function roundTree() {
  return merge(
    cylinder([0, 1.4, 0], 0.14, 1.55, BARK),
    flatShade(ellipsoid([0, 1.95, 0], [0.95, 0.8, 0.95], LEAF, 5, 8)),
    flatShade(ellipsoid([0.4, 2.45, 0.15], [0.6, 0.55, 0.6], LEAF, 5, 7)),
    flatShade(ellipsoid([-0.35, 2.35, -0.25], [0.55, 0.5, 0.55], LEAF_DARK, 5, 7)),
  );
}

function pineTree() {
  const tier = (y, radius, height) =>
    flatShade(transform(cone([0, 0, 0], radius, height, PINE, 7), mat4.multiply(mat4.translation(0, y, 0), POINT_UP)));
  return merge(
    cylinder([0, 0.8, 0], 0.12, 0.95, BARK),
    tier(0.6, 0.95, 1.3),
    tier(1.25, 0.75, 1.1),
    tier(1.85, 0.5, 0.95),
  );
}

function rock(random) {
  return flatShade(jitter(ellipsoid([0, 0.22, 0], [0.6, 0.45, 0.55], STONE, 4, 7), [0, 0.22, 0], 0.22, random));
}

function bush() {
  return merge(
    ellipsoid([0, 0.3, 0], [0.5, 0.4, 0.5], BUSH, 6, 9),
    ellipsoid([0.35, 0.25, 0.15], [0.35, 0.3, 0.35], LEAF, 5, 8),
    ellipsoid([-0.3, 0.22, -0.1], [0.35, 0.28, 0.35], LEAF_DARK, 5, 8),
  );
}

// A tuft of thin blades, emitted double-sided with upward normals so both
// faces light the same way.
function grassTuft(random, blades = 5) {
  const positions = [], normals = [], colors = [], indices = [];
  for (let i = 0; i < blades; i++) {
    const angle = (i / blades) * Math.PI * 2 + random() * 0.8;
    const spread = 0.04 + random() * 0.08;
    const bx = Math.cos(angle) * spread, bz = Math.sin(angle) * spread;
    const height = 0.3 + random() * 0.25;
    const lean = 0.08 + random() * 0.12;
    const width = 0.035;
    const side = [-Math.sin(angle) * width, Math.cos(angle) * width];
    const verts = [
      [bx - side[0], 0, bz - side[1]],
      [bx + side[0], 0, bz + side[1]],
      [bx + Math.cos(angle) * lean, height, bz + Math.sin(angle) * lean],
    ];
    const base = positions.length / 3;
    verts.forEach((v, k) => {
      positions.push(...v);
      normals.push(0, 1, 0);
      colors.push(...(k === 2 ? GRASS_TIP : GRASS_BASE));
    });
    indices.push(base, base + 1, base + 2, base, base + 2, base + 1);
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
  };
}

export function buildScenery(props, terrain, random) {
  const templates = {
    trees: [roundTree(), pineTree()],
    rocks: Array.from({ length: ROCK_VARIANTS }, () => rock(random)),
    bushes: [bush()],
    grass: Array.from({ length: 6 }, () => grassTuft(random)),
  };
  // How far each kind sinks into the ground (per unit scale), to hide gaps on slopes.
  const sink = { trees: 0.05, rocks: 0.12, bushes: 0.08, grass: 0.02 };

  const parts = [];
  const obstacles = [];
  for (const kind of Object.keys(templates)) {
    const items = props[kind];
    for (const [x, z, scale, rotation, variant] of items) {
      const options = templates[kind];
      const template = options[variant ?? Math.floor(random() * options.length)];
      const y = terrain.heightAt(x, z) - sink[kind] * scale;
      const model = mat4.multiply(
        mat4.multiply(mat4.translation(x, y, z), mat4.rotationAxis(Y_AXIS, rotation)),
        mat4.scaling(scale),
      );
      const shade = 0.88 + random() * 0.24;
      const tint = [shade * (0.96 + random() * 0.08), shade, shade * (0.96 + random() * 0.08)];
      parts.push(transform(template, model, tint));
      if (kind in SOLID_RADIUS) {
        obstacles.push({ x, z, radius: SOLID_RADIUS[kind] * scale, static: true });
      }
    }
  }
  return { geometry: merge(...parts), obstacles };
}
