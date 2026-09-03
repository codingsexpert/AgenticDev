"""
test_sandbox_manager.py — Pytest for Local Sandbox Manager (Docker-Free)
"""

import os
import shutil
import pytest
from src.utils.sandbox_manager import (
    create_sandbox,
    write_file,
    read_file,
    get_file_list,
    execute_command,
    get_sandbox_path,
)


def test_sandbox_creation_and_file_ops(tmp_path):
    os.environ["SANDBOX_DIR"] = str(tmp_path)
    sandbox_id = create_sandbox()
    assert sandbox_id.startswith("sandbox-")

    # Test file writing & reading
    write_file(sandbox_id, "backend/src/server.js", "console.log('hello');")
    content = read_file(sandbox_id, "backend/src/server.js")
    assert content == "console.log('hello');"

    files = get_file_list(sandbox_id)
    assert "backend/src/server.js" in files

    # Test subprocess execution
    res = execute_command(sandbox_id, "echo 'test command'")
    assert res["exitCode"] == 0
    assert "test command" in res["stdout"]
