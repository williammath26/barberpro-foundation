import os
import pathlib

import httpx
import pytest


def _load_env():
    """Load the repository-root .env without adding a dotenv dependency."""
    env_path = pathlib.Path(__file__).resolve().parents[2] / ".env"
    values = {}
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


_ENV = _load_env()


def _setting(*names):
    for name in names:
        value = os.environ.get(name) or _ENV.get(name)
        if value:
            return value
    return None


SB_URL = _setting("SUPABASE_URL", "VITE_SUPABASE_URL")
SB_KEY = _setting(
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
)
USER_B_EMAIL = _setting("QA_USER_B_EMAIL")
USER_B_PASSWORD = _setting("QA_USER_B_PASSWORD")
SHOP_ID = _setting("QA_SHOP_ID")


@pytest.fixture(scope="session")
def sb_base():
    if not SB_URL or not SB_KEY:
        pytest.skip("Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY para testes de integração.")
    return SB_URL, SB_KEY


def get_token(sb_url: str, sb_key: str, email: str, password: str) -> str:
    response = httpx.post(
        f"{sb_url}/auth/v1/token?grant_type=password",
        headers={"apikey": sb_key, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()["access_token"]


@pytest.fixture(scope="session")
def user_b_token(sb_base):
    if not USER_B_EMAIL or not USER_B_PASSWORD or not SHOP_ID:
        pytest.skip(
            "Configure QA_USER_B_EMAIL, QA_USER_B_PASSWORD e QA_SHOP_ID "
            "para os testes que usam a loja QA."
        )
    sb_url, sb_key = sb_base
    return get_token(sb_url, sb_key, USER_B_EMAIL, USER_B_PASSWORD)


def rest_headers(sb_key: str, token: str) -> dict:
    return {
        "apikey": sb_key,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
