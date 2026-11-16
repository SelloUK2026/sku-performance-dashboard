"""Small password login for the two Render-hosted internal tools."""
from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import html
from http.cookies import CookieError, SimpleCookie
import os
import time
from urllib.parse import parse_qs


SESSION_SECONDS = 8 * 60 * 60


class PasswordLogin:
    def __init__(self, username: str, password: str, title: str, cookie_name: str, secure: bool):
        self.username = username
        self.password = password
        self.title = title
        self.cookie_name = cookie_name
        self.secure = secure
        self.signing_key = hashlib.sha256((username + "\0" + password + "\0" + os.environ.get("DATA_REFRESH_TOKEN", "")).encode("utf-8")).digest()

    def _cookie_value(self) -> str:
        payload = f"{self.username}\n{int(time.time()) + SESSION_SECONDS}".encode("utf-8")
        encoded = base64.urlsafe_b64encode(payload).rstrip(b"=").decode("ascii")
        signature = hmac.new(self.signing_key, encoded.encode("ascii"), hashlib.sha256).hexdigest()
        return encoded + "." + signature

    def authenticated(self, headers) -> bool:
        try:
            cookie = SimpleCookie()
            cookie.load(headers.get("Cookie", ""))
            item = cookie.get(self.cookie_name)
            if item is None:
                return False
            encoded, signature = item.value.rsplit(".", 1)
            expected = hmac.new(self.signing_key, encoded.encode("ascii"), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(signature, expected):
                return False
            payload = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)).decode("utf-8")
            username, expires = payload.rsplit("\n", 1)
            return hmac.compare_digest(username, self.username) and int(expires) >= time.time()
        except (CookieError, ValueError, UnicodeError, TypeError, binascii.Error):
            return False

    def show_login(self, handler, error: bool = False) -> None:
        title = html.escape(self.title)
        notice = "<p class='error'>Incorrect username or password.</p>" if error else ""
        body = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in · {title}</title>
<style>
body{{font:16px system-ui,sans-serif;background:#f4f5f8;color:#172033;min-height:100vh;display:grid;place-items:center;margin:0}}
main{{background:white;width:min(380px,calc(100vw - 48px));padding:32px;border-radius:12px;box-shadow:0 10px 35px #1820381a}}
h1{{font-size:24px;margin:0 0 8px}}p{{color:#536078;margin:0 0 24px}}label{{display:block;font-weight:600;margin:16px 0 6px}}
input{{box-sizing:border-box;width:100%;font:inherit;padding:11px;border:1px solid #b8c1d0;border-radius:6px}}
button{{font:inherit;font-weight:600;background:#613469;color:white;border:0;border-radius:6px;padding:12px 18px;width:100%;margin-top:24px;cursor:pointer}}
.error{{color:#a11e32;margin:12px 0 0}}
</style></head><body><main><h1>Sign in</h1><p>{title}</p>{notice}
<form method="post" action="/login">
<label for="username">Username</label><input id="username" name="username" type="text" autocomplete="username" required autofocus>
<label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required>
<button type="submit">Sign in</button></form></main></body></html>""".encode("utf-8")
        handler.send_response(401 if error else 200)
        handler.send_header("Content-Type", "text/html; charset=utf-8")
        handler.send_header("Content-Length", str(len(body)))
        handler.send_header("Cache-Control", "no-store")
        handler.send_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
        handler.end_headers()
        handler.wfile.write(body)

    def submit_login(self, handler) -> None:
        try:
            length = int(handler.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length < 1 or length > 4096:
            handler.send_error(400, "Invalid login form")
            return
        try:
            fields = parse_qs(handler.rfile.read(length).decode("utf-8"))
            username = fields.get("username", [""])[0]
            password = fields.get("password", [""])[0]
        except UnicodeError:
            self.show_login(handler, error=True)
            return
        if not (hmac.compare_digest(username, self.username) and hmac.compare_digest(password, self.password)):
            self.show_login(handler, error=True)
            return
        cookie = f"{self.cookie_name}={self._cookie_value()}; Path=/; Max-Age={SESSION_SECONDS}; HttpOnly; SameSite=Lax"
        if self.secure:
            cookie += "; Secure"
        handler.send_response(303)
        handler.send_header("Location", "/")
        handler.send_header("Set-Cookie", cookie)
        handler.send_header("Cache-Control", "no-store")
        handler.send_header("Content-Length", "0")
        handler.end_headers()

    def logout(self, handler) -> None:
        cookie = f"{self.cookie_name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"
        if self.secure:
            cookie += "; Secure"
        handler.send_response(303)
        handler.send_header("Location", "/login")
        handler.send_header("Set-Cookie", cookie)
        handler.send_header("Cache-Control", "no-store")
        handler.send_header("Content-Length", "0")
        handler.end_headers()
