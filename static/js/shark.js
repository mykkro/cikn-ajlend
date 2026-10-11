// The great white shark: the one way to lose. Float too long and a fin starts
// circling in a tightening spiral; reach the shore in time or be eaten.
// Model space: +z forward (snout), +y up; origin at the middle of the body.

import { createMesh } from "./gl.js";
import * as mat4 from "./mat4.js";
import { cone, ellipsoid, flatShade, merge, transform } from "./shapes.js";
import { SEA_LEVEL, waveHeight } from "./waves.js";

export const SAFE_TIME = 35;        // seconds of floating before the shark comes
export const APPROACH_TIME = 16;    // seconds from first fin to the attack
export const DRY_RATE = 3;          // on land, the water timer winds back this much faster
const START_RADIUS = 22;            // the circle it first swims, around the player
const STRIKE_RADIUS = 2.2;          // spiral this tight and it attacks
const CIRCLE_SPEED = 7;             // units per second along the circle
const TURN_RATE = 2.2;              // radians per second: it swims in smooth curves
const LUNGE_TURN_RATE = 5;
const SWIM_DEPTH = 0.7;             // it keeps to water at least this deep
const CRUISE_Y = -0.55;             // body below the surface; the fin cuts the water
const LEAVE_TIME = 8;
const LUNGE_TIME = 0.7;             // from strike to the bite
const EAT_ANIMATION = 2.5;          // how long the attack keeps animating after the bite

const GREY = [0.46, 0.5, 0.55];
const WHITE = [0.93, 0.93, 0.92];
const MOUTH = [0.35, 0.06, 0.07];
const TOOTH = [0.98, 0.97, 0.9];
const EYE = [0.03, 0.03, 0.04];
const JAW_PIVOT = [0, -0.25, 1.2];
const TAIL_PIVOT = [0, 0, -1.8];
const X_AXIS = [1, 0, 0], Y_AXIS = [0, 1, 0], Z_AXIS = [0, 0, 1];

export function createSharkState() {
  return { waterTime: 0, shark: null, gameOver: false, eatenFor: 0 };
}

function swimmable(terrain, x, z) {
  return x > 1 && z > 1 && x < terrain.size - 1 && z < terrain.size - 1 &&
    terrain.heightAt(x, z) < SEA_LEVEL - SWIM_DEPTH;
}

// Nearest point on the circle around the player that is deep water, searching
// both ways from `angle`. Returns null if the whole circle is land.
function circlePoint(terrain, player, angle, radius) {
  for (let step = 0; step <= 36; step++) {
    for (const sign of step === 0 ? [1] : [1, -1]) {
      const a = angle + sign * step * (Math.PI / 36);
      const x = player.x + Math.sin(a) * radius, z = player.z + Math.cos(a) * radius;
      if (swimmable(terrain, x, z)) return { x, z, angle: a };
    }
  }
  return null;
}

