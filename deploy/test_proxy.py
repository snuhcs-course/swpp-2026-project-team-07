"""Exercise the private proxy with disposable containers and synthetic media.

Run: python deploy/test_proxy.py (requires Docker).
AI-assisted verification, OpenAI Codex, Iteration 2 (2026-10-31).
"""
import json
from pathlib import Path
import subprocess
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import uuid


def docker(*args):
    return subprocess.run(["docker", *args], capture_output=True, text=True, check=True).stdout.strip()


def main():
    name = "outloud-proxy-test-" + uuid.uuid4().hex[:10]
    containers = []
    with tempfile.TemporaryDirectory(prefix="outloud-media-fixture-") as temp:
        media = Path(temp)
        media.chmod(0o755)
        (media / "recordings").mkdir()
        (media / "decks").mkdir()
        payload = b"synthetic-byte-range-fixture-" * 50
        (media / "recordings/fixture.m4a").write_bytes(payload)
        (media / "decks/fixture.pdf").write_bytes(b"%PDF-1.4\n% synthetic serving fixture\n")
        (media / "unexpected.html").write_text('<script>throw new Error("fixture")</script>')
        (media / "linked.m4a").symlink_to("recordings/fixture.m4a")
        server = '''import http.server,json
class H(http.server.BaseHTTPRequestHandler):
 def do_GET(self):
  body=json.dumps(dict(self.headers)).encode(); self.send_response(200); self.send_header("Content-Length",str(len(body))); self.end_headers(); self.wfile.write(body)
http.server.HTTPServer(("0.0.0.0",8000),H).serve_forever()'''
        docker("network", "create", name)
        try:
            api = name + "-api"
            docker("run", "-d", "--name", api, "--network", name, "--network-alias", "api", "python:3.12-slim", "python", "-c", server)
            containers.append(api)
            proxy = name + "-proxy"
            config = Path(__file__).resolve().with_name("nginx.conf")
            docker("run", "-d", "--name", proxy, "--network", name, "-p", "127.0.0.1::8080", "-v", str(config) + ":/etc/nginx/conf.d/default.conf:ro", "-v", str(media) + ":/srv/media:ro", "nginx:stable-alpine")
            containers.append(proxy)
            base = "http://" + docker("port", proxy, "8080/tcp")
            for _ in range(100):
                try:
                    with urlopen(base + "/healthz", timeout=1) as response:
                        assert response.status == 200
                    break
                except (URLError, TimeoutError, ConnectionError):
                    time.sleep(0.1)
            else:
                raise AssertionError("nginx did not become ready")

            def request(path, extra=None, method="GET"):
                headers = {"Host": "outloud.fixture.ts.net", "X-Forwarded-Proto": "https", "X-Forwarded-For": "100.64.0.1", **(extra or {})}
                try:
                    response = urlopen(Request(base + path, headers=headers, method=method), timeout=10)
                except HTTPError as error:
                    response = error
                with response:
                    return response.status, dict(response.headers), response.read()

            # Native clients have no Origin; cross-site browser writes must fail.
            status, _, body = request("/api/echo/")
            echoed = json.loads(body)
            assert status == 200 and echoed["Host"] == "outloud.fixture.ts.net" and echoed["X-Forwarded-Proto"] == "https"
            assert request("/api/echo/", {"Origin": "https://attacker.invalid"}, "POST")[0] == 403
            assert request("/api/echo/", {"X-Forwarded-Proto": "http"})[0] == 403
            status, headers, body = request("/media/recordings/fixture.m4a", {"Range": "bytes=5-19"})
            assert status == 206 and body == payload[5:20] and headers["Content-Range"] == f"bytes 5-19/{len(payload)}"
            assert headers["Content-Type"] == "audio/mp4" and headers["X-Content-Type-Options"] == "nosniff"
            assert request("/media/decks/fixture.pdf")[1]["Content-Type"] == "application/pdf"
            assert request("/media/recordings/fixture.m4a", method="HEAD")[2] == b""
            for path in ("/media/recordings/", "/media/linked.m4a"):
                assert request(path)[0] == 403
            assert request("/media/recordings/fixture.m4a", method="POST")[0] == 403
            assert request("/media/recordings/fixture.m4a", {"X-Forwarded-Proto": "http"})[0] == 403
            assert request("/media/unexpected.html")[1]["Content-Type"] == "application/octet-stream"
            assert request("/")[0] == 404 and request("/.env")[0] == 404
            assert request("/api/upload/", {"Content-Length": "67108865"}, "POST")[0] == 413
            print("Proxy checks passed: HTTPS/native requests, cross-origin rejection, media ranges/MIME, read-only paths and upload body cap.")
        finally:
            for container in reversed(containers):
                docker("rm", "-f", container)
            docker("network", "rm", name)


if __name__ == "__main__":
    main()
