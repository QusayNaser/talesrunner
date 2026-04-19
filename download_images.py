"""
TalesRunner Image Downloader
============================
Run this script in the same folder as items_clean.json.
Images will be saved to an "images/" subfolder next to the script.

Requirements: Python 3.8+  (no extra libraries needed)

Usage:
    python download_images.py
"""

import json
import time
import threading
from pathlib import Path
from queue import Queue
from urllib.parse import urlparse
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

# ── Config ────────────────────────────────────────────────────────────────────
ITEMS_FILE        = "items_clean.json"
IMAGES_DIR        = Path("images")
MAX_THREADS       = 10    # lower = more polite to the server; raise to 20 if you want speed
TIMEOUT           = 15    # seconds per request
RETRY             = 2     # retries per failed image
TEST_URLS         = 0     # set to 0 for full download
STOP_ON_FAIL      = False  # continue downloading all images even if some fail
DEBUG             = True  # print failed URL details
COOKIES_FILE      = Path("cookies.txt")
LOGIN_URL         = "https://www.talesrunner.us/site/?page=login"
PLAYWRIGHT_PROFILE = Path(".playwright_profile")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Referer": "https://www.talesrunner.us/",
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}
# ─────────────────────────────────────────────────────────────────────────────

IMAGES_DIR.mkdir(exist_ok=True)

# Thread-safe counters
_lock         = threading.Lock()
_done         = 0
_skipped      = 0
_failed       = 0
_failed_urls  = []
_stop_event   = threading.Event()

def url_to_filename(url: str) -> str:
    parsed = urlparse(url)
    parts  = parsed.path.strip("/").split("/")
    return "__".join(parts)

def get_playwright_cookie_header() -> str:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise SystemExit(
            "Playwright is not installed.\n"
            "Run: pip install playwright\n"
            "Then run: playwright install chromium"
        )

    print("\nOpening a dedicated Chromium browser window for login...")
    PLAYWRIGHT_PROFILE.mkdir(exist_ok=True)
    with sync_playwright() as pw:
        context = pw.chromium.launch_persistent_context(
            user_data_dir=str(PLAYWRIGHT_PROFILE),
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--start-maximized",
            ],
            ignore_default_args=["--enable-automation"],
        )
        page = context.new_page()
        page.goto(LOGIN_URL, wait_until="domcontentloaded")
        page.wait_for_load_state("networkidle", timeout=30000)

        print("Chromium window opened. Log in manually, then return here and press Enter.")
        input("Press Enter after you have completed login...\n")

        cookies = context.cookies()
        context.close()

    if not cookies:
        raise SystemExit("No cookies were found. Please make sure you logged in successfully in Chromium.")

    cookie_header = "; ".join(f"{cookie['name']}={cookie['value']}" for cookie in cookies)
    COOKIES_FILE.write_text(cookie_header, encoding="utf-8")
    return cookie_header


def load_cookie_header() -> str:
    if COOKIES_FILE.exists():
        existing = COOKIES_FILE.read_text(encoding="utf-8").strip()
        if existing:
            use_existing = input(f"Use existing cookies from '{COOKIES_FILE}'? [Y/n/s=skip]: ").strip().lower()
            if use_existing in ("", "y", "yes"):
                return existing
            if use_existing in ("s", "skip"):
                return ""

    use_login = input("Do you want to log in manually in Chromium? [y/N]: ").strip().lower()
    if use_login in ("", "y", "yes"):
        return get_playwright_cookie_header()

    print("Proceeding without cookies. The CDN URLs may still work with referer-only access.")
    return ""

