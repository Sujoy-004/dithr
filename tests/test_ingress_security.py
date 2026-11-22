"""Automated tests for ingress defense: 50MB limit, magic byte validation, and rate limiting."""

from __future__ import annotations

import io

from fastapi.testclient import TestClient
import pytest

from src.api.jobs import ExportJobManager
from src.api.limiter import limiter
from src.api.magic import validate_magic_bytes
from src.api.main import app
from src.api.security import reset_security_state


@pytest.fixture(autouse=True)
def clean_state():
    """Reset manager, limiter, and security state between tests."""
    manager = ExportJobManager.get_instance()
    manager.reset()
    limiter.reset()
    reset_security_state()
    yield
    manager.reset()
    limiter.reset()
    reset_security_state()


def test_validate_magic_bytes_pure_unit():
    """Verify validate_magic_bytes against all expected formats and invalid headers."""
    # PNG
    png_hdr = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    assert validate_magic_bytes(png_hdr, {"png"})
    assert not validate_magic_bytes(png_hdr, {"jpeg"})

    # JPEG
    jpeg_hdr = b"\xff\xd8\xff\xe0\x00\x10JFIF"
    assert validate_magic_bytes(jpeg_hdr, {"jpeg"})
    assert validate_magic_bytes(jpeg_hdr, {"jpg"})
    assert not validate_magic_bytes(jpeg_hdr, {"png"})

    # WebM
    webm_hdr = b"\x1a\x45\xdf\xa3\x9fB\x86\x81\x01B\xf7\x81\x01"
    assert validate_magic_bytes(webm_hdr, {"webm"})
    assert not validate_magic_bytes(webm_hdr, {"mp4"})

    # MP4
    mp4_hdr = b"\x00\x00\x00\x18ftypisom\x00\x00\x02\x00"
    assert validate_magic_bytes(mp4_hdr, {"mp4"})
    assert not validate_magic_bytes(mp4_hdr, {"webm"})

    # GIF
    gif87_hdr = b"GIF87a\x01\x00\x01\x00"
    gif89_hdr = b"GIF89a\x01\x00\x01\x00"
    assert validate_magic_bytes(gif87_hdr, {"gif"})
    assert validate_magic_bytes(gif89_hdr, {"gif"})
    assert not validate_magic_bytes(gif87_hdr, {"png"})

    # WAV
    wav_hdr = b"RIFF$\x00\x00\x00WAVEfmt "
    assert validate_magic_bytes(wav_hdr, {"wav"})
    assert not validate_magic_bytes(wav_hdr, {"mp3"})

    # MP3 (ID3 tag & sync frame)
    mp3_id3 = b"ID3\x03\x00\x00\x00\x00\x00#"
    mp3_sync = b"\xff\xfb\x90d\x00\x00\x00\x00"
    assert validate_magic_bytes(mp3_id3, {"mp3"})
    assert validate_magic_bytes(mp3_sync, {"mp3"})
    assert not validate_magic_bytes(b"\x00\x00\x00\x00", {"mp3"})

    # Empty or garbage
    assert not validate_magic_bytes(b"", {"png", "jpeg", "webm", "mp4"})
    assert not validate_magic_bytes(b"GARBAGE_BYTES_1234", {"png", "jpeg", "webm", "mp4"})


def _init_job(client: TestClient) -> tuple[str, str]:
    """Helper to initialize an export job and return job_id and job_token."""
    res = client.post(
        "/api/export/init",
        json={"format": "mp4", "duration": 10.0, "fps": 30},
        headers={"CF-Connecting-IP": "173.245.48.5"},
    )
    assert res.status_code == 200, res.text
    data = res.json()
    return data["job_id"], data["job_token"]


