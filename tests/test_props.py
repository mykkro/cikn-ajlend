import math
import unittest

from app import app
from props import GORILLA_MIN_GROUND, GORILLA_RADIUS, GORILLA_TREE_SCALE, MIN_GROUND, SOLID_RADIUS, SPAWN_CLEARANCE, generate_props
from terrain import generate_terrain


class GeneratePropsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.terrain = generate_terrain(seed=5)
        cls.props = generate_props(cls.terrain, seed=5)

    def test_gorilla_sits_against_his_big_round_tree(self):
        x, z, heading, tree_index = self.props["gorilla"]
        tx, tz, scale, _, variant = self.props["trees"][tree_index]
        self.assertEqual(variant, 0, "a round, leafy tree")
        self.assertGreaterEqual(scale, GORILLA_TREE_SCALE)
        self.assertLess(math.hypot(x - tx, z - tz), SOLID_RADIUS["trees"] * scale + GORILLA_RADIUS + 0.2)
        # Facing away from the trunk.
        self.assertGreater(math.sin(heading) * (x - tx) + math.cos(heading) * (z - tz), 0)

    def test_gorilla_has_room(self):
        x, z, _, tree_index = self.props["gorilla"]
        for kind in SOLID_RADIUS:
            for i, (sx, sz, s, *_) in enumerate(self.props[kind]):
                if kind == "trees" and i == tree_index:
                    continue
                self.assertGreaterEqual(math.hypot(x - sx, z - sz), SOLID_RADIUS[kind] * s + GORILLA_RADIUS, (kind, i))
        for bx, bz, *_ in self.props["bushes"]:
            self.assertGreater(math.hypot(x - bx, z - bz), GORILLA_RADIUS)

    def test_everything_grows_on_land(self):
        for kind, floor in MIN_GROUND.items():
            for x, z, *_ in self.props[kind]:
                # Positions are rounded to 0.01, which can shift the ground height a hair.
                self.assertGreaterEqual(self.terrain.height_at(x, z), floor - 0.05, (kind, x, z))
        x, z, *_ = self.props["gorilla"]
        self.assertGreaterEqual(self.terrain.height_at(x, z), GORILLA_MIN_GROUND)

    def test_every_kind_is_present(self):
        for kind in ("trees", "rocks", "bushes", "grass"):
            self.assertGreater(len(self.props[kind]), 0, kind)

    def test_deterministic_per_seed(self):
        self.assertEqual(generate_props(self.terrain, seed=5), self.props)
        self.assertNotEqual(generate_props(self.terrain, seed=6), self.props)

    def test_props_lie_inside_the_map(self):
        size = self.terrain.size
        for kind, items in self.props.items():
            if kind == "gorilla":
                items = [items]
            for x, z, *_ in items:
                self.assertTrue(0 <= x <= size and 0 <= z <= size, (kind, x, z))

    def test_spawn_area_is_clear_of_solid_props(self):
        centre = self.terrain.size / 2
        for kind in SOLID_RADIUS:
            for x, z, *_ in self.props[kind]:
                self.assertGreaterEqual(math.hypot(x - centre, z - centre), SPAWN_CLEARANCE, (kind, x, z))

    def test_solid_props_do_not_overlap(self):
        solids = [(x, z, SOLID_RADIUS[kind] * s) for kind in SOLID_RADIUS for x, z, s, *_ in self.props[kind]]
        for i, (x1, z1, r1) in enumerate(solids):
            for x2, z2, r2 in solids[i + 1:]:
                self.assertGreaterEqual(math.hypot(x1 - x2, z1 - z2), r1 + r2 - 0.02)


class TerrainApiPropsTest(unittest.TestCase):
    def test_terrain_response_includes_props(self):
        data = app.test_client().get("/api/terrain?seed=3").get_json()
        self.assertEqual(set(data["props"]), {"trees", "rocks", "bushes", "grass", "gorilla"})


if __name__ == "__main__":
    unittest.main()
