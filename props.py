"""Scatters scenery (trees, rocks, bushes, grass) over a terrain.

Each prop is a compact list so the JSON payload stays small:
  trees:  [x, z, scale, rotation, variant]   variant 0 = round leafy, 1 = pine
  rocks:  [x, z, scale, rotation, variant]   variant 0..ROCK_VARIANTS-1
  bushes: [x, z, scale, rotation]
  grass:  [x, z, scale, rotation]
  gorilla: [x, z, heading, tree index]   the one (young, female) gorilla, sitting against a big round tree
Trees and rocks are solid; their footprint radius at scale 1 is in SOLID_RADIUS.
"""

import math
import random

from terrain import SEA_LEVEL, Terrain, fbm

ROCK_VARIANTS = 4
SPAWN_CLEARANCE = 3.5  # keep the map centre (player spawn) free of solid props
SOLID_RADIUS = {"trees": 0.3, "rocks": 0.5}
GORILLA_RADIUS = 1.05      # footprint of the sitting gorilla; mirrored in gorilla.js
GORILLA_TREE_SCALE = 1.7   # her tree is made at least this big

# Minimum spacing radius (at scale 1) used when placing, so props don't interpenetrate.
_SPACING = {"trees": 0.9, "rocks": 0.6, "bushes": 0.5}
# Lowest ground (above the sea) each kind grows on: trees, bushes and grass stay off the sand.
MIN_GROUND = {"trees": 0.9, "rocks": 0.25, "bushes": 0.8, "grass": 0.75}
GORILLA_MIN_GROUND = 0.9