def test_chunk_upload_magic_bytes_enforcement():
    """Initial chunk (chunk_index=0) requires valid WebM header; garbage purges storage and cancels job."""
    client = TestClient(app)
    job_id, job_token = _init_job(client)

    manager = ExportJobManager.get_instance()
    job_dir = manager.get_job_dir(job_id)
    assert job_dir.exists()

    # Upload garbage bytes at chunk 0 -> HTTP 400 and cancelled
    bad_res = client.post(
        f"/api/export/{job_id}/chunk?chunk_index=0",
        content=b"CORRUPT_NOT_WEBM_DATA",
        headers={"X-Job-Token": job_token, "Content-Type": "application/octet-stream"},
    )
    assert bad_res.status_code == 400, bad_res.text
    assert "Unsupported file format" in bad_res.json()["detail"]

    job = manager.get_job(job_id)
    assert job is not None
    assert job.state == "cancelled"
    assert not job_dir.exists()

    # Create a fresh job and verify valid WebM header is accepted
    job_id2, job_token2 = _init_job(client)
    valid_webm = b"\x1a\x45\xdf\xa3" + b"\x00" * 64
    ok_res = client.post(
        f"/api/export/{job_id2}/chunk?chunk_index=0",
        content=valid_webm,
        headers={"X-Job-Token": job_token2, "Content-Type": "application/octet-stream"},
    )
    assert ok_res.status_code == 200, ok_res.text
    assert ok_res.json()["status"] == "chunk_received"


def test_chunk_upload_50mb_ceiling():
    """Uploads exceeding 50MB are rejected with HTTP 413."""
    client = TestClient(app)
    job_id, job_token = _init_job(client)

    manager = ExportJobManager.get_instance()
    job = manager.get_job(job_id)
    assert job is not None

    # Simulate accumulated uploaded bytes close to 50MB (50MB = 52,428,800 bytes)
    job.total_uploaded_bytes = 50 * 1024 * 1024 - 100

    # Sending 200 bytes will push total to 50MB + 100 bytes -> 413
    over_res = client.post(
        f"/api/export/{job_id}/chunk?chunk_index=1",
        content=b"\x00" * 200,
        headers={"X-Job-Token": job_token, "Content-Type": "application/octet-stream"},
    )
    assert over_res.status_code == 413, over_res.text
    assert "File exceeds 50MB limit" in over_res.json()["detail"]


def test_audio_upload_rate_limiting():
    """Source audio upload enforces 5 requests per minute with HTTP 429 on the 6th."""
    client = TestClient(app)
    valid_wav_header = b"RIFF$\x00\x00\x00WAVEfmt " + b"\x00" * 32
    job_id, job_token = _init_job(client)

    # 5 successful uploads to the active job
    for i in range(5):
        res = client.post(
            f"/api/export/{job_id}/source-audio",
            files={"file": ("audio.wav", io.BytesIO(valid_wav_header), "audio/wav")},
            headers={"X-Job-Token": job_token, "CF-Connecting-IP": "173.245.48.5"},
        )
        assert res.status_code == 200, f"Attempt {i+1} failed: {res.text}"

    # 6th upload from same client IP triggers HTTP 429
    res6 = client.post(
        f"/api/export/{job_id}/source-audio",
        files={"file": ("audio.wav", io.BytesIO(valid_wav_header), "audio/wav")},
        headers={"X-Job-Token": job_token, "CF-Connecting-IP": "173.245.48.5"},
    )
    assert res6.status_code == 429, f"Expected 429, got {res6.status_code}: {res6.text}"


def test_audio_upload_magic_bytes_and_size_limits():
    """Source audio validates container header and rejects files > 50MB."""
    client = TestClient(app)

    # 1. Reject invalid magic bytes with HTTP 400
    job_id, job_token = _init_job(client)
    bad_res = client.post(
        f"/api/export/{job_id}/source-audio",
        files={"file": ("fake.mp3", io.BytesIO(b"NOT_REAL_AUDIO_BYTES_1234"), "audio/mpeg")},
        headers={"X-Job-Token": job_token, "CF-Connecting-IP": "173.245.48.5"},
    )
    assert bad_res.status_code == 400, bad_res.text
    assert "Unsupported file format" in bad_res.json()["detail"]

    # 2. Reject payload > 50MB with HTTP 413
    manager = ExportJobManager.get_instance()
    manager.cancel_job(job_id)
    job_id2, job_token2 = _init_job(client)
    oversized_data = b"ID3\x03\x00\x00\x00\x00\x00#" + (b"\x00" * (50 * 1024 * 1024 + 10))
    over_res = client.post(
        f"/api/export/{job_id2}/source-audio",
        files={"file": ("huge.mp3", io.BytesIO(oversized_data), "audio/mpeg")},
        headers={"X-Job-Token": job_token2, "CF-Connecting-IP": "173.245.48.5"},
    )
    assert over_res.status_code == 413, over_res.text
    assert "File exceeds 50MB limit" in over_res.json()["detail"]
