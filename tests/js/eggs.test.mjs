import assert from "node:assert/strict";
import { test } from "node:test";

import { createEggState, EGG_POINTS, LAY_DURATION, MAX_EGGS, updateEggs } from "../../static/js/eggs.js";
import { createRandom } from "../../static/js/random.js";

const MAP = 64;
const farPlayer = () => ({ x: 1, z: 1, radius: 0.5 });
const hen = (x = 30, z = 30) => ({ x, z, heading: 0, scale: 1.3, tint: [1, 1, 1], mode: "idle", timer: 1 });

function setup(chickens) {
  const random = createRandom(1);
  const state = createEggState(chickens, random);
  return { state, random };
}

// Steps the simulation, keeping chicken modes as the test sets them.
function run(state, chickens, player, random, seconds, dt = 0.05) {
  let collected = 0;
  for (let t = 0; t < seconds; t += dt) collected += updateEggs(state, dt, chickens, player, [], MAP, random);
  return collected;
}

test("a laying hen squats, then drops an egg behind her", () => {
  const h = hen();
  const { state, random } = setup([h]);
  h.layer = true;
  h.layTimer = 0.5;
  run(state, [h], farPlayer(), random, 0.6);
  assert.equal(h.laying > 0, true, "squatting");
  assert.equal(h.mode, "idle");
  assert.equal(state.eggs.length, 0);
  run(state, [h], farPlayer(), random, LAY_DURATION);
  assert.equal(state.eggs.length, 1);
  assert.ok(state.eggs[0].z < h.z, "heading 0 faces +z, so the egg lands at lower z");
});

test("non-layers never lay", () => {
  const h = hen();
  const { state, random } = setup([h]);
  h.layer = false;
  run(state, [h], farPlayer(), random, 120);
  assert.equal(state.eggs.length, 0);
});

test("a startled hen abandons laying", () => {
  const h = hen();
  const { state, random } = setup([h]);
  h.layer = true;
  h.layTimer = 0.1;
  run(state, [h], farPlayer(), random, 0.3);
  h.mode = "flee";
  run(state, [h], farPlayer(), random, LAY_DURATION);
  assert.equal(h.laying, 0);
  assert.equal(state.eggs.length, 0);
});

test("rolling over an egg collects it once, scores, and removes it", () => {
  const h = hen();
  const { state, random } = setup([h]);
  h.layer = false;
  state.eggs.push({ x: 10, z: 10, radius: 0.15, scale: 1, age: 1, collectedFor: null });
  const player = { x: 10.4, z: 10, radius: 0.5 };
  assert.equal(run(state, [h], player, random, 0.1), 1);
  assert.equal(run(state, [h], player, random, 0.1), 0, "not collected twice during its animation");
  assert.deepEqual([state.collected, state.held, state.score], [1, 1, EGG_POINTS]);
  run(state, [h], player, random, 1);
  assert.equal(state.eggs.length, 0);
});

test("eggs out of reach stay put", () => {
  const h = hen();
  const { state, random } = setup([h]);
  h.layer = false;
  state.eggs.push({ x: 10, z: 10, radius: 0.15, scale: 1, age: 1, collectedFor: null });
  run(state, [h], { x: 10.7, z: 10, radius: 0.5 }, random, 1);
  assert.equal(state.eggs.length, 1);
  assert.equal(state.score, 0);
});

test("no more than MAX_EGGS lie around at once", () => {
  const hens = Array.from({ length: 10 }, (_, i) => hen(5 + i * 5, 30));
  const { state, random } = setup(hens);
  for (const h of hens) h.layer = true;
  run(state, hens, farPlayer(), random, 400, 0.1);
  assert.equal(state.eggs.length, MAX_EGGS);
});
