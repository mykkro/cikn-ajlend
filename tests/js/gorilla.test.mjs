import assert from "node:assert/strict";
import { test } from "node:test";

import { createGorilla, DANCE_DURATION, DANCE_EGGS, DANCE_WINDOW, speechText, updateGorilla } from "../../static/js/gorilla.js";
import { createRandom } from "../../static/js/random.js";

const nearPlayer = () => ({ x: 10, z: 12.2, radius: 0.5 });
const farPlayer = () => ({ x: 10, z: 30, radius: 0.5 });

function setup(held = 5) {
  return { gorilla: createGorilla([10, 10, 0]), eggs: { held, collected: held, score: held * 10 }, random: createRandom(3) };
}

// Advances time without giving.
function wait(g, seconds, player, eggs, random) {
  for (let t = 0; t < seconds; t += 0.1) updateGorilla(g, 0.1, player, eggs, false, random);
}

test("giving an egg in reach hands it over and starts her eating", () => {
  const { gorilla, eggs, random } = setup(2);
  assert.equal(updateGorilla(gorilla, 0.016, nearPlayer(), eggs, true, random), true);
  assert.equal(eggs.held, 1);
  assert.equal(gorilla.eggsEaten, 1);
  assert.ok(gorilla.eating > 0);
  assert.equal(eggs.score, 20, "score is untouched");
});

test("too far away: nothing happens", () => {
  const { gorilla, eggs, random } = setup(2);
  assert.equal(updateGorilla(gorilla, 0.016, farPlayer(), eggs, true, random), false);
  assert.equal(eggs.held, 2);
});

test("empty-handed: she says something but takes nothing", () => {
  const { gorilla, eggs, random } = setup(0);
  assert.equal(updateGorilla(gorilla, 0.016, nearPlayer(), eggs, true, random), false);
  assert.equal(eggs.held, 0);
  assert.equal(gorilla.speech?.key, "emptyHanded");
  assert.ok(speechText(gorilla).length > 0);
});

test("key mashing is rate limited", () => {
  const { gorilla, eggs, random } = setup(5);
  updateGorilla(gorilla, 0.016, nearPlayer(), eggs, true, random);
  updateGorilla(gorilla, 0.016, nearPlayer(), eggs, true, random);
  assert.equal(eggs.held, 4);
});

test(`${DANCE_EGGS} eggs in quick succession make her dance, then she stops`, () => {
  const { gorilla, eggs, random } = setup(5);
  const p = nearPlayer();
  for (let i = 0; i < DANCE_EGGS; i++) {
    assert.equal(gorilla.dancing, 0, `not dancing before egg ${i + 1}`);
    updateGorilla(gorilla, 0.016, p, eggs, true, random);
    wait(gorilla, 1, p, eggs, random);
  }
  assert.ok(gorilla.dancing > 0);
  assert.equal(gorilla.speech?.key, "dance", "she announces the dance");
  wait(gorilla, DANCE_DURATION, p, eggs, random);
  assert.equal(gorilla.dancing, 0);
});

test("eggs spread out over a long time do not trigger a dance", () => {
  const { gorilla, eggs, random } = setup(5);
  const p = nearPlayer();
  for (let i = 0; i < DANCE_EGGS + 1; i++) {
    updateGorilla(gorilla, 0.016, p, eggs, true, random);
    wait(gorilla, DANCE_WINDOW / 2 + 1, p, eggs, random);
  }
  assert.equal(gorilla.dancing, 0);
});

test("she talks after some gifts but not all", () => {
  let talked = 0, silent = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const g = createGorilla([10, 10, 0]);
    updateGorilla(g, 0.016, nearPlayer(), { held: 1 }, true, createRandom(seed));
    g.speech ? talked++ : silent++;
  }
  assert.ok(talked > 5 && silent > 5, `talked ${talked}, silent ${silent}`);
});

test("head turns toward a nearby player, within limits", () => {
  const { gorilla, eggs, random } = setup(0);
  wait(gorilla, 3, { x: 13, z: 10, radius: 0.5 }, eggs, random); // to her left (+x) while she faces +z
  assert.ok(gorilla.headYaw > 0.9 && gorilla.headYaw <= 1.0001, `headYaw ${gorilla.headYaw}`);
});
