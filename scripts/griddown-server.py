#!/usr/bin/env python3
"""
GridDown HTTP Server
Serves the GridDown PWA with proper cache-control headers.

The browser heuristically caches files based on Last-Modified when no
Cache-Control header is present. This causes sw.js to be served from
browser HTTP cache even after git pull delivers a new version. The
browser compares the cached sw.js against itself, sees no change, and
never triggers the install event — so skipWaiting, cache purging, and
update notifications are all dead code.

This server adds Cache-Control: no-cache, no-store to sw.js and
manifest.json so the browser always fetches fresh copies from disk.
All other files are served normally with standard caching.

Usage:
    python3 scripts/griddown-server.py [--port 8080] [--dir ~/GridDown]

BlackAtlas LLC — Navigate When Infrastructure Fails
"""

import http.server
import os
import sys
import argparse

# Files that must never be served from browser HTTP cache
NO_CACHE_FILES = {'sw.js', 'manifest.json'}

# File extensions that should get short revalidation cache headers.
# Without explicit Cache-Control, the browser heuristically caches files
# for ~10% of (now - Last-Modified), which can be hours or days for files
# that haven't changed in a while. After 'griddown-update' (git pull),
# the new sw.js install handler uses fetch({ cache: 'reload' }) to bust
# the browser cache, but the belt-and-suspenders approach is to also tell
# the browser to always revalidate these files with the server.
REVALIDATE_EXTENSIONS = {'.js', '.css', '.html'}


class GridDownHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP handler that injects cache-control headers for critical PWA files."""

    def end_headers(self):
        # Get the basename of the requested path
        basename = os.path.basename(self.path.split('?')[0].split('#')[0])
        _, ext = os.path.splitext(basename)

        if basename in NO_CACHE_FILES:
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        elif ext in REVALIDATE_EXTENSIONS:
            # Allow caching but force revalidation on every request.
            # The server responds 304 Not Modified if the file hasn't changed
            # (fast), or 200 with new content if it has (correct).
            self.send_header('Cache-Control', 'no-cache')

        super().end_headers()

    # Suppress per-request console logging for cleaner output
    def log_message(self, format, *args):
        # Only log errors (4xx/5xx) and startup, not every 200
        status = args[1] if len(args) > 1 else ''
        if isinstance(status, str) and status.startswith(('4', '5')):
            super().log_message(format, *args)


def main():
    parser = argparse.ArgumentParser(description='GridDown HTTP Server')
    parser.add_argument('--port', '-p', type=int, default=8080,
                        help='Port to serve on (default: 8080)')
    parser.add_argument('--dir', '-d', type=str, default=None,
                        help='Directory to serve (default: script parent directory)')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='Log all requests (not just errors)')
    args = parser.parse_args()

    # Determine serve directory
    if args.dir:
        serve_dir = os.path.expanduser(args.dir)
    else:
        # Default: parent of scripts/ directory (i.e., GridDown root)
        serve_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    if not os.path.isfile(os.path.join(serve_dir, 'sw.js')):
        print(f"Error: sw.js not found in {serve_dir}")
        print("Make sure you're serving the GridDown directory.")
        sys.exit(1)

    os.chdir(serve_dir)

    if args.verbose:
        # Restore default logging
        GridDownHandler.log_message = http.server.SimpleHTTPRequestHandler.log_message

    server = http.server.HTTPServer(('0.0.0.0', args.port), GridDownHandler)

    print(f"GridDown server v1.0")
    print(f"Serving: {serve_dir}")
    print(f"URL:     http://localhost:{args.port}")
    print(f"")
    print(f"Cache-Control: no-cache, no-store applied to: {', '.join(sorted(NO_CACHE_FILES))}")
    print(f"Cache-Control: no-cache (revalidate) applied to: {', '.join(sorted(REVALIDATE_EXTENSIONS))}")
    print(f"Press Ctrl+C to stop.")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.server_close()


if __name__ == '__main__':
    main()
