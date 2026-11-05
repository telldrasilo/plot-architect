"""Real Chromium regression: local Graphite login form preserves Origin.

Starts the actual Node loopback server against a disposable SQLite HOME;
never uses a user's Site, D1, tunnel, plugin or project. Credentials are
generated in the child process and are never included in test output.
Only Ubuntu CI is supported (uses POSIX select for bounded startup).
"""
import os
import re
import select
import subprocess
import tempfile
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]


def start_local_graphite(home):
    env = dict(os.environ, HOME=str(home), GRAPHITE_LOCAL_PORT="0")
    proc = subprocess.Popen(
        ["node", "scripts/run-node-local.mjs"],
        cwd=ROOT / "site",
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=0,
    )
    output = ""
    deadline = time.monotonic() + 20
    try:
        while time.monotonic() < deadline:
            if proc.poll() is not None:
                raise AssertionError("Local Graphite exited during startup")
            readable, _, _ = select.select([proc.stdout], [], [], 0.3)
            if readable:
                chunk = os.read(proc.stdout.fileno(), 16384)
                if not chunk:
                    raise AssertionError("Local Graphite closed stdout before ready")
                output += chunk.decode("utf-8", errors="replace")
                url = re.search(r"^Editor: (http://127\.0\.0\.1:\d+)/$", output, re.M)
                key = re.search(r"^Temporary local access key .*: ([A-Za-z0-9_-]{40,})$", output, re.M)
                if url and key:
                    return proc, url.group(1), key.group(1)
        raise AssertionError("Local Graphite did not start within 20 seconds")
    except BaseException:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
        raise


def main():
    with tempfile.TemporaryDirectory(prefix="graphite-node-login-qa-") as home:
        process, origin, key = start_local_graphite(home)
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(headless=True)
                page = browser.new_page()
                login = page.goto(origin + "/", wait_until="domcontentloaded")
                assert login.status == 200
                assert page.url == origin + "/__local/login"
                assert login.headers.get("referrer-policy") == "same-origin"
                page.locator("#key").fill(key)
                with page.expect_response(
                    lambda res: res.url == origin + "/__local/login"
                    and res.request.method == "POST"
                ) as submitted:
                    page.get_by_role("button", name="Открыть редактор").click()
                assert submitted.value.status == 303, "Native Chrome form POST must authenticate"
                page.wait_for_url(origin + "/", wait_until="domcontentloaded")
                assert "Plot Architect" in page.title()
                health = page.evaluate(
                    """async () => {
                      const response = await fetch('/api/health');
                      return {status: response.status, data: await response.json()};
                    }"""
                )
                assert health["status"] == 200
                assert health["data"]["authMode"] == "node-loopback"
                cookies = page.context.cookies(origin)
                assert any(
                    c["name"] == "graphite_local_session"
                    and c["httpOnly"] and c["sameSite"] == "Strict"
                    for c in cookies
                )
                browser.close()
            print("PASS: real Chromium login -> editor -> authenticated REST; disposable SQLite")
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


if __name__ == "__main__":
    main()
