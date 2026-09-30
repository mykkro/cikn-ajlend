// The wise young gorilla: sits under her tree, accepts eggs, talks, and dances when spoiled.
// Model space: origin on the ground under her hips, +z forward, +y up.

import { createMesh } from "./gl.js";
import { line, lineCount } from "./i18n.js";
import * as mat4 from "./mat4.js";
import { ellipsoid, merge } from "./shapes.js";

export const GORILLA_RADIUS = 1.05;   // mirrors GORILLA_RADIUS in props.py
export const GIVE_RANGE = 1.6;        // reach, measured from the edge of her footprint
export const DANCE_EGGS = 3;          // eggs within DANCE_WINDOW seconds start a dance
export const DANCE_WINDOW = 15;
export const DANCE_DURATION = 6;
const SCALE = 1.1;                    // ~2.2 units tall sitting, over twice the ball
const EAT_DURATION = 1.5;
const GIVE_COOLDOWN = 0.6;
const SPEECH_DURATION = 4.5;
const GREET_RANGE = 5;
const GREET_COOLDOWN = 25;
const HEAD_TURN_LIMIT = 1.0;
const TALK_CHANCE = 0.6;              // share of gifts she comments on

const FUR = [0.075, 0.07, 0.08];
const FUR_DARK = [0.045, 0.04, 0.05];
const SKIN = [0.19, 0.165, 0.17];
const EYE = [0.2, 0.1, 0.04];
const EYE_SHINE = [0.9, 0.9, 0.9];

const NECK = [0, 1.45, 0.12];
const SHOULDER = [0.55, 1.25, 0.05]; // x mirrored for the left arm
const HEAD_TOP = 1.95;               // model units, for placing the speech bubble

const X_AXIS = [1, 0, 0], Y_AXIS = [0, 1, 0], Z_AXIS = [0, 0, 1];

// Her lines live in i18n.js (thanks, wisdom, emptyHanded, greetings, dance).

export function createGorilla([x, z, heading]) {
  return {
    x, z, heading,
    radius: GORILLA_RADIUS,
    time: 0,
    headYaw: 0,
    eating: 0,          // seconds left in the eating animation
    dancing: 0,         // seconds left in the dance
    cooldown: 0,
    gifts: [],          // times of recent gifts, for the dance trigger
    eggsEaten: 0,
    speech: null,       // { key, index, left }: which line she is saying
    greetCooldown: 0,
    playerNear: false,
  };
}

export function isInReach(gorilla, player) {
  return Math.hypot(player.x - gorilla.x, player.z - gorilla.z) < gorilla.radius + player.radius + GIVE_RANGE;
}

// Picks a random line from a list; the text is looked up at display time,
// so a bubble already showing follows a language switch.
function say(gorilla, key, random) {
  gorilla.speech = { key, index: Math.floor(random() * lineCount(key)), left: SPEECH_DURATION };
}

export function speechText(gorilla) {
  return gorilla.speech ? line(gorilla.speech.key, gorilla.speech.index) : "";
}

// `give` is true on the frame the player presses the give key.
// Returns true if an egg changed hands.
export function updateGorilla(gorilla, dt, player, eggs, give, random) {
  gorilla.time += dt;
  gorilla.eating = Math.max(gorilla.eating - dt, 0);
  gorilla.dancing = Math.max(gorilla.dancing - dt, 0);
  gorilla.cooldown = Math.max(gorilla.cooldown - dt, 0);
  gorilla.greetCooldown = Math.max(gorilla.greetCooldown - dt, 0);
  if (gorilla.speech && (gorilla.speech.left -= dt) <= 0) gorilla.speech = null;

  // Turn her head toward the player when close, otherwise look ahead.
  const dx = player.x - gorilla.x, dz = player.z - gorilla.z;
  const distance = Math.hypot(dx, dz);
  const wanted = distance < GREET_RANGE * 2
    ? clamp(wrapAngle(Math.atan2(dx, dz) - gorilla.heading), -HEAD_TURN_LIMIT, HEAD_TURN_LIMIT)
    : 0;
  gorilla.headYaw += (wanted - gorilla.headYaw) * Math.min(dt * 3, 1);

  const near = distance < GREET_RANGE;
  if (near && !gorilla.playerNear && gorilla.greetCooldown === 0 && !gorilla.speech && random() < 0.5) {
    say(gorilla, "greetings", random);
    gorilla.greetCooldown = GREET_COOLDOWN;
  }
  gorilla.playerNear = near;

  if (!give || !isInReach(gorilla, player) || gorilla.cooldown > 0) return false;
  gorilla.cooldown = GIVE_COOLDOWN;
  if (eggs.held <= 0) {
    say(gorilla, "emptyHanded", random);
    return false;
  }

  eggs.held -= 1;
  gorilla.eggsEaten += 1;
  gorilla.eating = EAT_DURATION;
  gorilla.gifts = gorilla.gifts.filter((t) => gorilla.time - t < DANCE_WINDOW);
  gorilla.gifts.push(gorilla.time);

  if (gorilla.gifts.length >= DANCE_EGGS && gorilla.dancing === 0) {
    gorilla.gifts = [];
    gorilla.dancing = DANCE_DURATION;
    say(gorilla, "dance", random);
  } else if (random() < TALK_CHANCE) {
    say(gorilla, random() < 0.5 ? "thanks" : "wisdom", random);
  }
  return true;
}

