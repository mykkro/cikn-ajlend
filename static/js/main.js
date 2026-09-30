import { AVATAR_IDS, createAvatarMeshes, drawAvatar, updateAvatar } from "./avatars.js";
import { createChickenMeshes, drawChicken, keepOnLand, spawnChickens, updateChicken } from "./chicken.js";
import { clampToBounds, resolveCollisions } from "./collision.js";
import { DAY_SECONDS, environmentAt, formatClock } from "./daynight.js";
import { createDolphinMeshes, drawDolphin, spawnDolphins, updateDolphin } from "./dolphins.js";
import { createEggGeometry, createEggState, drawEggs, updateEggs } from "./eggs.js";
import { createDepthProgram, createLitProgram, createMesh } from "./gl.js";
import { createGorilla, createGorillaMeshes, drawGorilla, isInReach, speechAnchor, speechText, updateGorilla } from "./gorilla.js";
import { onLanguageChange, t } from "./i18n.js";
import { createInput } from "./input.js";
import { createLanguageSwitcher } from "./langswitch.js";
import { createTouchControls, isTouchDevice } from "./touch.js";
import * as mat4 from "./mat4.js";
import { chooseAvatar, createPlayer, movePlayer, rollPlayer, settlePlayer } from "./player.js";
import { createAvatarPreviews } from "./preview.js";
import { createRandom } from "./random.js";
import { buildScenery } from "./scenery.js";
import { createShadowMap } from "./shadows.js";
import { createSky } from "./sky.js";
import { setSkyUniforms } from "./skycolor.js";
import { createSharkMeshes, createSharkState, drawShark, updateShark } from "./shark.js";
import { loadTerrain } from "./terrain.js";
import { createWater } from "./water.js";
import { SEA_LEVEL } from "./waves.js";

const KEY_TURN_SPEED = 2;      // radians per second
const MOUSE_SENSITIVITY = 0.0025;
const PITCH_MIN = -0.9, PITCH_MAX = 1.3; // below 0 the camera stays low and tilts the view up
const CAMERA_DISTANCE_MIN = 2, CAMERA_DISTANCE_MAX = 16;
const ZOOM_STEP = 1.15;       // distance multiplier per wheel notch
const CHICKEN_COUNT = 16;
const START_HOUR = 8;
const TIME_WARP = 40;         // clock speed-up while T is held
const FADE_RADIUS = 1.3;      // width of the see-through tunnel from the camera to the player

const canvas = document.getElementById("game");
const hud = document.getElementById("hud");
const scoreBox = document.getElementById("score");
const eggCount = document.getElementById("egg-count");
const points = document.getElementById("points");
const clockLabel = document.getElementById("clock");
const speech = document.getElementById("speech");
const prompt = document.getElementById("prompt");
const giveButton = document.getElementById("give-button");
const danger = document.getElementById("danger");
const gameOverPanel = document.getElementById("game-over");
const startScreen = document.getElementById("start");

createLanguageSwitcher(document.getElementById("lang"));
applyStaticText();
onLanguageChange(applyStaticText);

