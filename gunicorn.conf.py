"""Gunicorn settings, picked up automatically by `gunicorn app:app`.

Each setting can be overridden with an environment variable, e.g. on Render.
"""

import os

# Render (and most hosts) tell the app which port to listen on via $PORT.
bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"

# Threads let a worker serve the many static files of a page load in parallel.
workers = int(os.environ.get("WEB_CONCURRENCY", "2"))
threads = int(os.environ.get("GUNICORN_THREADS", "4"))

# Generating a new island takes a couple of seconds; leave plenty of headroom.
timeout = 60

# Load the app once in the master process and build the default island there,
# so every worker starts with it already cached (shared memory after fork).
preload_app = True

accesslog = "-"
errorlog = "-"


def when_ready(server):
    from app import warm_cache

    warm_cache()
    server.log.info("Default island generated and cached")
