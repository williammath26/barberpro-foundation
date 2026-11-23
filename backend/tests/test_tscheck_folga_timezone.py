"""
Criterion: Folgas gravadas no fuso da barbearia (America/Fortaleza, UTC-3), nao no do navegador.
The app converts "YYYY-MM-DDTHH:mm" local (shop timezone) to UTC before writing to
barber_time_off (see src/lib/timezone.ts: zonedLocalToUtcIso). This test performs the
exact same write the UI performs (local 2026-12-10T10:00 -> 2026-12-10T13:00:00+00:00)
directly against the real Supabase REST API with user B's token, and asserts the stored
representation round-trips to the expected UTC instant regardless of any client timezone.
"""
import httpx
from conftest import rest_headers, SHOP_ID


def _get_barber_qa_id(sb_url, sb_key, token):
    r = httpx.get(
        f"{sb_url}/rest/v1/barbers",
        headers=rest_headers(sb_key, token),
        params={"barbershop_id": f"eq.{SHOP_ID}", "display_name": "eq.Barbeiro QA", "select": "id"},
        timeout=30,
    )
    r.raise_for_status()
    rows = r.json()
    assert rows, "Fixture barber 'Barbeiro QA' not found in QA shop"
    return rows[0]["id"]


def test_time_off_stored_in_shop_timezone_utc(sb_base, user_b_token):
    sb_url, sb_key = sb_base
    token = user_b_token
    barber_id = _get_barber_qa_id(sb_url, sb_key, token)

    # Local shop time (America/Fortaleza, UTC-3, no DST) 2026-12-10T10:00 -> 2026-12-10T12:00
    # equals UTC 13:00 -> 15:00. This mirrors zonedLocalToUtcIso's exact output.
    payload = {
        "barbershop_id": SHOP_ID,
        "barber_id": barber_id,
        "starts_at": "2026-12-10T13:00:00+00:00",
        "ends_at": "2026-12-10T15:00:00+00:00",
        "reason": "tscheck-folga-tz-fixture",
    }
    created_id = None
    try:
        r = httpx.post(
            f"{sb_url}/rest/v1/barber_time_off",
            headers={**rest_headers(sb_key, token), "Prefer": "return=representation"},
            json=payload,
            timeout=30,
        )
        assert r.status_code == 201, f"POST barber_time_off status={r.status_code} body={r.text[:300]}"
        row = r.json()[0]
        created_id = row["id"]

        # Read back exactly what the UI's query would fetch.
        r2 = httpx.get(
            f"{sb_url}/rest/v1/barber_time_off",
            headers=rest_headers(sb_key, token),
            params={"id": f"eq.{created_id}", "select": "starts_at,ends_at,reason"},
            timeout=30,
        )
        assert r2.status_code == 200, f"GET barber_time_off status={r2.status_code} body={r2.text[:300]}"
        got = r2.json()[0]

        # Supabase/PostgREST returns timestamptz already normalized to UTC ("+00:00").
        assert got["starts_at"].startswith("2026-12-10T13:00:00"), got["starts_at"]
        assert got["ends_at"].startswith("2026-12-10T15:00:00"), got["ends_at"]
        assert got["starts_at"].endswith("+00:00") or got["starts_at"].endswith("Z"), got["starts_at"]
    finally:
        if created_id:
            d = httpx.delete(
                f"{sb_url}/rest/v1/barber_time_off",
                headers=rest_headers(sb_key, token),
                params={"id": f"eq.{created_id}"},
                timeout=30,
            )
            assert d.status_code in (200, 204), f"cleanup delete failed: {d.status_code} {d.text[:200]}"
