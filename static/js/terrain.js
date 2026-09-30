// Turns the server heightmap into a mesh and answers height queries.

const GRASS = [0.36, 0.62, 0.27];
const MEADOW = [0.55, 0.62, 0.30];
const ROCK = [0.52, 0.47, 0.42];
const SAND = [0.87, 0.8, 0.6];
const WET_SAND = [0.66, 0.6, 0.45];
const SEABED = [0.42, 0.45, 0.38];

export async function loadTerrain(seed) {
  const response = await fetch(`/api/terrain?seed=${seed}`);
  if (!response.ok) throw new Error(`terrain request failed: ${response.status}`);
  return createTerrain(await response.json());
}

export function createTerrain(data) {
  const n = data.tiles * data.segments + 1;
  const cell = data.tileSize / data.segments;
  const size = data.tiles * data.tileSize;
  const heights = data.heights;
  const maxHeight = Math.max(...heights) || 1;

  const h = (col, row) => {
    col = Math.min(Math.max(col, 0), n - 1);
    row = Math.min(Math.max(row, 0), n - 1);
    return heights[row * n + col];
  };

  const positions = new Float32Array(n * n * 3);
  const normals = new Float32Array(n * n * 3);
  const colors = new Float32Array(n * n * 3);
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const i = (row * n + col) * 3;
      const y = h(col, row);
      positions.set([col * cell, y, row * cell], i);

      const nx = h(col - 1, row) - h(col + 1, row);
      const nz = h(col, row - 1) - h(col, row + 1);
      const ny = 2 * cell;
      const len = Math.hypot(nx, ny, nz);
      normals.set([nx / len, ny / len, nz / len], i);

      const steepness = 1 - ny / len;
      let color = mix(GRASS, MEADOW, smoothstep(0.35, 0.8, y / maxHeight));
      color = mix(color, ROCK, smoothstep(0.25, 0.45, steepness));
      // Beach sand near the waterline, darker and wet below it, then seabed.
      color = mix(SAND, color, smoothstep(0.55, 0.9, y));
      color = mix(WET_SAND, color, smoothstep(-0.15, 0.1, y));
      color = mix(SEABED, color, smoothstep(-2.2, -0.8, y));
      colors.set(color, i);
    }
  }

  const cells = n - 1;
  const indices = new Uint32Array(cells * cells * 6);
  let k = 0;
  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < cells; col++) {
      const a = row * n + col, b = a + 1, c = a + n, d = c + 1;
      indices.set([a, c, b, b, c, d], k);
      k += 6;
    }
  }

  // Bilinear interpolation of the heightmap at world position (x, z).
  function heightAt(x, z) {
    const gx = Math.min(Math.max(x / cell, 0), cells);
    const gz = Math.min(Math.max(z / cell, 0), cells);
    const col = Math.min(Math.floor(gx), cells - 1);
    const row = Math.min(Math.floor(gz), cells - 1);
    const fx = gx - col, fz = gz - row;
    const near = h(col, row) + (h(col + 1, row) - h(col, row)) * fx;
    const far = h(col, row + 1) + (h(col + 1, row + 1) - h(col, row + 1)) * fx;
    return near + (far - near) * fz;
  }

  return {
    size,
    tileSize: data.tileSize,
    props: data.props,
    geometry: { positions, normals, colors, indices },
    heightAt,
  };
}

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function smoothstep(lo, hi, v) {
  const t = Math.min(Math.max((v - lo) / (hi - lo), 0), 1);
  return t * t * (3 - 2 * t);
}