async function start() {
  const gl = canvas.getContext("webgl2", { antialias: true });
  if (!gl) throw new Error("WebGL2 is not supported in this browser");

  const params = new URLSearchParams(location.search);
  const seed = Number.parseInt(params.get("seed") ?? "1", 10) || 1;
  const startHour = Number.parseFloat(params.get("time") ?? "");
  const terrain = await loadTerrain(seed);
  const random = createRandom(seed);

  const lit = createLitProgram(gl);
  const depth = createDepthProgram(gl);
  const sky = createSky(gl);
  const shadowMap = createShadowMap(gl, isTouchDevice() ? 1024 : 2048); // lighter on phones
  const terrainMesh = createMesh(gl, terrain.geometry);
  const scenery = buildScenery(terrain.props, terrain, random);
  const sceneryMesh = createMesh(gl, scenery.geometry);
  const avatarMeshes = createAvatarMeshes(gl);
  const chickenMeshes = createChickenMeshes(gl);
  const eggMesh = createMesh(gl, createEggGeometry());
  const gorillaMeshes = createGorillaMeshes(gl);
  const dolphinMeshes = createDolphinMeshes(gl);
  const sharkMeshes = createSharkMeshes(gl);
  const water = createWater(gl, terrain);
  const input = createInput(canvas);

  const player = createPlayer(terrain.size / 2, terrain.size / 2);
  const gorilla = createGorilla(terrain.props.gorilla);
  scenery.obstacles.push(gorilla); // she never moves, so she is just another obstacle
  const chickens = spawnChickens(CHICKEN_COUNT, random, terrain, player, scenery.obstacles);
  const dolphins = spawnDolphins(random, terrain);
  const bodies = [player, ...chickens, ...dolphins];
  const sharkState = createSharkState();
  const eggs = createEggState(chickens, random);
  const camera = { yaw: 0, pitch: 0.4, distance: 7 };
  const settings = { fadeRadius: FADE_RADIUS };
  const clock = { hour: Number.isFinite(startHour) ? ((startHour % 24) + 24) % 24 : START_HOUR, elapsed: 0 };

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);

  function update(dt) {
    const mouse = input.takeLookDelta();
    const turn = (input.isDown("ArrowLeft") ? 1 : 0) - (input.isDown("ArrowRight") ? 1 : 0);
    const tilt = (input.isDown("ArrowDown") ? 1 : 0) - (input.isDown("ArrowUp") ? 1 : 0);
    camera.yaw += turn * KEY_TURN_SPEED * dt - mouse.x * MOUSE_SENSITIVITY;
    camera.pitch += tilt * KEY_TURN_SPEED * dt + mouse.y * MOUSE_SENSITIVITY;
    camera.pitch = Math.min(Math.max(camera.pitch, PITCH_MIN), PITCH_MAX);
    camera.distance *= input.takeZoom(ZOOM_STEP);
    camera.distance = Math.min(Math.max(camera.distance, CAMERA_DISTANCE_MIN), CAMERA_DISTANCE_MAX);

    const warp = input.isDown("KeyT") ? TIME_WARP : 1;
    clock.hour = (clock.hour + (dt * warp * 24) / DAY_SECONDS) % 24;
    clock.elapsed += dt;

    const move = sharkState.gameOver || !player.avatar ? { ahead: 0, strafe: 0 } : input.moveVector();
    movePlayer(player, move, camera.yaw, dt);
    for (const chicken of chickens) updateChicken(chicken, dt, player, terrain, random);
    for (const dolphin of dolphins) updateDolphin(dolphin, dt, player, terrain, random);
    resolveCollisions(bodies, scenery.obstacles);
    for (const body of bodies) clampToBounds(body, terrain.size);
    for (const chicken of chickens) keepOnLand(chicken, terrain); // pushed toward the sea: stay put
    settlePlayer(player, terrain, clock.elapsed);
    const sharkEvent = updateShark(sharkState, dt, player, terrain, random);
    if (sharkEvent === "appeared") showDanger(true);
    if (sharkEvent === "left") showDanger(false);
    if (sharkEvent === "ate") {
      showDanger(false);
      setTimeout(() => showGameOver(eggs), 1600); // let the bite play out first
    }
    if (player.avatar?.id === "ball") rollPlayer(player);
    updateAvatar(player, dt);
    if (updateEggs(eggs, dt, chickens, player, scenery.obstacles, terrain.size, random) > 0) showScore(eggs);
    const give = input.wasPressed("KeyE") && !sharkState.gameOver;
    if (updateGorilla(gorilla, dt, player, eggs, give, random)) showScore(eggs);
  }

  // Draws every mesh with whichever program is active (lit or depth-only).
  // `fade` makes whatever stands between the camera and the player see-through
  // (terrain and the player's own avatar are never faded).
  function drawScene(u, fade = 0) {
    gl.uniform1f(u.uFadeRadius, 0);
    gl.uniform3f(u.uTint, 1, 1, 1);
    gl.uniformMatrix4fv(u.uModel, false, mat4.identity());
    gl.uniform1f(u.uTileSize, terrain.tileSize);
    terrainMesh.draw();

    gl.uniform1f(u.uTileSize, 0);
    if (!sharkState.gameOver || sharkState.eatenFor < 0.05) drawAvatar(gl, u, avatarMeshes, player);

    gl.uniform1f(u.uFadeRadius, fade);
    gl.uniform3f(u.uTint, 1, 1, 1);
    gl.uniformMatrix4fv(u.uModel, false, mat4.identity()); // the avatar left its own transform set
    sceneryMesh.draw();

    for (const chicken of chickens) drawChicken(gl, u, chickenMeshes, chicken, terrain);
    drawEggs(gl, u, eggMesh, eggs, terrain);
    drawGorilla(gl, u, gorillaMeshes, gorilla, terrain);
    for (const dolphin of dolphins) drawDolphin(gl, u, dolphinMeshes, dolphin, clock.elapsed);
    drawShark(gl, u, sharkMeshes, sharkState, clock.elapsed);
  }

  function render() {
    const env = environmentAt(clock.hour);
    const playerY = player.y;

    // Shadow pass: depth from the sun (or moon) around the player.
    const lightViewProj = shadowMap.matrixFor(env.lightDir, [player.x, playerY + 0.5, player.z]);
    if (env.shadowStrength > 0) {
      shadowMap.begin();
      gl.useProgram(depth.program);
      gl.uniformMatrix4fv(depth.uniforms.uViewProj, false, lightViewProj);
      drawScene(depth.uniforms);
      shadowMap.end();
    }

    resize(gl);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const target = [player.x, playerY + 1.3, player.z];
    const orbitPitch = Math.max(camera.pitch, 0);
    const flat = Math.cos(orbitPitch) * camera.distance;
    const eye = [
      target[0] - Math.sin(camera.yaw) * flat,
      target[1] + Math.sin(orbitPitch) * camera.distance,
      target[2] - Math.cos(camera.yaw) * flat,
    ];
    eye[1] = Math.max(eye[1], terrain.heightAt(eye[0], eye[2]) + 0.4, SEA_LEVEL + 0.5);
    const look = lookTarget(eye, target, camera.pitch);
    const projection = mat4.perspective(Math.PI / 3, canvas.width / canvas.height, 0.1, 300);
    const viewProj = mat4.multiply(projection, mat4.lookAt(eye, look, [0, 1, 0]));

    sky.draw(viewProj, env, clock.elapsed);

    const u = lit.uniforms;
    gl.useProgram(lit.program);
    gl.uniformMatrix4fv(u.uViewProj, false, viewProj);
    gl.uniformMatrix4fv(u.uLightViewProj, false, lightViewProj);
    gl.uniform3fv(u.uLightDir, env.lightDir);
    gl.uniform3fv(u.uLightColor, env.lightColor);
    gl.uniform3fv(u.uAmbientSky, env.ambientSky);
    gl.uniform3fv(u.uAmbientGround, env.ambientGround);
    gl.uniform3fv(u.uCameraPos, eye);
    const fogRange = [terrain.size * 0.35, terrain.size * 1.1];
    gl.uniform2fv(u.uFogRange, fogRange);
    gl.uniform1f(u.uShadowStrength, env.shadowStrength);
    gl.uniform1f(u.uShadowTexel, shadowMap.texelSize);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, shadowMap.texture);
    gl.uniform1i(u.uShadowMap, 0);
    setSkyUniforms(gl, u, env);
    gl.uniform3fv(u.uFadeFrom, eye);
    gl.uniform3f(u.uFadeTo, player.x, playerY + 0.6, player.z);
    drawScene(u, player.avatar ? settings.fadeRadius : 0);
    water.draw(viewProj, env, eye, clock.elapsed, fogRange);

    showGorillaUi(gorilla, player, eggs, viewProj, terrain, touch.enabled);

    if (previews && !startScreen.hidden) previews.draw(frameDt);

    const clockText = `${env.day > 0.5 ? "☀" : "☾"} ${formatClock(clock.hour)}`;
    if (clockLabel.textContent !== clockText) clockLabel.textContent = clockText;
  }

  let frameDt = 0;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    frameDt = dt;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  let touch = { enabled: false };
  const showHelp = () => {
    hud.textContent = touch.enabled ? t("helpTouch") : t("help", { seed });
  };
  touch = createTouchControls(canvas, input, {
    stick: document.getElementById("stick"),
    knob: document.querySelector("#stick .knob"),
    give: giveButton,
    time: document.getElementById("time-button"),
  }, () => showHelp()); // switches the help text when the first touch arrives
  showHelp();
  onLanguageChange(showHelp);

  // Start screen: pick an avatar, then play.
  const previews = createStartScreen(gl, lit, avatarMeshes, (id) => {
    chooseAvatar(player, id);
    startScreen.hidden = true;
    canvas.focus();
  });

  // Hook for automated checks.
  window.__game = { player, chickens, camera, obstacles: scenery.obstacles, eggs, clock, gorilla, dolphins, terrain, sharkState, settings, choose: (id) => startScreen.querySelector(`[data-id="${id}"]`).click() };
}