// Returns "appeared", "left" or "ate" on the frame those happen, else null.
export function updateShark(state, dt, player, terrain, random) {
  const s = state.shark;
  if (s) s.phase += dt * (s.mode === "circling" ? 5 : 8);

  if (state.gameOver) {
    state.eatenFor += dt;
    if (s) {
      s.time += dt;
      animateAttack(s, dt, player, terrain);
    }
    return null;
  }

  state.waterTime = player.floating
    ? state.waterTime + dt
    : Math.max(state.waterTime - dt * DRY_RATE, 0);

  if (!s) {
    if (state.waterTime < SAFE_TIME) return null;
    const angle = random.range(0, Math.PI * 2);
    const start = circlePoint(terrain, player, angle, START_RADIUS);
    if (!start) return null; // nowhere deep enough to come from; try again next frame
    state.shark = {
      x: start.x, z: start.z, y: CRUISE_Y, heading: angle + Math.PI / 2,
      angle: start.angle, direction: random() < 0.5 ? 1 : -1,
      mode: "circling", time: 0, phase: 0, pitch: 0, jaw: 0,
    };
    return "appeared";
  }

  if (s.mode === "circling") {
    if (!player.floating) {
      s.mode = "leaving";
      s.time = 0;
      return "left";
    }
    s.time += dt;
    const radius = STRIKE_RADIUS + (START_RADIUS - STRIKE_RADIUS) * Math.max(1 - s.time / APPROACH_TIME, 0);
    s.angle += s.direction * (CIRCLE_SPEED / radius) * dt;
    const target = circlePoint(terrain, player, s.angle, radius);
    if (target) {
      s.angle = target.angle;
      steerToward(s, terrain, target.x, target.z, CIRCLE_SPEED * 1.6, TURN_RATE, dt);
    }
    if (s.time >= APPROACH_TIME) {
      s.mode = "attack";
      s.time = 0;
    }
    return null;
  }

  if (s.mode === "attack") {
    s.time += dt;
    animateAttack(s, dt, player, terrain);
    if (s.time >= LUNGE_TIME) {
      state.gameOver = true;
      return "ate";
    }
    return null;
  }

  // Leaving: swim away from the player and vanish into the deep.
  s.time += dt;
  const away = Math.atan2(s.x - player.x, s.z - player.z);
  const tx = s.x + Math.sin(away) * 5, tz = s.z + Math.cos(away) * 5;
  steerToward(s, terrain, tx, tz, CIRCLE_SPEED, TURN_RATE, dt);
  s.y = CRUISE_Y - Math.min(s.time / LEAVE_TIME, 1) * 2.5; // diving
  if (s.time >= LEAVE_TIME) state.shark = null;
  return null;
}

// Turns toward (x, z) at a limited rate and swims forward along its heading,
// slowing while it turns hard. It stays in deep water unless `anywhere` is set
// (the final lunge may carry it into the shallows).
function steerToward(s, terrain, x, z, maxSpeed, turnRate, dt, anywhere = false) {
  const dx = x - s.x, dz = z - s.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.05) return;
  const turn = Math.atan2(Math.sin(Math.atan2(dx, dz) - s.heading), Math.cos(Math.atan2(dx, dz) - s.heading));
  s.heading += Math.sign(turn) * Math.min(Math.abs(turn), turnRate * dt);
  const step = Math.min(dist, maxSpeed * dt) * Math.max(Math.cos(turn), 0.25);
  const nx = s.x + Math.sin(s.heading) * step, nz = s.z + Math.cos(s.heading) * step;
  if (anywhere || swimmable(terrain, nx, nz)) {
    s.x = nx;
    s.z = nz;
  }
}

// Lunge at the player, breach with the jaws open, snap shut, and crash back down.
// s.time counts from the start of the attack.
function animateAttack(s, dt, player, terrain) {
  const lunge = Math.min(s.time / LUNGE_TIME, 1);                  // 0..1 until the bite
  const after = Math.min(Math.max(s.time - LUNGE_TIME, 0) / EAT_ANIMATION, 1);
  if (lunge < 1) {
    steerToward(s, terrain, player.x, player.z, 14, LUNGE_TURN_RATE, dt, true);
  } else {
    s.x += Math.sin(s.heading) * 3 * dt * (1 - after);             // carry on through the splash
    s.z += Math.cos(s.heading) * 3 * dt * (1 - after);
  }
  const arc = Math.min(lunge * 0.5 + after * 0.5, 1);              // 0.5 at the bite
  s.y = CRUISE_Y + Math.sin(arc * Math.PI) * 1.8;
  s.pitch = 0.8 * Math.cos(arc * Math.PI);                         // nose up, then down
  s.jaw = lunge < 1 ? lunge * 0.8 : Math.max(0.8 - after * 6, 0.05);
}

