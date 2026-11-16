"""Probe the public edge using disposable containers and synthetic data only.

Run: python deploy/test_public_edge.py (requires Docker; no real env/secrets).
Localhost uses Caddy's temporary local CA, explicitly trusted by this process.
AI-assisted verification, OpenAI Codex, Iteration 2 (2026-11-01).
"""
import base64
import json
import os
from pathlib import Path
import ssl
import subprocess
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import build_opener, HTTPSHandler, HTTPRedirectHandler, ProxyHandler, Request
import uuid

CADDY_IMAGE = "caddy:2.11.7-alpine@sha256:e70b164da81ef698b3ad19af799ea6086ce6d9e48ed4079eb9fe26f6fbf14ee5"
ROOT = Path(__file__).resolve().parent.parent


def docker(*args, input=None):
    return subprocess.run(
        ["docker", *args], input=input, capture_output=True, text=True, check=True,
    ).stdout.strip()


def check_compose():
    # Config resolution works without a daemon and must not read deploy/.env.
    fixture = {
        "POSTGRES_DB": "fixture", "POSTGRES_USER": "fixture", "POSTGRES_PASSWORD": "fixture-only",
        "OUTLOUD_PUBLIC_HOST": "localhost", "OUTLOUD_PUBLIC_BIND_IP": "127.0.0.1",
        "OUTLOUD_DEMO_PASSWORD_HASH": "$2a$04$synthetic-not-a-deployment-secret",
    }
    production = (ROOT / "compose.production.yaml").read_text()
    env_anchor = "  env_file: deploy/.env\n"
    assert production.count(env_anchor) == 1, "Update the exact production env-file fixture anchor"
    # Compose versions can require the file even with --no-env-resolution.
    with tempfile.TemporaryDirectory(prefix="outloud-compose-fixture-") as temp:
        production_fixture = Path(temp) / "compose.production.yaml"
        production_fixture.write_text(production.replace(env_anchor, "  env_file: []\n"))
        command = [
            "docker", "compose", "--project-directory", str(ROOT), "--env-file", os.devnull,
            "-f", str(production_fixture), "-f", str(ROOT / "compose.public.yaml"),
            "config", "--no-env-resolution", "--format", "json",
        ]
        environment = {**os.environ, **fixture}
        config = json.loads(subprocess.run(command, env=environment, capture_output=True, text=True, check=True).stdout)
        services = config["services"]
        assert services["caddy"]["image"] == CADDY_IMAGE
        assert set(services["caddy"]["environment"]) == {"OUTLOUD_PUBLIC_HOST", "OUTLOUD_DEMO_PASSWORD_HASH"}
        assert set(services["caddy"]["networks"]) == {"public_edge"}
        assert set(services["proxy"]["networks"]) == {"default", "public_edge"}
        assert {(p["host_ip"], str(p["published"]), p["target"]) for p in services["caddy"]["ports"]} == {
            ("127.0.0.1", "80", 80), ("127.0.0.1", "443", 443),
        }
        for name in ("db", "redis", "api", "worker", "scheduler"):
            assert not services[name].get("ports"), name + " must have no host port"
        assert all(p["host_ip"] == "127.0.0.1" for p in services["proxy"]["ports"])
        for required in ("OUTLOUD_PUBLIC_HOST", "OUTLOUD_PUBLIC_BIND_IP", "OUTLOUD_DEMO_PASSWORD_HASH"):
            missing = {**environment, required: ""}
            assert subprocess.run(command, env=missing, capture_output=True).returncode != 0, required + " must fail closed"
        print("Compose checks passed: required public config, isolated edge, and no DB/API host ports.")


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    check_compose()
    name = "outloud-edge-test-" + uuid.uuid4().hex[:10]
    networks, containers, volumes = [], [], []
    code = "synthetic-local-test-code-" + uuid.uuid4().hex
    credential = "Basic " + base64.b64encode(("reviewer:" + code).encode()).decode()
    wrong = "Basic " + base64.b64encode(b"reviewer:incorrect-fixture").decode()
    # Low bcrypt cost is for fixtures only; production uses Caddy's default cost.
    password_hash = docker("run", "--rm", "--network", "none", "-i", CADDY_IMAGE,
                           "caddy", "hash-password", "--bcrypt-cost", "4", input=code + "\n")
    with tempfile.TemporaryDirectory(prefix=name) as temp:
        media = Path(temp) / "media"
        media.mkdir(mode=0o755)
        Path(temp).chmod(0o755)
        (media / "recordings").mkdir()
        (media / "decks").mkdir()
        payload = b"synthetic-byte-range-fixture-" * 50
        (media / "recordings/fixture.m4a").write_bytes(payload)
        (media / "decks/fixture.pdf").write_bytes(b"%PDF-1.4\n% synthetic fixture\n")
        server = '''import http.server,json
class H(http.server.BaseHTTPRequestHandler):
 def do_GET(self):
  body=json.dumps({k.lower():v for k,v in self.headers.items()}).encode(); self.send_response(200); self.send_header("Content-Length",str(len(body))); self.end_headers(); self.wfile.write(body)
 def do_HEAD(self):
  self.send_response(200); self.end_headers()
 def log_message(self,*args): pass
http.server.HTTPServer(("0.0.0.0",8000),H).serve_forever()'''
        try:
            for network in (name + "-backend", name + "-edge"):
                docker("network", "create", network)
                networks.append(network)
            api, proxy, caddy = name + "-api", name + "-proxy", name + "-caddy"
            docker("run", "-d", "--name", api, "--network", networks[0], "--network-alias", "api",
                   "python:3.12-slim", "python", "-c", server)
            containers.append(api)
            docker("run", "-d", "--name", proxy, "--network", networks[0],
                   "-v", str(ROOT / "deploy/nginx.conf") + ":/etc/nginx/conf.d/default.conf:ro",
                   "-v", str(media) + ":/srv/media:ro", "nginx:stable-alpine")
            containers.append(proxy)
            docker("network", "connect", "--alias", "proxy", networks[1], proxy)
            volume = name + "-data"
            docker("volume", "create", volume)
            volumes.append(volume)
            docker("run", "-d", "--name", caddy, "--network", networks[1],
                   "-p", "127.0.0.1::443", "-p", "127.0.0.1::80",
                   "-e", "OUTLOUD_PUBLIC_HOST=localhost", "-e", "OUTLOUD_DEMO_PASSWORD_HASH=" + password_hash,
                   "-v", str(ROOT / "deploy/Caddyfile") + ":/etc/caddy/Caddyfile:ro",
                   "-v", volume + ":/data", CADDY_IMAGE)
            containers.append(caddy)
            # Only the public test root is copied; no trust-store modification.
            root_cert = Path(temp) / "local-root.crt"
            for _ in range(100):
                try:
                    docker("cp", caddy + ":/data/caddy/pki/authorities/local/root.crt", str(root_cert))
                    break
                except subprocess.CalledProcessError:
                    time.sleep(0.1)
            else:
                raise AssertionError("Caddy did not create its temporary localhost certificate")
            https = "https://localhost:" + docker("port", caddy, "443/tcp").rsplit(":", 1)[1]
            http = "http://localhost:" + docker("port", caddy, "80/tcp").rsplit(":", 1)[1]
            opener = build_opener(ProxyHandler({}), HTTPSHandler(context=ssl.create_default_context(cafile=str(root_cert))), NoRedirect())

            def request(path, auth=credential, extra=None, method="GET", base=https):
                headers = {**({"Authorization": auth} if auth else {}), **(extra or {})}
                try:
                    response = opener.open(Request(base + path, headers=headers, method=method), timeout=10)
                except HTTPError as error:
                    response = error
                with response:
                    return response.status, dict(response.headers), response.read()

            for _ in range(100):
                try:
                    if request("/api/health/")[0] == 200:
                        break
                except (URLError, TimeoutError, ConnectionError):
                    pass
                time.sleep(0.1)
            else:
                raise AssertionError("The local HTTPS edge did not become ready")
            for auth in (None, wrong):
                for path, method, extra in (
                    ("/api/health/", "GET", {}), ("/api/health/", "HEAD", {}),
                    ("/media/decks/fixture.pdf", "GET", {}),
                    ("/media/recordings/fixture.m4a", "GET", {"Range": "bytes=5-19"}),
                    ("/media/recordings/fixture.m4a", "HEAD", {}), ("/.env", "GET", {}),
                ):
                    assert request(path, auth, extra, method)[0] == 401, (path, method)
            status, _, body = request("/api/echo/", extra={"X-Forwarded-Proto": "http", "Proxy-Authorization": "fixture-proxy-secret"})
            echoed = json.loads(body)
            assert status == 200 and echoed["x-forwarded-proto"] == "https" and echoed["host"].startswith("localhost")
            assert "authorization" not in echoed and "proxy-authorization" not in echoed
            assert request("/api/echo/", extra={"Origin": "https://attacker.invalid"}, method="POST")[0] == 403
            status, headers, body = request("/media/recordings/fixture.m4a", extra={"Range": "bytes=5-19"})
            assert status == 206 and body == payload[5:20] and headers["Content-Range"] == f"bytes 5-19/{len(payload)}"
            assert headers["Content-Type"] == "audio/mp4" and headers["X-Content-Type-Options"] == "nosniff"
            assert request("/media/decks/fixture.pdf")[1]["Content-Type"] == "application/pdf"
            assert request("/media/recordings/fixture.m4a", method="HEAD")[2] == b""
            assert request("/api/upload/", extra={"Content-Length": "67108865"}, method="POST")[0] == 413
            assert request("/")[0] == 404 and request("/.env")[0] == 404
            status, headers, _ = request("/api/health/", auth=None, base=http)
            assert status in (301, 308) and headers["Location"].startswith("https://")
            assert "WWW-Authenticate" not in headers
            for container in (api, proxy):
                ports = json.loads(docker("inspect", "--format", "{{json .NetworkSettings.Ports}}", container))
                assert all(not binding for binding in (ports or {}).values())
            # No access logger is configured; error logs must omit request data.
            request("/api/private-test-path-" + name)
            logs = ""
            for container in (caddy, proxy):
                result = subprocess.run(["docker", "logs", container], capture_output=True, text=True, check=True)
                logs += result.stdout + result.stderr
            assert code not in logs and credential not in logs and name not in logs
            print("Public edge checks passed: verified localhost TLS, all-route auth, stripped credentials, HTTPS forwarding, Origin rejection, media HEAD/ranges, HTTP redirect, body cap, and private upstream ports.")
        finally:
            for container in reversed(containers):
                subprocess.run(["docker", "rm", "-f", container], capture_output=True)
            for volume in reversed(volumes):
                subprocess.run(["docker", "volume", "rm", volume], capture_output=True)
            for network in reversed(networks):
                subprocess.run(["docker", "network", "rm", network], capture_output=True)


if __name__ == "__main__":
    main()
