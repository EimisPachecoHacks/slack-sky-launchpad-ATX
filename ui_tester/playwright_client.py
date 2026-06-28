"""
Sky Launchpad - Local Playwright Client (UI Self-Test "hands").

A standalone local process that launches a Playwright Chromium browser and
connects to the Sky Launchpad backend over WebSocket (as a client). It executes
the backend's coordinate-based Computer-Use actions and streams screenshots back.

Coordinates from the backend are NORMALIZED to a 0-1000 range (Gemini Computer
Use style) and are denormalized to viewport pixels here.

Run:
    python ui_tester/playwright_client.py

Env vars:
    BACKEND_WS_URL  WebSocket URL of the backend (default: ws://localhost:8000/api/uitest/playwright)
    HEADLESS        "1" (default) launches headless; "0" launches headed.
"""
import asyncio
import base64
import json
import os
import sys

import websockets
from playwright.async_api import async_playwright

# --- Configuration --------------------------------------------------------

BACKEND_WS_URL = os.getenv(
    "BACKEND_WS_URL", "ws://localhost:8000/api/uitest/playwright"
)
HEADLESS = os.getenv("HEADLESS", "1") != "0"

VIEWPORT_WIDTH = 1280
VIEWPORT_HEIGHT = 800

# Rolling buffer of recent console messages/errors.
MAX_CONSOLE_MESSAGES = 20

SCREENSHOT_TIMEOUT_MS = 10000
RECONNECT_DELAY_S = 3


# --- Coordinate denormalization (mirrors Benji) ---------------------------

def denormalize_x(x: int, screen_width: int) -> int:
    """Convert normalized x coordinate (0-1000) to actual pixel coordinate."""
    return int(int(x) / 1000 * screen_width)


def denormalize_y(y: int, screen_height: int) -> int:
    """Convert normalized y coordinate (0-1000) to actual pixel coordinate."""
    return int(int(y) / 1000 * screen_height)


# --- Console capture ------------------------------------------------------

class ConsoleCapture:
    """Keeps a rolling list of the most recent console messages/errors."""

    def __init__(self, limit: int = MAX_CONSOLE_MESSAGES):
        self._limit = limit
        self._messages = []

    def add(self, type_: str, text: str) -> None:
        self._messages.append({"type": type_, "text": text})
        if len(self._messages) > self._limit:
            self._messages = self._messages[-self._limit:]

    def drain(self) -> list:
        """Return current messages and reset the captured list."""
        messages = self._messages
        self._messages = []
        return messages


def attach_console_listeners(page, capture: ConsoleCapture) -> None:
    def on_console(msg):
        try:
            capture.add(msg.type, msg.text)
        except Exception:
            pass

    def on_pageerror(err):
        try:
            capture.add("pageerror", str(err))
        except Exception:
            pass

    page.on("console", on_console)
    page.on("pageerror", on_pageerror)


# --- Screenshot helper ----------------------------------------------------

async def capture_screenshot_b64(page) -> str:
    """Take a viewport (NOT full_page) screenshot, return base64 PNG."""
    screenshot_bytes = await page.screenshot(
        full_page=False, timeout=SCREENSHOT_TIMEOUT_MS
    )
    return base64.b64encode(screenshot_bytes).decode()


# --- Action execution -----------------------------------------------------

async def execute_action(page, function_name: str, args: dict) -> None:
    """Execute a single coordinate-based action. Raises on failure."""
    if function_name == "click_at":
        x = denormalize_x(args["x"], VIEWPORT_WIDTH)
        y = denormalize_y(args["y"], VIEWPORT_HEIGHT)
        await page.mouse.click(x, y)

    elif function_name == "type_text_at":
        x = denormalize_x(args["x"], VIEWPORT_WIDTH)
        y = denormalize_y(args["y"], VIEWPORT_HEIGHT)
        text = args.get("text", "")
        press_enter = bool(args.get("press_enter", False))
        clear_before = bool(args.get("clear_before", False))

        await page.mouse.click(x, y)
        await asyncio.sleep(0.1)
        if clear_before:
            await page.keyboard.press("Meta+A")
            await page.keyboard.press("Delete")
        await page.keyboard.type(text)
        if press_enter:
            await page.keyboard.press("Enter")

    elif function_name == "navigate":
        await page.goto(args["url"])

    elif function_name == "scroll_at":
        x = denormalize_x(args["x"], VIEWPORT_WIDTH)
        y = denormalize_y(args["y"], VIEWPORT_HEIGHT)
        direction = args.get("direction", "down")
        amount = int(args.get("amount", 600))

        await page.mouse.move(x, y)
        if direction == "down":
            await page.mouse.wheel(0, amount)
        elif direction == "up":
            await page.mouse.wheel(0, -amount)
        elif direction == "right":
            await page.mouse.wheel(amount, 0)
        elif direction == "left":
            await page.mouse.wheel(-amount, 0)
        else:
            raise ValueError(f"Unknown scroll direction: {direction}")

    elif function_name == "drag":
        x = denormalize_x(args["x"], VIEWPORT_WIDTH)
        y = denormalize_y(args["y"], VIEWPORT_HEIGHT)
        dest_x = denormalize_x(args["destination_x"], VIEWPORT_WIDTH)
        dest_y = denormalize_y(args["destination_y"], VIEWPORT_HEIGHT)

        await page.mouse.move(x, y)
        await page.mouse.down()
        await page.mouse.move(dest_x, dest_y)
        await page.mouse.up()

    elif function_name == "key_combination":
        keys = args["keys"]
        await page.keyboard.press(keys)

    elif function_name == "wait":
        ms = int(args.get("ms", 500))
        await asyncio.sleep(ms / 1000)

    else:
        raise ValueError(f"Unknown function_name: {function_name}")