export function createSharkMeshes(gl) {
  const fin = (base, radius, length, tilt, flat) => flatShade(transform(
    cone([0, 0, 0], radius, length, GREY, 6),
    [mat4.translation(...base), mat4.rotationAxis(X_AXIS, tilt), mat4.scale3(flat, 1, 1)].reduce((a, m) => mat4.multiply(a, m)),
  ));
  const tooth = (x, y, z, down) => transform(cone([0, 0, 0], 0.035, 0.1, TOOTH, 4),
    mat4.multiply(mat4.translation(x, y, z), mat4.rotationAxis(X_AXIS, down ? Math.PI / 2 : -Math.PI / 2)));
  const upperTeeth = [], lowerTeeth = [];
  for (let i = -3; i <= 3; i++) {
    const a = (i / 3) * 1.1;
    upperTeeth.push(tooth(Math.sin(a) * 0.3, -0.3, 1.55 + Math.cos(a) * 0.3, true));
    lowerTeeth.push(tooth(Math.sin(a) * 0.28, 0.02, 0.35 + Math.cos(a) * 0.28, false));
  }
  const pectoral = (side) => flatShade(transform(
    ellipsoid([0, 0, 0], [0.62, 0.05, 0.28], GREY, 4, 8),
    [mat4.translation(0.72 * side, -0.3, 0.55), mat4.rotationAxis(Z_AXIS, -0.45 * side)].reduce((a, m) => mat4.multiply(a, m)),
  ));
  return {
    body: createMesh(gl, merge(
      ellipsoid([0, 0, 0], [0.55, 0.6, 2.0], GREY),
      ellipsoid([0, -0.2, 0.1], [0.5, 0.42, 1.85], WHITE),
      ellipsoid([0, 0.02, 1.75], [0.42, 0.38, 0.55], GREY),              // snout
      ellipsoid([0, -0.28, 1.55], [0.34, 0.1, 0.32], MOUTH),             // inside the mouth
      ellipsoid([0.34, 0.12, 1.6], [0.05, 0.05, 0.05], EYE),
      ellipsoid([-0.34, 0.12, 1.6], [0.05, 0.05, 0.05], EYE),
      fin([0, 0.45, 0.1], 0.5, 1.2, -2.25, 0.16),                        // dorsal fin
      pectoral(1),
      pectoral(-1),
      ...upperTeeth,
    )),
    jaw: createMesh(gl, merge( // relative to JAW_PIVOT
      ellipsoid([0, -0.08, 0.35], [0.36, 0.13, 0.5], WHITE),
      ...lowerTeeth,
    )),
    tail: createMesh(gl, merge( // relative to TAIL_PIVOT
      ellipsoid([0, 0, -0.4], [0.24, 0.3, 0.65], GREY),
      fin([0, 0.1, -0.85], 0.28, 1.1, -2.45, 0.14),                      // upper lobe
      fin([0, -0.1, -0.85], 0.22, 0.75, 2.5, 0.14),                      // lower lobe
    )),
  };
}

export function drawShark(gl, uniforms, meshes, state, time) {
  const s = state.shark;
  if (!s) return;
  const surface = waveHeight(s.x, s.z, time);
  const base = [
    mat4.translation(s.x, surface + s.y, s.z),
    mat4.rotationAxis(Y_AXIS, s.heading),
    mat4.rotationAxis(X_AXIS, -s.pitch),
  ].reduce((a, m) => mat4.multiply(a, m));
  gl.uniform3f(uniforms.uTint, 1, 1, 1);
  gl.uniformMatrix4fv(uniforms.uModel, false, base);
  meshes.body.draw();
  gl.uniformMatrix4fv(uniforms.uModel, false,
    mat4.multiply(mat4.multiply(base, mat4.translation(...JAW_PIVOT)), mat4.rotationAxis(X_AXIS, s.jaw)));
  meshes.jaw.draw();
  const sweep = Math.sin(s.phase) * (s.mode === "attack" ? 0.5 : 0.3);
  gl.uniformMatrix4fv(uniforms.uModel, false,
    mat4.multiply(mat4.multiply(base, mat4.translation(...TAIL_PIVOT)), mat4.rotationAxis(Y_AXIS, sweep)));
  meshes.tail.draw();
}