def download_one(url: str, dest: Path, retries: int = RETRY) -> bool:
    for attempt in range(retries + 1):
        try:
            req  = Request(url, headers=HEADERS)
            with urlopen(req, timeout=TIMEOUT) as resp:
                dest.write_bytes(resp.read())
            return True
        except HTTPError as e:
            if DEBUG:
                print(f"\nDownload failed: {url} -> HTTP {e.code}")
            if e.code in (403, 404):
                return False          # no point retrying
            if attempt == retries:
                return False
            time.sleep(1.5 ** attempt)
        except (URLError, OSError) as exc:
            if DEBUG:
                print(f"\nDownload error: {url} -> {exc}")
            if attempt == retries:
                return False
            time.sleep(1.5 ** attempt)
    return False

def worker(q: Queue, total: int):
    global _done, _skipped, _failed
    while True:
        item = q.get()
        if item is None:
            break
        url, dest = item

        if _stop_event.is_set():
            q.task_done()
            continue

        if dest.exists() and dest.stat().st_size > 0:
            with _lock:
                _skipped += 1
                _print_progress(total)
            q.task_done()
            continue

        ok = download_one(url, dest)
        with _lock:
            if ok:
                _done += 1
            else:
                _failed += 1
                _failed_urls.append(url)
                if STOP_ON_FAIL:
                    _stop_event.set()
            _print_progress(total)
        q.task_done()

def _print_progress(total: int):
    finished = _done + _skipped + _failed
    bar_len  = 30
    filled   = int(bar_len * finished / total) if total else 0
    bar      = "█" * filled + "░" * (bar_len - filled)
    print(
        f"\r[{bar}] {finished}/{total}  "
        f"✓{_done} skip{_skipped} ✗{_failed}   ",
        end="", flush=True
    )

def main():
    if not Path(ITEMS_FILE).exists():
        print(f"❌  '{ITEMS_FILE}' not found. Make sure it's in the same folder as this script.")
        return

    print(f"Loading {ITEMS_FILE}…")
    cookie_header = load_cookie_header()
    if cookie_header:
        HEADERS["Cookie"] = cookie_header
    elif "Cookie" in HEADERS:
        del HEADERS["Cookie"]

    with open(ITEMS_FILE, encoding="utf-8") as f:
        items = json.load(f)

    # Collect unique URLs (original URLs are stored as relative paths; rebuild them)
    # The image field looks like: images/TalesRunner__itemimage__accback__xyz.png
    # We reconstruct the URL from the filename.
    url_map: dict[str, Path] = {}
    for item in items:
        img_path = item.get("image", "")
        if not img_path:
            continue
        # Derive original URL from the stored local path
        filename  = Path(img_path).name                  # e.g. TalesRunner__itemimage__accback__xyz.png
        url_parts = filename.split("__")                 # ['TalesRunner', 'itemimage', 'accback', 'xyz.png']
        url       = "https://talesrunner.b-cdn.net/" + "/".join(url_parts)
        dest      = IMAGES_DIR / filename
        url_map[url] = dest

    if TEST_URLS:
        url_map = dict(list(url_map.items())[:TEST_URLS])

    total = len(url_map)
    print(f"Found {total:,} unique images to download.\n")

    q = Queue(maxsize=MAX_THREADS * 4)
    threads = [
        threading.Thread(target=worker, args=(q, total), daemon=True)
        for _ in range(MAX_THREADS)
    ]
    for t in threads:
        t.start()

    t0 = time.time()
    for url, dest in url_map.items():
        q.put((url, dest))

    q.join()
    for _ in threads:
        q.put(None)
    for t in threads:
        t.join()

    elapsed = time.time() - t0
    print(f"\n\n{'─'*45}")
    print(f"✅  Done in {elapsed:.1f}s")
    print(f"   Downloaded : {_done:,}")
    print(f"   Skipped    : {_skipped:,}  (already existed)")
    print(f"   Failed     : {_failed:,}")
    if _failed_urls:
        log = Path("failed_downloads.txt")
        log.write_text("\n".join(_failed_urls), encoding="utf-8")
        print(f"   Failed URLs saved to: {log}")
    print(f"   Images dir : {IMAGES_DIR.resolve()}")

if __name__ == "__main__":
    main()