"""Chicken Island game server: serves the web client and a small JSON API."""

from functools import lru_cache
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from props import generate_props
from terrain import generate_terrain

STATIC_DIR = Path(__file__).parent / "static"

app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="/static")


def _int_arg(name: str, default: int | None, lo: int, hi: int) -> int | None:
    raw = request.args.get(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        raise ValueError(f"{name} must be an integer")
    if not lo <= value <= hi:
        raise ValueError(f"{name} must be between {lo} and {hi}")
    return value


@app.get("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")


@app.get("/api/health")
def health():
    return jsonify(status="ok")


@app.get("/api/terrain")
def terrain():
    try:
        seed = _int_arg("seed", 1, 0, 2**31 - 1)
        tiles = _int_arg("tiles", None, 1, 64)
        segments = _int_arg("segments", None, 1, 32)
    except ValueError as e:
        return jsonify(error=str(e)), 400
    return jsonify(_world(seed, tiles, segments))


@lru_cache(maxsize=16)
def _world(seed: int, tiles: int | None, segments: int | None) -> dict:
    """Terrain plus props for one map. Generating takes a couple of seconds, so maps are cached."""
    # Only override the generator's defaults for parameters actually given.
    options = {k: v for k, v in {"tiles": tiles, "segments": segments}.items() if v is not None}
    world = generate_terrain(seed=seed, **options)
    return world.to_dict() | {"props": generate_props(world, seed)}


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
