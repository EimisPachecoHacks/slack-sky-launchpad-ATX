"""Sky Launchpad testbed target app — a tiny site for the NemoClaw tester to test.

Pure stdlib (no pip installs on the instance). Signup form + todo list with TWO
DELIBERATELY SEEDED BUGS the agent should find:

  BUG 1: signing up with an empty email is accepted silently (no validation).
  BUG 2: deleting a todo removes the item ABOVE the one clicked (off-by-one).

Run:  python3 app.py [port]     (defaults to 80)
"""

import html
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

USERS: list[dict] = []
TODOS: list[str] = ["Try the demo", "Test me with an agent"]


def page(body: str, msg: str = "") -> str:
    return f"""<!DOCTYPE html>
<html><head><title>SkyNotes — Testbed</title><style>
 body {{ font-family: -apple-system, Arial, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 16px; color:#1a202c; }}
 h1 {{ color: #2b6cb0; }} .card {{ border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 16px 0; }}
 input[type=text],input[type=email],input[type=password] {{ width: 95%; padding: 8px; margin: 6px 0; border:1px solid #cbd5e0; border-radius:6px; }}
 button {{ background:#2b6cb0; color:#fff; border:0; border-radius:6px; padding:8px 14px; cursor:pointer; }}
 .del {{ background:#e53e3e; padding:4px 10px; }}
 .msg {{ background:#c6f6d5; border-radius:6px; padding:10px; }} .err {{ background:#fed7d7; }}
 li {{ margin:8px 0; }}
</style></head><body>
<h1>📝 SkyNotes</h1>
{f'<p class="msg">{html.escape(msg)}</p>' if msg else ''}
{body}
<p style="color:#a0aec0;font-size:12px">Sky Launchpad testbed app · deployed by the autopilot agent</p>
</body></html>"""


def home(msg: str = "") -> str:
    users = "".join(f"<li>{html.escape(u['name'])} &lt;{html.escape(u['email'])}&gt;</li>" for u in USERS) or "<li><i>none yet</i></li>"
    todos = "".join(
        f"<li>{html.escape(t)} <form style='display:inline' method='post' action='/todo/delete'>"
        f"<input type='hidden' name='index' value='{i}'/><button class='del'>Delete</button></form></li>"
        for i, t in enumerate(TODOS)
    ) or "<li><i>empty</i></li>"
    return page(f"""
<div class="card"><h2>Sign up</h2>
<form method="post" action="/signup">
  <input type="text" name="name" placeholder="Full name"/><br/>
  <input type="email" name="email" placeholder="Email"/><br/>
  <input type="password" name="password" placeholder="Password"/><br/>
  <button type="submit">Create account</button>
</form>
<h3>Registered users</h3><ul>{users}</ul></div>
<div class="card"><h2>Todos</h2>
<form method="post" action="/todo/add">
  <input type="text" name="item" placeholder="New todo"/> <button type="submit">Add</button>
</form>
<ul>{todos}</ul></div>""", msg)


class Handler(BaseHTTPRequestHandler):
    def _respond(self, body: str, code: int = 200):
        data = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self._respond(home() if self.path == "/" else page("<p class='err msg'>Not found</p>"), 200 if self.path == "/" else 404)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        form = {k: v[0] for k, v in parse_qs(self.rfile.read(length).decode()).items()}
        if self.path == "/signup":
            name = form.get("name", "").strip()
            email = form.get("email", "").strip()
            password = form.get("password", "")
            if not name:
                return self._respond(home("Error: name is required."))
            if not password:
                return self._respond(home("Error: password is required."))
            # BUG 1 (seeded): empty email is accepted with no validation at all.
            USERS.append({"name": name, "email": email})
            return self._respond(home(f"Welcome, {name}! Account created."))
        if self.path == "/todo/add":
            item = form.get("item", "").strip()
            if item:
                TODOS.append(item)
            return self._respond(home("Todo added." if item else "Error: todo text required."))
        if self.path == "/todo/delete":
            try:
                i = int(form.get("index", "-1"))
                # BUG 2 (seeded): off-by-one — deletes the item ABOVE the one clicked.
                j = max(0, i - 1)
                if 0 <= j < len(TODOS):
                    TODOS.pop(j)
                return self._respond(home("Todo deleted."))
            except ValueError:
                return self._respond(home("Error: bad index."))
        self._respond(page("<p class='err msg'>Not found</p>"), 404)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 80
    print(f"SkyNotes testbed listening on :{port}")
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
