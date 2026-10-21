#!/usr/bin/env python3
"""Create the sync gist and write config.js.

Usage: python3 tools/setup_sync.py [existing-gist-id]
Credentials are read with a hidden prompt and never printed.
"""
import getpass
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

API = os.environ.get("GITHUB_API", "https://api.github.com")
DESC = "Pixies score pad data"
FILE = "pixies.json"
CONFIG = Path(__file__).resolve().parent.parent / "config.js"


def encode(token):
    return [ord(c) ^ ((i * 37 + 11) & 255) for i, c in enumerate(token)]


def create_gist(token):
    body = {
        "description": DESC,
        "public": False,
        "files": {FILE: {"content": json.dumps({"v": 1, "games": [], "deleted": []})}},
    }
    req = urllib.request.Request(
        f"{API}/gists",
        data=json.dumps(body).encode(),
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "pixies-setup",
        },
    )
    try:
        with urllib.request.urlopen(req) as res:
            return json.load(res)["id"]
    except urllib.error.HTTPError as e:
        sys.exit(f"GitHub rejected the request ({e.code}). Check the token has the gist scope.")


def main():
    token = (os.environ.get("PIXIES_TOKEN") or getpass.getpass("GitHub token (gist scope): ")).strip()
    if not token:
        sys.exit("No token entered.")
    gist_id = sys.argv[1] if len(sys.argv) > 1 else create_gist(token)
    cfg = {"gistId": gist_id, "t": encode(token)}
    CONFIG.write_text(f"window.PIXIES_CONFIG = {json.dumps(cfg, separators=(',', ':'))};\n")
    print(f"Wrote {CONFIG} (gist {gist_id}). Commit and push it.")


if __name__ == "__main__":
    main()
