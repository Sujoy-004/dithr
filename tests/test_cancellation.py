"""Automated tests for export cancellation and recursive subprocess tree termination."""

from __future__ import annotations

import asyncio
import os
from pathlib import Path
import subprocess
import sys
import time

from fastapi.testclient import TestClient
import psutil
import pytest

from src.api.jobs import ExportJobManager, cleanup_job_storage, terminate_job_process_tree
from src.api.limiter import limiter
from src.api.main import app
from src.api.security import reset_security_state


@pytest.fixture(autouse=True)
def clean_state():
    """Reset manager and security state between tests."""
    manager = ExportJobManager.get_instance()
    manager.reset()
    limiter.reset()
    reset_security_state()
    yield
    manager.reset()
    limiter.reset()
    reset_security_state()


def test_terminate_job_process_tree_none():
    """terminate_job_process_tree safely handles None."""
    terminate_job_process_tree(None)


def test_terminate_job_process_tree_single():
    """terminate_job_process_tree terminates a running subprocess."""
    proc = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"])
    pid = proc.pid
    assert psutil.pid_exists(pid)

    terminate_job_process_tree(pid, timeout=2.0)
    # Give OS a moment to reap
    time.sleep(0.1)
    assert not psutil.pid_exists(pid)


def test_terminate_job_process_tree_recursive():
    """terminate_job_process_tree terminates both parent and child subprocesses."""
    script = (
        "import subprocess, sys, time\n"
        "child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(30)'])\n"
        "print(child.pid, flush=True)\n"
        "time.sleep(30)\n"
    )
    parent = subprocess.Popen(
        [sys.executable, "-c", script],
        stdout=subprocess.PIPE,
        text=True,
    )
    parent_pid = parent.pid
    child_pid_line = parent.stdout.readline().strip()
    assert child_pid_line.isdigit(), f"Expected child pid, got: {child_pid_line}"
    child_pid = int(child_pid_line)

    assert psutil.pid_exists(parent_pid)
    assert psutil.pid_exists(child_pid)

    terminate_job_process_tree(parent_pid, timeout=2.0)
    time.sleep(0.1)

    assert not psutil.pid_exists(parent_pid)
    assert not psutil.pid_exists(child_pid)


def test_cleanup_job_storage(tmp_path: Path):
    """cleanup_job_storage purges directory and all contents."""
    job_dir = tmp_path / "test_job_123"
    job_dir.mkdir(parents=True)
    (job_dir / "input.webm").write_bytes(b"dummy video data")
    (job_dir / "palette.png").write_bytes(b"dummy palette")

    assert job_dir.exists()
    cleanup_job_storage(job_dir)
    assert not job_dir.exists()


@pytest.mark.asyncio
async def test_manager_cancel_job_terminates_process_and_cleans_storage():
    """ExportJobManager.cancel_job kills process tree and wipes storage."""
    manager = ExportJobManager.get_instance()
    job, _ = await manager.acquire_job("mp4", 10.0, client_ip="127.0.0.1")

    # Spawn real dummy long-running subprocess
    proc = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"])
    job.pid = proc.pid

    job_dir = manager.get_job_dir(job.id)
    (job_dir / "input.webm").write_bytes(b"chunks")
    assert job_dir.exists()
    assert psutil.pid_exists(proc.pid)

    cancelled_job = manager.cancel_job(job.id, "Testing cancel")
    assert cancelled_job.state == "cancelled"
    assert cancelled_job.error == "Testing cancel"
    assert not psutil.pid_exists(proc.pid)
    assert not job_dir.exists()


def test_api_cancel_export_route():
    """POST /api/export/{job_id}/cancel terminates subprocess and purges job storage."""
    client = TestClient(app)

    init_res = client.post(
        "/api/export/init",
        json={"format": "mp4", "duration": 10.0, "fps": 30},
        headers={"CF-Connecting-IP": "173.245.48.5"},
    )
    assert init_res.status_code == 200, init_res.text
    init_data = init_res.json()
    job_id = init_data["job_id"]
    job_token = init_data["job_token"]

    manager = ExportJobManager.get_instance()
    job = manager.get_job(job_id)
    assert job is not None

    # Attach dummy subprocess and storage file
    proc = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"])
    job.pid = proc.pid
    job_dir = manager.get_job_dir(job_id)
    (job_dir / "input.webm").write_bytes(b"partial video bytes")

    assert psutil.pid_exists(proc.pid)
    assert job_dir.exists()

    cancel_res = client.post(
        f"/api/export/{job_id}/cancel",
        headers={"X-Job-Token": job_token},
    )
    assert cancel_res.status_code == 200, cancel_res.text
    assert cancel_res.json() == {
        "status": "cancelled",
        "job_id": job_id,
        "state": "cancelled",
    }

    assert not psutil.pid_exists(proc.pid)
    assert not job_dir.exists()