export function createGorillaMeshes(gl) {
  return {
    body: createMesh(gl, merge(
      ellipsoid([0, 0.34, -0.1], [0.5, 0.33, 0.42], FUR),           // hips
      ellipsoid([0, 0.93, 0], [0.49, 0.56, 0.39], FUR),              // torso
      ellipsoid([0, 0.93, 0.28], [0.3, 0.34, 0.13], SKIN),           // chest
      ellipsoid([0, 1.02, -0.18], [0.44, 0.4, 0.25], FUR_DARK),      // back
      ellipsoid([0.28, 0.3, 0.35], [0.19, 0.19, 0.38], FUR),         // thighs
      ellipsoid([-0.28, 0.3, 0.35], [0.19, 0.19, 0.38], FUR),
      ellipsoid([0.32, 0.12, 0.72], [0.2, 0.13, 0.22], SKIN),        // feet
      ellipsoid([-0.32, 0.12, 0.72], [0.2, 0.13, 0.22], SKIN),
    )),
    head: createMesh(gl, merge( // relative to NECK
      ellipsoid([0, 0.2, 0.05], [0.29, 0.3, 0.28], FUR),
      ellipsoid([0, 0.4, -0.02], [0.1, 0.08, 0.12], FUR),            // small crest
      ellipsoid([0, 0.15, 0.2], [0.21, 0.22, 0.12], SKIN),           // face
      ellipsoid([0, 0.03, 0.27], [0.17, 0.11, 0.1], SKIN),           // muzzle
      ellipsoid([0, 0.27, 0.26], [0.23, 0.05, 0.07], FUR_DARK),      // brow ridge
      ellipsoid([0.08, 0.19, 0.3], [0.038, 0.032, 0.02], EYE),       // big young eyes
      ellipsoid([-0.08, 0.19, 0.3], [0.038, 0.032, 0.02], EYE),
      ellipsoid([0.09, 0.2, 0.318], [0.009, 0.009, 0.005], EYE_SHINE),
      ellipsoid([-0.07, 0.2, 0.318], [0.009, 0.009, 0.005], EYE_SHINE),
      ellipsoid([0.04, 0.07, 0.36], [0.025, 0.015, 0.01], FUR_DARK), // nostrils
      ellipsoid([-0.04, 0.07, 0.36], [0.025, 0.015, 0.01], FUR_DARK),
    )),
    arm: createMesh(gl, merge( // relative to SHOULDER, hanging down to the knee
      ellipsoid([0, -0.28, 0.05], [0.15, 0.34, 0.15], FUR),
      ellipsoid([0, -0.7, 0.18], [0.13, 0.3, 0.13], FUR),
      ellipsoid([0, -0.98, 0.25], [0.13, 0.1, 0.15], SKIN),          // hand
    )),
  };
}

export function drawGorilla(gl, uniforms, meshes, gorilla, terrain) {
  const t = gorilla.time;
  const dance = gorilla.dancing > 0 ? Math.min(gorilla.dancing, 1, DANCE_DURATION - gorilla.dancing + 0.001) : 0;
  const breathe = Math.sin(t * 1.4) * 0.015;
  const hop = Math.abs(Math.sin(t * 7)) * 0.3 * dance;
  const sway = Math.sin(t * 3.5) * 0.35 * dance;

  const base = chain(
    mat4.translation(gorilla.x, terrain.heightAt(gorilla.x, gorilla.z) + breathe + hop, gorilla.z),
    mat4.rotationAxis(Y_AXIS, gorilla.heading + sway),
    mat4.rotationAxis(Z_AXIS, Math.sin(t * 7) * 0.12 * dance),
    mat4.scaling(SCALE),
  );
  const draw = (mesh, model) => {
    gl.uniformMatrix4fv(uniforms.uModel, false, model);
    mesh.draw();
  };

  gl.uniform3f(uniforms.uTint, 1, 1, 1);
  draw(meshes.body, base);

  // Eating: right hand comes up to the mouth and the head tips forward to meet it.
  const eat = gorilla.eating > 0 ? Math.sin((gorilla.eating / EAT_DURATION) * Math.PI) : 0;
  const nod = eat * 0.25 + Math.sin(t * 7) * 0.15 * dance;
  // A curious head tilt while she watches you, plus a slow idle sway.
  const curious = Math.min(Math.abs(gorilla.headYaw) * 2, 1) * 0.22 * Math.sign(gorilla.headYaw);
  draw(meshes.head, chain(base, mat4.translation(...NECK),
    mat4.rotationAxis(Y_AXIS, gorilla.headYaw * (1 - dance)),
    mat4.rotationAxis(Z_AXIS, (curious + Math.sin(t * 0.8) * 0.05) * (1 - dance)),
    mat4.rotationAxis(X_AXIS, nod)));

  for (const side of [1, -1]) {
    // Resting arms tilt slightly forward onto the knees.
    let raise = -0.25;
    let spread = 0;
    if (dance > 0) {
      raise = -2.6 * (0.5 + 0.5 * Math.sin(t * 7 + (side > 0 ? 0 : Math.PI))) * dance - 0.25 * (1 - dance);
      spread = 0.35 * dance;
    } else if (side < 0) {
      raise = -0.25 - 1.5 * eat;          // right arm (x < 0) feeds
      spread = 0.55 * eat;                // raised arm tilts inward, hand in front of the mouth
    }
    const shoulder = mat4.translation(SHOULDER[0] * side, SHOULDER[1], SHOULDER[2]);
    draw(meshes.arm, chain(base, shoulder, mat4.rotationAxis(Z_AXIS, spread * side), mat4.rotationAxis(X_AXIS, raise)));
  }
}

// World position above her head, for placing the speech bubble.
export function speechAnchor(gorilla, terrain) {
  return [gorilla.x, terrain.heightAt(gorilla.x, gorilla.z) + HEAD_TOP * SCALE + 0.35, gorilla.z];
}

function chain(...matrices) {
  return matrices.reduce((acc, m) => mat4.multiply(acc, m));
}

function wrapAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi);
}
