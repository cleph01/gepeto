#!/usr/bin/env python3
"""
One-off: copy the seed test drivers' role/driver_id/lab_id from user_metadata
into app_metadata.

Why: the database RLS policies (and requireAuth) read app_metadata. The seed
used to set only user_metadata, so the seed drivers (driver1/driver2@gepeto.dev)
got zero rows back from every jobs query in the driver app. Real invited drivers
already have app_metadata set by POST /api/drivers.

Touches only those two seed accounts, and only their app_metadata.

Run from the repo root:
  python3 packages/db/scripts/backfill-seed-driver-app-metadata.py
"""
import base64
import json
import os
import urllib.request

ENV_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "..", "apps", "dispatcher-web", ".env.local")
SEED_DRIVERS = ["driver1@gepeto.dev", "driver2@gepeto.dev"]
SEED_PASSWORD = "SeedPass1!"  # from packages/db/seeds/01_seed.js


def load_env(path):
    env = {}
    for line in open(path):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


env = load_env(ENV_FILE)
SB = env["SUPABASE_URL"]
ANON = env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
SERVICE = env["SUPABASE_SERVICE_ROLE_KEY"]


def claims_for(email):
    req = urllib.request.Request(
        f"{SB}/auth/v1/token?grant_type=password",
        data=json.dumps({"email": email, "password": SEED_PASSWORD}).encode(),
        headers={"apikey": ANON, "Content-Type": "application/json"},
    )
    token = json.load(urllib.request.urlopen(req))["access_token"]
    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    return json.loads(base64.urlsafe_b64decode(payload))


for email in SEED_DRIVERS:
    c = claims_for(email)
    um = c.get("user_metadata", {})
    if not um.get("driver_id") or not um.get("lab_id"):
        print(f"{email}: skipped, no driver_id/lab_id in user_metadata")
        continue
    meta = {"role": "driver", "driver_id": um["driver_id"], "lab_id": um["lab_id"]}
    req = urllib.request.Request(
        f"{SB}/auth/v1/admin/users/{c['sub']}",
        data=json.dumps({"app_metadata": meta}).encode(),
        method="PUT",
        headers={"apikey": SERVICE, "Authorization": "Bearer " + SERVICE, "Content-Type": "application/json"},
    )
    am = json.load(urllib.request.urlopen(req)).get("app_metadata", {})
    ok = am.get("driver_id") == um["driver_id"] and am.get("lab_id") == um["lab_id"]
    print(f"{email}: app_metadata updated, {'OK' if ok else 'MISMATCH, check manually'}")
