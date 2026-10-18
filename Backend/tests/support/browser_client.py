"""Build legitimate cookie/CSRF requests for existing behavior regressions.

Security rejection tests use plain TestClient and construct headers explicitly.
No production dependency or middleware is bypassed by this helper.
"""
from http.cookies import SimpleCookie

from fastapi.testclient import TestClient


class BrowserClient(TestClient):
    def __init__(self, app, **kwargs):
        kwargs.setdefault("base_url", "https://testserver")
        self._root = kwargs.get("root_path", "")
        super().__init__(app, **kwargs)

    def request(self, method, url, **kwargs):
        if method.upper() not in {"GET", "HEAD", "OPTIONS"}:
            headers = dict(kwargs.pop("headers", None) or {})
            if not any(name.lower() == "x-csrf-token" for name in headers):
                # Snapshot explicit cookie input as well as the nonce, so concurrent
                # login tests do not race against the shared client's cookie jar.
                explicit = next((value for name, value in headers.items() if name.lower() == "cookie"), None)
                cookie = SimpleCookie()
                if explicit is None:
                    for item in self.cookies.jar:
                        cookie[item.name] = item.value
                else:
                    cookie.load(explicit)
                    for item in self.cookies.jar:
                        if item.name in {"__Host-datano_csrf", "datano_csrf_dev"} and item.name not in cookie:
                            cookie[item.name] = item.value
                raw = "; ".join(f"{name}={item.value}" for name,item in cookie.items())
                bootstrap = super().request("GET", self._root + "/api/auth/csrf", headers={"Cookie":raw})
                assert bootstrap.status_code == 200, "CSRF bootstrap failed"
                for item in self.cookies.jar:
                    if item.name in {"__Host-datano_csrf", "datano_csrf_dev"} and item.name not in cookie:
                        cookie[item.name] = item.value
                headers["Cookie"] = "; ".join(f"{name}={item.value}" for name,item in cookie.items())
                headers["X-CSRF-Token"] = bootstrap.json()["payload"]["csrf_token"]
            headers.setdefault("Origin", self.app.state.settings.public_origin)
            kwargs["headers"] = headers
        return super().request(method, url, **kwargs)
