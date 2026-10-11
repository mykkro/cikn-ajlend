// WebGL2 plumbing: shader programs and indexed meshes.

import { SKY_GLSL, SKY_UNIFORMS } from "./skycolor.js";

const LIT_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec3 aColor;
uniform mat4 uModel;
uniform mat4 uViewProj;
uniform mat4 uLightViewProj;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vColor;
out vec4 vShadowPos;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(uModel) * aNormal);
  vColor = aColor;
  // Look the shadow up slightly off the surface to avoid self-shadowing acne.
  vShadowPos = uLightViewProj * vec4(world.xyz + vNormal * 0.05, 1.0);
  gl_Position = uViewProj * world;
}`;

const LIT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vColor;
in vec4 vShadowPos;
uniform vec3 uLightDir;        // unit vector toward the sun or moon
uniform vec3 uLightColor;
uniform vec3 uAmbientSky;
uniform vec3 uAmbientGround;
uniform vec3 uCameraPos;
uniform vec2 uFogRange;
uniform float uTileSize;       // > 0 draws tile grid lines on the xz plane
uniform vec3 uTint;            // multiplies the vertex colors
uniform sampler2DShadow uShadowMap;
uniform float uShadowTexel;
uniform float uShadowStrength; // 0 disables shadows
uniform vec3 uFadeFrom;        // camera position
uniform vec3 uFadeTo;          // the player: things in between turn see-through
uniform float uFadeRadius;     // 0 disables the fade (terrain, the player's own avatar)
${SKY_GLSL}
out vec4 outColor;

float shadowFactor() {
  if (uShadowStrength <= 0.0) return 1.0;
  vec3 p = vShadowPos.xyz / vShadowPos.w * 0.5 + 0.5;
  if (p.x <= 0.0 || p.x >= 1.0 || p.y <= 0.0 || p.y >= 1.0 || p.z >= 1.0) return 1.0;
  float lit = 0.0;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      lit += texture(uShadowMap, vec3(p.xy + vec2(x, y) * uShadowTexel * 1.5, p.z - 0.0005));
    }
  }
  lit /= 9.0;
  // Fade out toward the edge of the shadow map so its border never shows.
  vec2 edge = min(p.xy, 1.0 - p.xy);
  float fade = smoothstep(0.0, 0.1, min(edge.x, edge.y));
  return mix(1.0, lit, fade * uShadowStrength);
}

// Ordered 4x4 dither threshold for this pixel, in (0, 1).
float bayer4(vec2 fragCoord) {
  const float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0,
                                3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  ivec2 p = ivec2(mod(floor(fragCoord), 4.0));
  return (m[p.x + p.y * 4] + 0.5) / 16.0;
}

// How see-through this fragment should be: 0 = solid, up to 0.8 inside a tunnel
// from the camera to the player (wider toward the player), soft at its edge.
float occluderFade() {
  if (uFadeRadius <= 0.0) return 0.0;
  vec3 seg = uFadeTo - uFadeFrom;
  float along = dot(vWorld - uFadeFrom, seg) / dot(seg, seg);
  if (along <= 0.0 || along >= 1.0) return 0.0;
  float radius = uFadeRadius * mix(0.6, 1.0, along);
  float off = length(vWorld - (uFadeFrom + seg * along));
  return 0.8 * (1.0 - smoothstep(radius * 0.55, radius, off)) * (1.0 - smoothstep(0.9, 1.0, along));
}

void main() {
  // Screen-door transparency: drop a dithered share of pixels that block the view.
  if (occluderFade() > bayer4(gl_FragCoord.xy)) discard;
  vec3 n = normalize(vNormal);
  vec3 ambient = mix(uAmbientGround, uAmbientSky, n.y * 0.5 + 0.5);
  vec3 direct = uLightColor * max(dot(n, uLightDir), 0.0) * shadowFactor();
  vec3 color = vColor * uTint * (ambient + direct);
  if (uTileSize > 0.0) {
    vec2 p = vWorld.xz / uTileSize;
    vec2 dist = abs(fract(p - 0.5) - 0.5) / fwidth(p);
    float line = 1.0 - clamp(min(dist.x, dist.y), 0.0, 1.0);
    line *= smoothstep(-0.3, 0.3, vWorld.y); // no grid on the seabed
    color *= 1.0 - 0.25 * line;
  }
  vec3 view = vWorld - uCameraPos;
  vec3 fogColor = skyColor(normalize(vec3(view.x, 0.03 * length(view.xz), view.z)));
  float fog = smoothstep(uFogRange.x, uFogRange.y, length(view));
  outColor = vec4(mix(color, fogColor, fog), 1.0);
}`;

// Writes depth only, for the shadow map.
const DEPTH_FRAGMENT_SHADER = `#version 300 es
precision mediump float;
void main() {}`;

// Every mesh draw sets these, so both lit and depth programs expose them
// (a name the program lacks resolves to null, which WebGL ignores).
const SCENE_UNIFORMS = [
  "uModel", "uViewProj", "uLightViewProj", "uLightDir", "uLightColor", "uAmbientSky", "uAmbientGround",
  "uCameraPos", "uFogRange", "uTileSize", "uTint", "uShadowMap", "uShadowTexel", "uShadowStrength",
  "uFadeFrom", "uFadeTo", "uFadeRadius",
  ...SKY_UNIFORMS,
];

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

export function createProgram(gl, vertexSource, fragmentSource, uniformNames) {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }
  const uniforms = {};
  for (const name of uniformNames) uniforms[name] = gl.getUniformLocation(program, name);
  return { program, uniforms };
}

export function createLitProgram(gl) {
  return createProgram(gl, LIT_VERTEX_SHADER, LIT_FRAGMENT_SHADER, SCENE_UNIFORMS);
}

export function createDepthProgram(gl) {
  return createProgram(gl, LIT_VERTEX_SHADER, DEPTH_FRAGMENT_SHADER, SCENE_UNIFORMS);
}

// geometry: { positions, normals, colors: Float32Array (xyz / rgb per vertex), indices: Uint32Array }
export function createMesh(gl, geometry) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  [geometry.positions, geometry.normals, geometry.colors].forEach((data, location) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0);
  });
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  const count = geometry.indices.length;
  return {
    draw() {
      gl.bindVertexArray(vao);
      gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_INT, 0);
    },
  };
}
