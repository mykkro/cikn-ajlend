"""Chicken Island game server: serves the web client and a small JSON API.

Development:  python app.py            (Flask's debug server on http://127.0.0.1:5000)
Production:   gunicorn app:app         (settings in gunicorn.conf.py)
"""

import gzip
import json
from functools import lru_cache
from pathlib import Path

from flask import Flask, Response, jsonify, request, send_from_directory

from props import generate_props
from terrain import generate_terrain

STATIC_DIR = Path(__file__).parent / "static"
DEFAULT_SEED = 1

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
        seed = _int_arg("seed", DEFAULT_SEED, 0, 2**31 - 1)
        tiles = _int_arg("tiles", None, 1, 64)
        segments = _int_arg("segments", None, 1, 32)
    except ValueError as e:
        return jsonify(error=str(e)), 400

    # The map is large (~850 KB of JSON), so send it gzipped when the client accepts that.
    plain, compressed = _world_payload(seed, tiles, segments)
    if "gzip" in request.headers.get("Accept-Encoding", ""):
        response = Response(compressed, mimetype="application/json")
        response.headers["Content-Encoding"] = "gzip"
    else:
        response = Response(plain, mimetype="application/json")
    response.headers["Vary"] = "Accept-Encoding"
    return response


@lru_cache(maxsize=16)
def _world_payload(seed: int, tiles: int | None, segments: int | None) -> tuple[bytes, bytes]:
    """Terrain plus props for one map, as JSON bytes and gzipped JSON bytes.

    Generating takes a couple of seconds, so maps are cached.
    """
    # Only override the generator's defaults for parameters actually given.
    options = {k: v for k, v in {"tiles": tiles, "segments": segments}.items() if v is not None}
    world = generate_terrain(seed=seed, **options)
    body = json.dumps(world.to_dict() | {"props": generate_props(world, seed)}, separators=(",", ":")).encode()
    return body, gzip.compress(body, compresslevel=6)


def warm_cache() -> None:
    """Build the default island ahead of the first visitor."""
    _world_payload(DEFAULT_SEED, None, None)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
