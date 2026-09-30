"""Procedural heightmap generation for the tile-based terrain: a hilly island in the sea."""

import math
from dataclasses import dataclass

SEA_LEVEL = 0.0    # water surface height; mirrored in water.js
SEABED = -3.0      # depth of the open sea floor
BEACH = 0.5        # how far the flattest land rises above the sea


@dataclass(frozen=True)
class Terrain:
    seed: int
    tiles: int  # tiles along each edge of the square map
    tile_size: float  # world units per tile edge
    segments: int  # grid cells per tile edge
    heights: list[float]  # row-major along z, (tiles * segments + 1) ** 2 values

    @property
    def vertices_per_side(self) -> int:
        return self.tiles * self.segments + 1

    @property
    def size(self) -> float:
        return self.tiles * self.tile_size

    def _grid(self, col: int, row: int) -> float:
        n = self.vertices_per_side
        col = min(max(col, 0), n - 1)
        row = min(max(row, 0), n - 1)
        return self.heights[row * n + col]

    def height_at(self, x: float, z: float) -> float:
        """Bilinearly interpolated height at world position (x, z)."""
        cells = self.vertices_per_side - 1
        cell = self.tile_size / self.segments
        gx = min(max(x / cell, 0.0), cells)
        gz = min(max(z / cell, 0.0), cells)
        col = min(int(gx), cells - 1)
        row = min(int(gz), cells - 1)
        fx, fz = gx - col, gz - row
        near = self._grid(col, row) + (self._grid(col + 1, row) - self._grid(col, row)) * fx
        far = self._grid(col, row + 1) + (self._grid(col + 1, row + 1) - self._grid(col, row + 1)) * fx
        return near + (far - near) * fz

    def slope_at(self, x: float, z: float) -> float:
        """Steepness as rise over run (0 is flat, 1 is 45 degrees)."""
        d = self.tile_size / self.segments
        gx = (self.height_at(x + d, z) - self.height_at(x - d, z)) / (2 * d)
        gz = (self.height_at(x, z + d) - self.height_at(x, z - d)) / (2 * d)
        return math.hypot(gx, gz)

    def to_dict(self) -> dict:
        return {
            "seed": self.seed,
            "tiles": self.tiles,
            "tileSize": self.tile_size,
            "segments": self.segments,
            "heights": self.heights,
        }


def _hash(ix: int, iz: int, seed: int) -> float:
    """Deterministic pseudo-random value in [0, 1] for a lattice point."""
    h = (ix * 374761393 + iz * 668265263 + seed * 2147483647) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    h ^= h >> 16
    return h / 0xFFFFFFFF


def _smoothstep(t: float) -> float:
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def value_noise(x: float, z: float, seed: int) -> float:
    ix, iz = math.floor(x), math.floor(z)
    fx, fz = _smoothstep(x - ix), _smoothstep(z - iz)
    a = _hash(ix, iz, seed)
    b = _hash(ix + 1, iz, seed)
    c = _hash(ix, iz + 1, seed)
    d = _hash(ix + 1, iz + 1, seed)
    near = a + (b - a) * fx
    far = c + (d - c) * fx
    return near + (far - near) * fz


def fbm(x: float, z: float, seed: int, octaves: int = 4) -> float:
    """Fractal sum of value noise octaves, normalized to [0, 1]."""
    total, amplitude, frequency, norm = 0.0, 1.0, 1.0, 0.0
    for octave in range(octaves):
        total += value_noise(x * frequency, z * frequency, seed + octave * 1013) * amplitude
        norm += amplitude
        amplitude *= 0.5
        frequency *= 2.0
    return total / norm


def generate_terrain(
    seed: int = 1,
    tiles: int = 32,
    tile_size: float = 4.0,
    segments: int = 8,
    max_height: float = 6.0,
    feature_size: float = 14.0,
    island_radius: float = 34.5,
) -> Terrain:
    """Build an island heightmap: hills up to max_height + BEACH in the middle,
    sloping beaches, and SEABED-deep sea toward the map edges.

    feature_size is roughly the world-space width of a hill; island_radius is the
    typical distance of the coast from the centre in world units (the rest of the
    map is open sea). Small maps shrink the island to fit.
    """
    n = tiles * segments + 1
    cell = tile_size / segments
    raw = [
        fbm(col * cell / feature_size, row * cell / feature_size, seed)
        for row in range(n)
        for col in range(n)
    ]
    lo, hi = min(raw), max(raw)
    span = (hi - lo) or 1.0
    # The exponent flattens valleys into plains while keeping hilltops rounded.
    land = [((v - lo) / span) ** 1.6 * max_height for v in raw]

    # Island mask: 1 inland, 0 out at sea, with a noisy, wobbly coastline.
    half = n // 2 * cell
    radius = min(island_radius, half * 0.72)
    wobble = radius * 0.49     # how far the coastline wanders in and out
    shore = radius * 0.33      # width of the beach slope from land to open sea
    heights = []
    for row in range(n):
        for col in range(n):
            x, z = col * cell, row * cell
            dist = math.hypot(x - half, z - half)
            coast = radius + (fbm(x / 25, z / 25, seed + 900, octaves=3) - 0.5) * wobble
            inland = 1 - _smoothstep((dist - coast + shore / 2) / shore)
            h = SEABED + (land[row * n + col] + BEACH - SEABED) * inland
            heights.append(round(h, 3))
    return Terrain(seed=seed, tiles=tiles, tile_size=tile_size, segments=segments, heights=heights)