# --- Message handling -----------------------------------------------------

async def handle_message(page, capture: ConsoleCapture, ws, message: dict) -> None:
    msg_type = message.get("type")

    if msg_type == "start":
        url = message.get("url")
        print(f"▶️  start -> navigating to {url}")
        await page.goto(url)
        await ws.send(json.dumps({"type": "started", "url": page.url}))

    elif msg_type == "request_screenshot":
        print("📸 request_screenshot")
        screenshot_b64 = await capture_screenshot_b64(page)
        await ws.send(
            json.dumps({"type": "screenshot", "screenshot": screenshot_b64})
        )

    elif msg_type == "execute_action":
        function_name = message.get("function_name")
        args = message.get("args", {}) or {}
        print(f"⚡ execute_action: {function_name} {args}")

        result = {
            "type": "action_result",
            "screenshot": None,
            "url": page.url,
            "console_errors": [],
        }

        try:
            await execute_action(page, function_name, args)
            await asyncio.sleep(0.3)
            print(f"✅ action completed: {function_name}")
        except Exception as exc:
            result["error"] = str(exc)
            print(f"❌ action error ({function_name}): {exc}")

        # Always try to send a screenshot, even after an error.
        try:
            result["screenshot"] = await capture_screenshot_b64(page)
        except Exception as exc:
            print(f"⚠️  screenshot failed: {exc}")
            if "error" not in result:
                result["error"] = f"screenshot failed: {exc}"

        result["url"] = page.url
        result["console_errors"] = capture.drain()
        await ws.send(json.dumps(result))

    else:
        print(f"⚠️  Unknown message type: {msg_type}")


# --- Connection loop ------------------------------------------------------

async def run_session(page, capture: ConsoleCapture) -> None:
    print(f"📡 Connecting to backend at: {BACKEND_WS_URL}")
    # For wss:// (e.g. Cloud Run), use certifi's CA bundle so TLS verifies on
    # macOS/python.org builds (avoids CERTIFICATE_VERIFY_FAILED).
    ws_ssl = None
    if BACKEND_WS_URL.startswith("wss://"):
        import ssl
        try:
            import certifi
            ws_ssl = ssl.create_default_context(cafile=certifi.where())
        except Exception:
            ws_ssl = ssl.create_default_context()
    async with websockets.connect(
        BACKEND_WS_URL, ping_interval=20, ping_timeout=60, max_size=None, ssl=ws_ssl
    ) as ws:
        print("✅ Connected to backend")
        print("🎯 Ready to receive commands")
        while True:
            message_str = await ws.recv()
            try:
                message = json.loads(message_str)
            except json.JSONDecodeError as exc:
                print(f"⚠️  Could not parse message: {exc}")
                continue
            await handle_message(page, capture, ws, message)


async def main() -> None:
    print("=" * 60)
    print("🤖 Sky Launchpad - Local Playwright Client")
    print("=" * 60)
    print(f"   Headless: {HEADLESS}")
    print(f"   Viewport: {VIEWPORT_WIDTH}x{VIEWPORT_HEIGHT}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=HEADLESS)
        context = await browser.new_context(
            viewport={"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT}
        )
        page = await context.new_page()
        capture = ConsoleCapture()
        attach_console_listeners(page, capture)
        print("✅ Browser launched")

        try:
            # Reconnect/loop so the client keeps running.
            while True:
                try:
                    await run_session(page, capture)
                except (KeyboardInterrupt, asyncio.CancelledError):
                    raise
                except Exception as exc:
                    print(f"❌ Connection error: {exc}")
                    print(f"💡 Make sure the backend is running at {BACKEND_WS_URL}")
                    print(f"🔁 Reconnecting in {RECONNECT_DELAY_S}s...")
                    await asyncio.sleep(RECONNECT_DELAY_S)
        except (KeyboardInterrupt, asyncio.CancelledError):
            print("\n👋 Shutting down...")
        finally:
            await browser.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Shutting down...")
        sys.exit(0)
