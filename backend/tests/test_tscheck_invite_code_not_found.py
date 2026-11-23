"""
Criterion: Barbeiro com conta via codigo de convite.
The UI's "Ligar conta" flow (src/components/barbers/BarberAccount.tsx) inserts a
shop_memberships row with the pasted code as user_id. A UUID that is syntactically
valid but belongs to no profile must be rejected by the FK constraint (the UI maps
Postgres error 23503 to "Codigo nao encontrado"). This test replicates that exact
REST call against the real Supabase backend and asserts the invalid reference is
rejected, not silently accepted.
"""
import uuid
import httpx
from conftest import rest_headers, SHOP_ID


def test_invite_code_for_nonexistent_user_is_rejected(sb_base, user_b_token):
    sb_url, sb_key = sb_base
    token = user_b_token
    bogus_user_id = str(uuid.uuid4())  # syntactically valid UUID, no matching profile

    r = httpx.post(
        f"{sb_url}/rest/v1/shop_memberships",
        headers=rest_headers(sb_key, token),
        json={"barbershop_id": SHOP_ID, "user_id": bogus_user_id, "role": "barber"},
        timeout=30,
    )
    # Must NOT be accepted (2xx). Expect a FK violation (Postgres 23503 surfaced via PostgREST as HTTP 409).
    assert r.status_code >= 400, f"expected rejection for unknown invite code, got {r.status_code}: {r.text[:300]}"
    body = r.text
    assert "23503" in body or r.status_code == 409, f"expected FK violation 23503, got status={r.status_code} body={body[:300]}"
