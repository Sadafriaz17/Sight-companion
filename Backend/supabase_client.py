"""Supabase client helpers for the Flask backend.

Centralised configuration: every backend module should import from here
instead of constructing its own client.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from supabase import Client, create_client

_BACKEND_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _BACKEND_DIR.parent

# Load root .env (and any local .env) without overriding real environment vars.
load_dotenv(_PROJECT_ROOT / ".env", override=False)
load_dotenv(_BACKEND_DIR / ".env", override=False)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def is_configured() -> bool:
    return bool(SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY)


def anon_client() -> Optional[Client]:
    """Client using the publishable key (RLS applies)."""
    if not is_configured():
        return None
    return create_client(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)


def user_client(access_token: str) -> Optional[Client]:
    """Client scoped to an authenticated user's JWT (RLS applies as that user)."""
    if not is_configured() or not access_token:
        return None
    client = create_client(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
    try:
        client.postgrest.auth(access_token)
    except Exception:
        pass
    return client


def get_user_from_token(access_token: str):
    """Validate a Supabase access token and return the user object or None."""
    if not is_configured() or not access_token:
        return None
    try:
        client = create_client(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
        resp = client.auth.get_user(access_token)
        return getattr(resp, "user", None)
    except Exception:
        return None


def service_client() -> Optional[Client]:
    """Server-only privileged client. Returns None unless a service role key exists."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
