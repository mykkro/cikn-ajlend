import gzip
import json
import unittest

from app import app
from terrain import BEACH, SEA_LEVEL, SEABED, generate_terrain


class GenerateTerrainTest(unittest.TestCase):
    def test_heightmap_has_one_value_per_grid_vertex(self):
        t = generate_terrain(seed=3, tiles=4, segments=5)
        self.assertEqual(t.vertices_per_side, 21)
        self.assertEqual(len(t.heights), 21 * 21)

    def test_is_an_island(self):
        t = generate_terrain(seed=3)
        size = t.size
        for x, z in [(0, 0), (size, 0), (0, size), (size, size), (size / 2, 0.5), (0.5, size / 2)]:
            self.assertLess(t.height_at(x, z), SEA_LEVEL - 2, ("edge is open sea", x, z))
        self.assertGreater(t.height_at(size / 2, size / 2), SEA_LEVEL + BEACH - 0.01, "centre is land")
        self.assertGreaterEqual(min(t.heights), SEABED - 0.01)
        self.assertLessEqual(max(t.heights), 6.0 + BEACH + 0.01)

    def test_land_is_a_sizeable_share_of_the_map(self):
        t = generate_terrain(seed=3)
        land = sum(h > SEA_LEVEL for h in t.heights) / len(t.heights)
        self.assertTrue(0.15 < land < 0.4, land)  # an island with plenty of sea around it

    def test_same_seed_is_deterministic(self):
        self.assertEqual(generate_terrain(seed=7, tiles=3).heights, generate_terrain(seed=7, tiles=3).heights)

    def test_different_seeds_differ(self):
        self.assertNotEqual(generate_terrain(seed=7, tiles=3).heights, generate_terrain(seed=8, tiles=3).heights)


class TerrainApiTest(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_returns_requested_grid(self):
        data = self.client.get("/api/terrain?seed=2&tiles=2&segments=4").get_json()
        self.assertEqual((data["seed"], data["tiles"], data["segments"]), (2, 2, 4))
        self.assertEqual(len(data["heights"]), 9 * 9)

    def test_gzips_when_the_client_accepts_it(self):
        plain = self.client.get("/api/terrain?seed=2&tiles=2&segments=4")
        packed = self.client.get("/api/terrain?seed=2&tiles=2&segments=4", headers={"Accept-Encoding": "gzip, br"})
        self.assertNotIn("Content-Encoding", plain.headers)
        self.assertEqual(packed.headers["Content-Encoding"], "gzip")
        self.assertEqual(packed.headers["Vary"], "Accept-Encoding")
        self.assertEqual(json.loads(gzip.decompress(packed.data)), plain.get_json())
        self.assertLess(len(packed.data), len(plain.data))

    def test_rejects_bad_params(self):
        self.assertEqual(self.client.get("/api/terrain?tiles=abc").status_code, 400)
        self.assertEqual(self.client.get("/api/terrain?tiles=0").status_code, 400)
        self.assertEqual(self.client.get("/api/terrain?segments=99").status_code, 400)


if __name__ == "__main__":
    unittest.main()