// Point the camera at the player, tilted further up by however far pitch is below zero
// (so you can look up at the sky).
function lookTarget(eye, target, pitch) {
  if (pitch >= 0) return target;
  const dx = target[0] - eye[0], dy = target[1] - eye[1], dz = target[2] - eye[2];
  const across = Math.hypot(dx, dz);
  const elevation = Math.min(Math.atan2(dy, across) - pitch, 1.4);
  return [eye[0] + dx, eye[1] + Math.tan(elevation) * across, eye[2] + dz];
}

// Speech bubble above the gorilla's head and the "press E" prompt near her.
function showGorillaUi(gorilla, player, eggs, viewProj, terrain, touchMode) {
  const text = speechText(gorilla);
  const [x, y, z] = speechAnchor(gorilla, terrain);
  const clip = [0, 1, 2, 3].map((r) => viewProj[r] * x + viewProj[4 + r] * y + viewProj[8 + r] * z + viewProj[12 + r]);
  const onScreen = clip[3] > 0.1 && Math.abs(clip[0] / clip[3]) < 1.1 && Math.abs(clip[1] / clip[3]) < 1.1;
  const nearby = Math.hypot(player.x - gorilla.x, player.z - gorilla.z) < 25;
  if (text && onScreen && nearby) {
    if (speech.textContent !== text) speech.textContent = text;
    speech.style.left = `${((clip[0] / clip[3]) * 0.5 + 0.5) * canvas.clientWidth}px`;
    // Keep the bubble (anchored at its bottom edge) clear of the score bar at the top.
    speech.style.top = `${Math.max((0.5 - (clip[1] / clip[3]) * 0.5) * canvas.clientHeight, 150)}px`;
    speech.hidden = false;
  } else {
    speech.hidden = true;
  }

  const hint = !isInReach(gorilla, player) ? ""
    : eggs.held > 0 ? t(touchMode ? "promptGiveTouch" : "promptGive", { count: eggs.held })
    : t("promptNoEggs");
  if (prompt.textContent !== hint) prompt.textContent = hint;
  prompt.hidden = !hint;
  giveButton.hidden = !(touchMode && isInReach(gorilla, player));
}

