// Egg laying by chickens, egg pickup by the player, and the resulting score.

import { clampToBounds, resolveCollisions } from "./collision.js";
import * as mat4 from "./mat4.js";
import { ellipsoid } from "./shapes.js";

export const EGG_POINTS = 10;
export const LAY_DURATION = 1.2;   // seconds a chicken squats before the egg appears
export const MAX_EGGS = 30;        // eggs on the ground at once
const LAYER_FRACTION = 0.6;        // share of chickens that lay at all
const LAY_INTERVAL = [10, 25];     // seconds between eggs for one chicken
const EGG_RADIUS = 0.15;           // pickup/footprint radius at scale 1
const POP_IN = 0.25;               // seconds for a new egg to grow to full size
const COLLECT_TIME = 0.35;         // seconds of the fly-up animation after pickup

const CREAM = [0.98, 0.95, 0.86];
const BROWN = [0.8, 0.58, 0.38];
const X_AXIS = [1, 0, 0], Y_AXIS = [0, 1, 0];

export function createEggGeometry() {
  return ellipsoid([0, 0, 0], [0.13, 0.17, 0.13], [1, 1, 1], 8, 10);
}

// Decides which chickens lay and when they first will.
export function createEggState(chickens, random) {
  for (const chicken of chickens) {
    chicken.layer = random() < LAYER_FRACTION;
    chicken.layTimer = random.range(...LAY_INTERVAL);
    chicken.laying = 0; // 1 -> 0 while squatting
  }
  // held: eggs in the player's basket (collected minus given away).
  return { eggs: [], collected: 0, held: 0, score: 0 };
}

// Advances laying and pickup. Returns how many eggs the player collected this frame.
export function updateEggs(state, dt, chickens, player, obstacles, mapSize, random) {
  for (const chicken of chickens) {
    if (!chicken.layer) continue;
    if (chicken.laying > 0) {
      if (chicken.mode === "flee") {
        // Startled: give up and try again a bit later.
        chicken.laying = 0;
        chicken.layTimer = random.range(3, 6);
        continue;
      }
      chicken.laying -= dt / LAY_DURATION;
      if (chicken.laying <= 0) {
        chicken.laying = 0;
        chicken.layTimer = random.range(...LAY_INTERVAL);
        state.eggs.push(layEgg(chicken, obstacles, mapSize, random));
      }
    } else if ((chicken.layTimer -= dt) <= 0 && chicken.mode !== "flee" && state.eggs.length < MAX_EGGS) {
      chicken.laying = 1;
      chicken.mode = "idle";
      chicken.timer = LAY_DURATION + 0.5; // keep it standing still until done
    }
  }

  let collectedNow = 0;
  for (const egg of state.eggs) {
    egg.age += dt;
    if (egg.collectedFor !== null) {
      egg.collectedFor += dt;
    } else if (Math.hypot(player.x - egg.x, player.z - egg.z) < player.radius + egg.radius) {
      egg.collectedFor = 0;
      state.collected += 1;
      state.held += 1;
      state.score += EGG_POINTS;
      collectedNow += 1;
    }
  }
  state.eggs = state.eggs.filter((egg) => egg.collectedFor === null || egg.collectedFor < COLLECT_TIME);
  return collectedNow;
}

function layEgg(chicken, obstacles, mapSize, random) {
  // Drop it just behind the tail, outside any rock or tree trunk.
  const behind = 0.35 * chicken.scale;
  const size = chicken.scale / 1.3;
  const egg = {
    x: chicken.x - Math.sin(chicken.heading) * behind,
    z: chicken.z - Math.cos(chicken.heading) * behind,
    radius: EGG_RADIUS * size,
    mass: 1,
    scale: size,
    spin: random.range(0, Math.PI * 2),
    color: chicken.tint[2] < 0.65 ? BROWN : CREAM, // tan hens lay brown eggs
    age: 0,
    collectedFor: null,
  };
  resolveCollisions([egg], obstacles, 1);
  clampToBounds(egg, mapSize);
  return egg;
}

export function drawEggs(gl, uniforms, mesh, state, terrain) {
  for (const egg of state.eggs) {
    const grow = easeOutBack(Math.min(egg.age / POP_IN, 1));
    const t = egg.collectedFor === null ? 0 : egg.collectedFor / COLLECT_TIME;
    const scale = egg.scale * grow * (1 - t);
    if (scale <= 0) continue;
    const y = terrain.heightAt(egg.x, egg.z) + 0.12 * egg.scale + t * 1.5;
    // Lying almost on its side, like a real egg on the ground.
    const model = [
      mat4.rotationAxis(Y_AXIS, egg.spin + t * 8),
      mat4.rotationAxis(X_AXIS, 1.35),
      mat4.scaling(scale),
    ].reduce((acc, m) => mat4.multiply(acc, m), mat4.translation(egg.x, y, egg.z));
    gl.uniform3fv(uniforms.uTint, egg.color);
    gl.uniformMatrix4fv(uniforms.uModel, false, model);
    mesh.draw();
  }
}

function easeOutBack(t) {
  const c = 1.7;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}
