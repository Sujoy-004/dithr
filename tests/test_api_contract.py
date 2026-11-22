"""Schemathesis OpenAPI ASGI contract fuzzing and Hypothesis property tests (D-05, RELY-07)."""

from __future__ import annotations

import os
import pytest
from fastapi.testclient import TestClient
from hypothesis import HealthCheck, given, settings, strategies as st
import schemathesis

from src.api.limiter import limiter
from src.api.main import app
from src.api.jobs import ExportJobManager

client = TestClient(app)
schema = schemathesis.openapi.from_asgi("/openapi.json", app)


@pytest.fixture(autouse=True)
def configure_contract_test_environment():
    """Temporarily disable Turnstile and rate limiting during contract tests, restoring afterwards."""
    old_limiter_enabled = limiter.enabled
    old_turnstile = os.environ.get("TURNSTILE_DISABLED")

    limiter.enabled = False
    os.environ["TURNSTILE_DISABLED"] = "true"

    yield

    limiter.enabled = old_limiter_enabled
    if old_turnstile is None:
        os.environ.pop("TURNSTILE_DISABLED", None)
    else:
        os.environ["TURNSTILE_DISABLED"] = old_turnstile


def check_not_unhandled_server_error(ctx, response, case):
    """Ensure no unhandled 500 errors occur, while permitting intentional 503 ServerBusy responses per D-02."""
    if response.status_code == 503:
        try:
            data = response.json()
            if data.get("error") == "server_busy":
                return None
        except Exception:
            pass
    if response.status_code >= 500:
        raise AssertionError(f"Unexpected server error {response.status_code}: {response.text}")


CONTRACT_CHECKS = (
    schemathesis.checks.status_code_conformance,
    schemathesis.checks.content_type_conformance,
    schemathesis.checks.response_schema_conformance,
    check_not_unhandled_server_error,
)


@schema.parametrize()
@settings(
    max_examples=10,
    suppress_health_check=[
        HealthCheck.too_slow,
        HealthCheck.filter_too_much,
        HealthCheck.function_scoped_fixture,
    ],
    deadline=None,
)
def test_api_openapi_contract(case):
    """Verify that all FastAPI endpoints conform to the OpenAPI 3.1 schema specification."""
    response = case.call()
    case.validate_response(response, checks=CONTRACT_CHECKS)


@given(job_id_suffix=st.text(alphabet="abcdefghijklmnopqrstuvwxyz0123456789-", min_size=1, max_size=36))
@settings(max_examples=25, deadline=None)
def test_export_cancellation_idempotency_property(job_id_suffix: str):
    """Hypothesis property test verifying cancellation idempotency on arbitrary or non-existent job IDs.

    Calling cancellation repeatedly on arbitrary IDs must return 401/404 (or 200 if valid)
    and never produce unhandled 500 errors or deadlock the job manager.
    """
    job_id = f"test-prop-{job_id_suffix}"

    # First cancel request
    resp1 = client.post(f"/api/export/{job_id}/cancel")
    assert resp1.status_code in (200, 401, 404), f"Unexpected status {resp1.status_code}: {resp1.text}"

    # Second cancel request on same ID must be idempotent
    resp2 = client.post(f"/api/export/{job_id}/cancel")
    assert resp2.status_code in (200, 401, 404), f"Idempotency failed: {resp2.status_code}: {resp2.text}"


def test_concurrent_active_job_cancellation_idempotency():
    """Verify cancellation property when a job was genuinely initialized in the job manager."""
    manager = ExportJobManager.get_instance()
    # Reset any active job to allow fresh creation
    if manager._active_job_id:
        manager.cancel_job(manager._active_job_id)

    resp = client.post(
        "/api/export/init",
        json={"format": "mp4", "duration": 3.0, "fps": 30},
        headers={"CF-Connecting-IP": "127.0.0.1"},
    )
    if resp.status_code == 503:
        if manager._active_job_id:
            manager.cancel_job(manager._active_job_id)
        resp = client.post(
            "/api/export/init",
            json={"format": "mp4", "duration": 3.0, "fps": 30},
            headers={"CF-Connecting-IP": "127.0.0.1"},
        )

    assert resp.status_code == 200
    data = resp.json()
    job_id = data["job_id"]
    job_token = data["job_token"]

    # Cancel via API route with valid token
    cancel_resp = client.post(
        f"/api/export/{job_id}/cancel",
        headers={"X-Job-Token": job_token},
    )
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["state"] == "cancelled"

    # Second cancel on the same job must be idempotent without 500 errors
    repeat_resp = client.post(
        f"/api/export/{job_id}/cancel",
        headers={"X-Job-Token": job_token},
    )
    assert repeat_resp.status_code in (200, 404)