// Text that does not change during play: tooltips, page language, loading message.
function applyStaticText() {
  document.documentElement.lang = document.getElementById("lang").querySelector("[aria-pressed=true]")?.lang ?? "en";
  scoreBox.children[0].title = t("eggsTitle");
  scoreBox.children[1].title = t("scoreTitle");
  clockLabel.title = t("clockTitle");
  danger.textContent = t("danger");
  fillGameOver();
  giveButton.setAttribute("aria-label", t("giveButton"));
  giveButton.title = t("giveButton");
  const timeButton = document.getElementById("time-button");
  timeButton.setAttribute("aria-label", t("timeButton"));
  timeButton.title = t("timeButton");
  if (!window.__game) hud.textContent = t("loading");
}

const AVATAR_KEY = "morbo.avatar";

// Builds the avatar cards with live previews; `onChoose(id)` starts the game.
function createStartScreen(gl, lit, meshes, onChoose) {
  let last = "ball";
  try {
    last = localStorage.getItem(AVATAR_KEY) ?? last;
  } catch {
    // No storage: default to the ball.
  }
  const cards = startScreen.querySelector(".cards");
  const canvases = AVATAR_IDS.map((id, i) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card";
    card.dataset.id = id;
    card.innerHTML = `<canvas></canvas><span class="name"></span><span class="key">${i + 1}</span>`;
    card.addEventListener("click", () => {
      try {
        localStorage.setItem(AVATAR_KEY, id);
      } catch {
        // Not remembered; fine.
      }
      window.removeEventListener("keydown", numberKeys);
      onChoose(id);
    });
    cards.append(card);
    return { id, canvas: card.querySelector("canvas") };
  });
  const numberKeys = (e) => {
    const index = Number(e.key) - 1;
    if (!startScreen.hidden && AVATAR_IDS[index]) cards.children[index].click();
  };
  window.addEventListener("keydown", numberKeys);
  const label = () => {
    startScreen.querySelector("h1").textContent = t("chooseTitle");
    startScreen.querySelector(".note").textContent = t("chooseNote");
    for (const card of cards.children) card.querySelector(".name").textContent = t(`avatar_${card.dataset.id}`);
  };
  label();
  onLanguageChange(label);
  startScreen.hidden = false;
  (cards.querySelector(`[data-id="${last}"]`) ?? cards.firstElementChild).focus();
  return createAvatarPreviews(gl, lit, meshes, canvases);
}

function showDanger(on) {
  danger.hidden = !on;
  document.body.classList.toggle("danger", on);
}

function showGameOver(eggs) {
  document.exitPointerLock?.();
  gameOverPanel.dataset.eggs = eggs.collected;
  gameOverPanel.dataset.score = eggs.score;
  fillGameOver();
  gameOverPanel.hidden = false;
  gameOverPanel.querySelector("button").focus();
}

function fillGameOver() {
  gameOverPanel.querySelector("h1").textContent = t("gameOverTitle");
  gameOverPanel.querySelector(".text").textContent = t("gameOverText");
  gameOverPanel.querySelector(".stats").textContent =
    t("gameOverStats", { eggs: gameOverPanel.dataset.eggs ?? 0, score: gameOverPanel.dataset.score ?? 0 });
  gameOverPanel.querySelector("button").textContent = t("playAgain");
}

function showScore(eggs) {
  eggCount.textContent = eggs.held;
  points.textContent = eggs.score;
  // Restart the bump animation.
  scoreBox.classList.remove("bump");
  void scoreBox.offsetWidth;
  scoreBox.classList.add("bump");
}

function resize(gl) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2); // sharper than 2x costs a lot on phones
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  gl.viewport(0, 0, w, h);
}

start().catch((err) => {
  hud.textContent = t("error", { message: err.message });
  console.error(err);
});
