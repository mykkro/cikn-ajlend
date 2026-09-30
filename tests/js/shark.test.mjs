import assert from "node:assert/strict";
import { test } from "node:test";

import { createRandom } from "../../static/js/random.js";
import { APPROACH_TIME, createSharkState, SAFE_TIME, updateShark } from "../../static/js/shark.js";

// Round island of radius 25 in the middle of a 96-unit sea.
const terrain = {
  size: 96,
  heightAt: (x, z) => (Math.hypot(x - 48, z - 48) < 25 ? 2 : -3),
};
const floating = () => ({ x: 10, z: 48, radius: 0.5, floating: true });
const onLand = () => ({ x: 48, z: 48, radius: 0.5, floating: false });

// Runs the shark for `seconds`; returns the events it reported.
function run(state, player, seconds, random = createRandom(1)) {
  const events = [];
  for (let t = 0; t < seconds; t += 1 / 30) {
    const e = updateShark(state, 1 / 30, player, terrain, random);
    if (e) events.push(e);
  }
  return events;
}

test("no shark while you stay on land", () => {
  const state = createSharkState();
  assert.deepEqual(run(state, onLand(), 120), []);
  assert.equal(state.shark, null);
});

test("a short swim is safe", () => {
  const state = createSharkState();
  assert.deepEqual(run(state, floating(), SAFE_TIME - 2), []);
  assert.equal(state.shark, null);
});

test("float too long: the shark appears at a distance, in deep water", () => {
  const state = createSharkState();
  const player = floating();
  assert.deepEqual(run(state, player, SAFE_TIME + 0.5), ["appeared"]);
  const s = state.shark;
  assert.equal(s.mode, "circling");
  assert.ok(Math.hypot(s.x - player.x, s.z - player.z) > 15);
  assert.ok(terrain.heightAt(s.x, s.z) < -0.7);
});

test("it spirals in and, if you stay, eats you: game over", () => {
  const state = createSharkState();
  const player = floating();
  run(state, player, SAFE_TIME + 1);
  const early = Math.hypot(state.shark.x - player.x, state.shark.z - player.z);
  run(state, player, APPROACH_TIME / 2);
  const later = Math.hypot(state.shark.x - player.x, state.shark.z - player.z);
  assert.ok(later < early, `closing in: ${early.toFixed(1)} -> ${later.toFixed(1)}`);
  const events = run(state, player, APPROACH_TIME);
  assert.deepEqual(events, ["ate"]);
  assert.equal(state.gameOver, true);
});

test("once it is game over, nothing more happens", () => {
  const state = createSharkState();
  run(state, floating(), SAFE_TIME + APPROACH_TIME + 3);
  assert.equal(state.gameOver, true);
  assert.deepEqual(run(state, onLand(), 5), []);
  assert.equal(state.gameOver, true);
});

test("reach the shore in time and it gives up", () => {
  const state = createSharkState();
  run(state, floating(), SAFE_TIME + APPROACH_TIME / 2);
  assert.deepEqual(run(state, onLand(), 0.1), ["left"]);
  run(state, onLand(), 10);
  assert.equal(state.shark, null);
  assert.equal(state.gameOver, false);
});

test("drying off on land winds the water timer back", () => {
  const state = createSharkState();
  run(state, floating(), 30);
  run(state, onLand(), 5);
  assert.ok(state.waterTime < 30 - 5 * 2.9, `water time ${state.waterTime.toFixed(1)}`);
  // A quick dip right after is safe again.
  assert.deepEqual(run(state, floating(), 20), []);
});

test("it never swims over land, even when you float near the beach", () => {
  const state = createSharkState();
  const player = { x: 48, z: 48 - 26.5, radius: 0.5, floating: true }; // just off the beach
  const random = createRandom(9);
  for (let t = 0; t < SAFE_TIME + APPROACH_TIME - 0.5; t += 1 / 30) {
    updateShark(state, 1 / 30, player, terrain, random);
    if (state.shark) assert.ok(terrain.heightAt(state.shark.x, state.shark.z) < 0, "shark over land");
  }
});

test("near the map edge it still swims in smooth curves (no snapping around)", () => {
  const state = createSharkState();
  const player = { x: 4, z: 30, radius: 0.5, floating: true }; // right by the west edge of the map
  const random = createRandom(11);
  let last = null, worst = 0;
  for (let t = 0; t < SAFE_TIME + APPROACH_TIME - 0.5; t += 1 / 30) {
    updateShark(state, 1 / 30, player, terrain, random);
    const s = state.shark;
    if (!s) continue;
    if (last !== null) worst = Math.max(worst, Math.abs(Math.atan2(Math.sin(s.heading - last), Math.cos(s.heading - last))));
    last = s.heading;
    assert.ok(s.x > 0 && s.x < terrain.size && s.z > 0 && s.z < terrain.size, "stays on the map");
  }
  assert.ok(last !== null, "the shark came");
  assert.ok(worst <= 2.2 / 30 + 1e-9, `largest turn in one frame: ${worst.toFixed(3)} rad`);
});

test("being eaten plays out without errors, even in shallow water", () => {
  const state = createSharkState();
  const player = { x: 48, z: 48 - 26.5, radius: 0.5, floating: true }; // just off the beach
  const events = run(state, player, SAFE_TIME + APPROACH_TIME + 4, createRandom(9));
  assert.deepEqual(events, ["appeared", "ate"]);
  assert.ok(state.eatenFor > 3, "the attack keeps animating after the bite");
});
