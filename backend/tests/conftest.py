import os
import pathlib
import httpx
import pytest

# Load /app/.env manually (no extra deps) so SB_URL/SB_KEY always reflect current env config.
def _load_env():
    env_path = pathlib.Path(__file__).resolve().parents[2] / ".env"
    values = {}
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            values[k.strip()] = v.strip().strip('"').strip("'")
    return values


_ENV = _load_env()
SB_URL = os.environ.get("SUPABASE_URL") or _ENV.get("SUPABASE_URL") or _ENV.get("VITE_SUPABASE_URL")
SB_KEY = (
    os.environ.get("SUPABASE_PUBLISHABLE_KEY")
    or _ENV.get("SUPABASE_PUBLISHABLE_KEY")
    or _ENV.get("VITE_SUPABASE_PUBLISHABLE_KEY")
)

USER_B_EMAIL = "usckloxz@guerrillamailblock.com"
USER_B_PASSWORD = "QaBarber!fbzzsenv#7Kz"
USER_A_EMAIL = "tfewlmzz@guerrillamailblock.com"
USER_A_PASSWORD = "QaBarber!qgdlp7nv#7Kz"
USER_A_ID = "4024bb0e-7596-44ef-a4ed-02fad4cb1daf"
SHOP_ID = "7c67b2ef-15a9-4b9f-966f-17bb23431df9"


@pytest.fixture(scope="session")
def sb_base():
    assert SB_URL and SB_KEY, "Supabase env vars missing"
    return SB_URL, SB_KEY


def get_token(sb_url: str, sb_key: str, email: str, password: str) -> str:
    r = httpx.post(
        f"{sb_url}/auth/v1/token?grant_type=password",
        headers={"apikey": sb_key, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def user_b_token(sb_base):
    sb_url, sb_key = sb_base
    return get_token(sb_url, sb_key, USER_B_EMAIL, USER_B_PASSWORD)


def rest_headers(sb_key: str, token: str) -> dict:
    return {
        "apikey": sb_key,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