class _SpatialHash:
    """Circles bucketed on a grid for fast "is this spot free" checks."""

    def __init__(self, cell: float = 2.0):
        self.cell = cell
        self.buckets: dict[tuple[int, int], list[tuple[float, float, float]]] = {}

    def _key(self, x: float, z: float) -> tuple[int, int]:
        return int(x // self.cell), int(z // self.cell)

    def add(self, x: float, z: float, r: float) -> None:
        self.buckets.setdefault(self._key(x, z), []).append((x, z, r))

    def is_free(self, x: float, z: float, r: float) -> bool:
        kx, kz = self._key(x, z)
        reach = 1 + int((r + 2.0) // self.cell)  # 2.0 bounds the largest stored radius
        for bx in range(kx - reach, kx + reach + 1):
            for bz in range(kz - reach, kz + reach + 1):
                for ox, oz, orad in self.buckets.get((bx, bz), ()):
                    if math.hypot(x - ox, z - oz) < r + orad:
                        return False
        return True


def generate_props(terrain: Terrain, seed: int) -> dict:
    rng = random.Random(seed * 7919 + 17)
    size = terrain.size
    centre = size / 2
    max_height = max(terrain.heights) or 1.0
    taken = _SpatialHash()

    def spot(margin: float = 1.0) -> tuple[float, float]:
        return rng.uniform(margin, size - margin), rng.uniform(margin, size - margin)

    def ground_ok(kind: str, x: float, z: float) -> bool:
        return terrain.height_at(x, z) >= SEA_LEVEL + MIN_GROUND[kind]

    def near_spawn(x: float, z: float) -> bool:
        return math.hypot(x - centre, z - centre) < SPAWN_CLEARANCE

    def forest(x: float, z: float) -> float:
        # Low-frequency mask in [0, 1]; high values are forest clusters.
        return fbm(x / 18, z / 18, seed + 500, octaves=3)

    def r2(v: float) -> float:
        return round(v, 2)

    trees = []
    for _ in range(int(size * size * 0.15)):
        x, z = spot()
        if rng.random() > (forest(x, z) - 0.45) * 4 or terrain.slope_at(x, z) > 0.6 or near_spawn(x, z):
            continue
        if not ground_ok("trees", x, z):
            continue
        scale = rng.uniform(0.8, 1.35)
        if not taken.is_free(x, z, _SPACING["trees"] * scale):
            continue
        taken.add(x, z, _SPACING["trees"] * scale)
        altitude = terrain.height_at(x, z) / max_height
        variant = 1 if rng.random() < 0.2 + altitude * 0.7 else 0
        trees.append([r2(x), r2(z), r2(scale), r2(rng.uniform(0, math.tau)), variant])

    rocks = []
    for _ in range(int(size * size * 0.06)):
        x, z = spot()
        altitude = terrain.height_at(x, z) / max_height
        chance = 0.12 + terrain.slope_at(x, z) * 1.2 + altitude * 0.25
        if rng.random() > chance or near_spawn(x, z) or not ground_ok("rocks", x, z):
            continue
        scale = rng.uniform(0.5, 1.2) if rng.random() < 0.9 else rng.uniform(1.6, 2.4)  # occasional boulder
        if not taken.is_free(x, z, _SPACING["rocks"] * scale):
            continue
        taken.add(x, z, _SPACING["rocks"] * scale)
        rocks.append([r2(x), r2(z), r2(scale), r2(rng.uniform(0, math.tau)), rng.randrange(ROCK_VARIANTS)])

    gorilla = _place_gorilla(terrain, trees, rocks)
    gx, gz = gorilla[0], gorilla[1]
    taken.add(gx, gz, GORILLA_RADIUS)

    bushes = []
    for _ in range(int(size * size * 0.08)):
        x, z = spot()
        # Most bushes sit around forest edges, a few anywhere.
        edge = 1 - abs(forest(x, z) - 0.5) * 6
        if rng.random() > max(edge, 0.08) or terrain.slope_at(x, z) > 0.7 or not ground_ok("bushes", x, z):
            continue
        scale = rng.uniform(0.6, 1.3)
        if not taken.is_free(x, z, _SPACING["bushes"] * scale):
            continue
        taken.add(x, z, _SPACING["bushes"] * scale)
        bushes.append([r2(x), r2(z), r2(scale), r2(rng.uniform(0, math.tau))])

    grass = []
    for _ in range(int(size * size * 0.9)):
        x, z = spot(0.3)
        if terrain.slope_at(x, z) > 0.55 or rng.random() < terrain.height_at(x, z) / max_height * 0.6:
            continue
        if not ground_ok("grass", x, z):
            continue
        if math.hypot(x - gx, z - gz) < GORILLA_RADIUS:
            continue
        grass.append([r2(x), r2(z), r2(rng.uniform(0.7, 1.4)), r2(rng.uniform(0, math.tau))])

    return {"trees": trees, "rocks": rocks, "bushes": bushes, "grass": grass, "gorilla": gorilla}


def _place_gorilla(terrain: Terrain, trees: list, rocks: list) -> list:
    """Seats the gorilla against the biggest round tree that has a flat, free spot beside it.

    Enlarges that tree in place. Returns [x, z, heading, tree index]; heading faces away from the trunk.
    """
    size = terrain.size
    solids = [(x, z, SOLID_RADIUS["trees"] * s) for x, z, s, *_ in trees]
    solids += [(x, z, SOLID_RADIUS["rocks"] * s) for x, z, s, *_ in rocks]
    centre = size / 2

    def spot_is_good(x: float, z: float, own_tree: int) -> bool:
        margin = GORILLA_RADIUS + 1.5
        if not (margin < x < size - margin and margin < z < size - margin):
            return False
        if terrain.slope_at(x, z) > 0.35 or terrain.height_at(x, z) < SEA_LEVEL + GORILLA_MIN_GROUND:
            return False
        return all(
            math.hypot(x - sx, z - sz) >= r + GORILLA_RADIUS + 0.1
            for i, (sx, sz, r) in enumerate(solids)
            if i != own_tree
        )

    # Round trees first, biggest first; pines only if no round tree works.
    order = sorted(range(len(trees)), key=lambda i: (trees[i][4] != 0, -trees[i][2]))
    for i in order:
        tx, tz, scale = trees[i][0], trees[i][1], max(trees[i][2], GORILLA_TREE_SCALE)
        # Try directions around the trunk, starting with the one facing the map centre.
        toward_centre = math.atan2(centre - tx, centre - tz)
        for step in range(12):
            heading = toward_centre + (step + 1) // 2 * (1 if step % 2 else -1) * math.tau / 12
            gap = SOLID_RADIUS["trees"] * scale + GORILLA_RADIUS + 0.05
            x, z = tx + math.sin(heading) * gap, tz + math.cos(heading) * gap
            if spot_is_good(x, z, i):
                trees[i][2] = round(scale, 2)
                return [round(x, 2), round(z, 2), round(heading, 3), i]
    # No tree has room: sit in the open near the centre.
    return [round(centre + 4, 2), round(centre, 2), 0.0, -1]
