#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# GridDown Shell Aliases for Termux
# Source this file from ~/.bashrc or run scripts/termux-setup.sh
# BlackAtlas LLC — Navigate When Infrastructure Fails
# ──────────────────────────────────────────────────────────────

# Resolve GridDown install directory (where this file lives)
GRIDDOWN_DIR="${GRIDDOWN_DIR:-$HOME/GridDown}"

# ── Server ──────────────────────────────────────────────────────

# Start GridDown server (foreground)
alias gd='python3 "$GRIDDOWN_DIR/scripts/griddown-server.py"'

# Start GridDown server (background)
gd-bg() {
    nohup python3 "$GRIDDOWN_DIR/scripts/griddown-server.py" > /dev/null 2>&1 &
    echo "GridDown server started on port 8080 (PID $!)"
}

# Stop GridDown server
gd-stop() {
    if pkill -f 'griddown-server' 2>/dev/null; then
        echo "GridDown server stopped"
    else
        echo "Server not running"
    fi
}

# Check if server is running
gd-status() {
    local pid
    pid=$(pgrep -f 'griddown-server' 2>/dev/null | head -1)
    if [ -n "$pid" ]; then
        echo "✓ GridDown server running (PID $pid)"
    else
        echo "✗ GridDown server not running"
    fi
}

# Restart server
gd-restart() {
    pkill -f 'griddown-server' 2>/dev/null
    sleep 1
    nohup python3 "$GRIDDOWN_DIR/scripts/griddown-server.py" > /dev/null 2>&1 &
    echo "GridDown server restarted (PID $!)"
}

# ── Updates ─────────────────────────────────────────────────────

# Pull latest from GitHub and show version
griddown-update() {
    cd "$GRIDDOWN_DIR" || return
    local old_ver new_ver server_changed
    old_ver=$(grep "CACHE_NAME" sw.js 2>/dev/null | head -1 | grep -oP "v[\d.]+")
    # Track if server script changes (needs restart for new cache headers)
    local old_server_hash
    old_server_hash=$(md5sum scripts/griddown-server.py 2>/dev/null | cut -d' ' -f1)
    git pull
    new_ver=$(grep "CACHE_NAME" sw.js 2>/dev/null | head -1 | grep -oP "v[\d.]+")
    local new_server_hash
    new_server_hash=$(md5sum scripts/griddown-server.py 2>/dev/null | cut -d' ' -f1)
    echo "Updated to $(git describe --tags 2>/dev/null || git rev-parse --short HEAD)"
    if [ "$old_ver" != "$new_ver" ] && [ -n "$new_ver" ]; then
        echo "Cache: $old_ver → $new_ver"
        echo "App will auto-update within ~3 minutes, or tap 'Refresh Now' in the toast."
    fi
    if [ "$old_server_hash" != "$new_server_hash" ] && pgrep -f 'griddown-server' >/dev/null 2>&1; then
        echo ""
        echo "⚠ Server script changed — restarting server..."
        gd-restart
    fi
}

# Show last 10 commits
alias gd-log='cd "$GRIDDOWN_DIR" && git log --oneline -10'

# Show current version
gd-version() {
    cd "$GRIDDOWN_DIR" || return
    local ver date_str
    ver=$(git describe --tags 2>/dev/null || git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    date_str=$(git log -1 --format=%ci 2>/dev/null | cut -d ' ' -f1 || echo "unknown")
    echo "GridDown $ver ($date_str)"
}

# Force update (discard local changes)
gd-force-update() {
    cd "$GRIDDOWN_DIR" || return
    git fetch origin
    git reset --hard origin/main
    echo "Force-updated to $(git describe --tags 2>/dev/null || git rev-parse --short HEAD)"
}

# ── Disk & Maintenance ──────────────────────────────────────────

# Show GridDown disk usage
alias gd-size='du -sh "$GRIDDOWN_DIR"'

# Clear untracked files
alias gd-clean='cd "$GRIDDOWN_DIR" && git clean -fd && echo "Cleaned untracked files"'

# ── Wake Lock ───────────────────────────────────────────────────

# Quick wake lock toggle
alias wl='termux-wake-lock 2>/dev/null && echo "Wake lock acquired" || echo "Wake lock: termux-wake-lock not available (not in Termux?)"'
alias wlu='termux-wake-unlock 2>/dev/null && echo "Wake lock released" || echo "Wake unlock: termux-wake-unlock not available (not in Termux?)"'

# ── Auto-Update Watcher ─────────────────────────────────────────

# Background git fetch + pull loop.
# After pull, the service worker's 60-second poll detects the new
# sw.js on disk, installs it into a 'waiting' state, and GridDown's
# UpdateModule shows a toast: "Refresh Now / Later". The user
# decides when to apply — no forced reload in the field.
#
# Usage:
#   gd-watch            Start watcher (default: check every 15 min)
#   gd-watch 5          Check every 5 minutes
#   gd-watch-stop       Stop the watcher
#   gd-watch-status     Check if watcher is running

GD_WATCH_PIDFILE="$HOME/.griddown-watch.pid"
GD_WATCH_LOG="$HOME/griddown-watch.log"

gd-watch() {
    local interval_min="${1:-15}"
    local interval_sec=$((interval_min * 60))

    # Check if already running
    if [ -f "$GD_WATCH_PIDFILE" ] && kill -0 "$(cat "$GD_WATCH_PIDFILE")" 2>/dev/null; then
        echo "⚠ Watcher already running (PID $(cat "$GD_WATCH_PIDFILE"))"
        echo "  Stop it first with: gd-watch-stop"
        return 1
    fi

    # Verify git repo exists
    if [ ! -d "$GRIDDOWN_DIR/.git" ]; then
        echo "✗ Not a git repository: $GRIDDOWN_DIR"
        echo "  Clone with: git clone <repo-url> $GRIDDOWN_DIR"
        return 1
    fi

    # Launch background loop
    (
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Watcher started (interval: ${interval_min}m)" >> "$GD_WATCH_LOG"

        while true; do
            sleep "$interval_sec"

            cd "$GRIDDOWN_DIR" || continue

            # Fetch from remote (needs network — fails silently if offline)
            if ! git fetch origin 2>/dev/null; then
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] Fetch failed (offline?)" >> "$GD_WATCH_LOG"
                continue
            fi

            # Compare local HEAD to remote
            local_head=$(git rev-parse HEAD 2>/dev/null)
            remote_head=$(git rev-parse origin/main 2>/dev/null || git rev-parse origin/master 2>/dev/null)

            if [ -z "$remote_head" ] || [ "$local_head" = "$remote_head" ]; then
                continue  # No update — stay quiet
            fi

            # Count commits behind
            behind=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "?")
            summary=$(git log --oneline HEAD..origin/main 2>/dev/null | head -3)

            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Update found: $behind commit(s) behind" >> "$GD_WATCH_LOG"

            # Pull the update (fast-forward only — won't break local changes)
            if git pull --ff-only origin main 2>/dev/null; then
                new_ver=$(git describe --tags 2>/dev/null || git rev-parse --short HEAD)
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pulled update → $new_ver" >> "$GD_WATCH_LOG"

                # Send Android notification via Termux (if available)
                if command -v termux-notification > /dev/null 2>&1; then
                    termux-notification \
                        --id griddown-update \
                        --title "GridDown Update Applied" \
                        --content "$behind commit(s) pulled → $new_ver. Open GridDown to refresh." \
                        --priority high \
                        --vibrate 200 \
                        --led-color 3b82f6 \
                        2>/dev/null
                fi
            else
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pull failed (local changes?)" >> "$GD_WATCH_LOG"

                # Notify about failed pull
                if command -v termux-notification > /dev/null 2>&1; then
                    termux-notification \
                        --id griddown-update \
                        --title "GridDown Update Available" \
                        --content "$behind commit(s) available but pull failed. Run: gd-force-update" \
                        --priority default \
                        2>/dev/null
                fi
            fi
        done
    ) &

    local pid=$!
    echo "$pid" > "$GD_WATCH_PIDFILE"
    disown "$pid" 2>/dev/null

    echo "✓ Update watcher started (PID $pid)"
    echo "  Checking every ${interval_min} minutes"
    echo "  Log: $GD_WATCH_LOG"
    echo "  Stop with: gd-watch-stop"
}

gd-watch-stop() {
    if [ -f "$GD_WATCH_PIDFILE" ]; then
        local pid
        pid=$(cat "$GD_WATCH_PIDFILE")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null
            echo "✓ Watcher stopped (PID $pid)"
        else
            echo "Watcher was not running (stale PID file)"
        fi
        rm -f "$GD_WATCH_PIDFILE"
    else
        echo "Watcher not running"
    fi
}

gd-watch-status() {
    if [ -f "$GD_WATCH_PIDFILE" ] && kill -0 "$(cat "$GD_WATCH_PIDFILE")" 2>/dev/null; then
        echo "✓ Watcher running (PID $(cat "$GD_WATCH_PIDFILE"))"
        echo "  Last log entries:"
        tail -5 "$GD_WATCH_LOG" 2>/dev/null | sed 's/^/    /'
    else
        echo "✗ Watcher not running"
        [ -f "$GD_WATCH_PIDFILE" ] && rm -f "$GD_WATCH_PIDFILE"
    fi
}

# View watcher log
alias gd-watch-log='tail -30 "$HOME/griddown-watch.log" 2>/dev/null || echo "No log file"'

# Full startup: wake lock + background server + update watcher
gd-start() {
    termux-wake-lock 2>/dev/null || true
    nohup python3 "$GRIDDOWN_DIR/scripts/griddown-server.py" > /dev/null 2>&1 &
    echo "GridDown started on port 8080 (PID $!)"
    # Start update watcher if not already running
    if [ ! -f "$GD_WATCH_PIDFILE" ] || ! kill -0 "$(cat "$GD_WATCH_PIDFILE" 2>/dev/null)" 2>/dev/null; then
        gd-watch 15
    fi
}

# Full shutdown: stop server + watcher + release wake lock
gd-shutdown() {
    pkill -f 'griddown-server' 2>/dev/null || true
    gd-watch-stop 2>/dev/null || true
    termux-wake-unlock 2>/dev/null || true
    echo "GridDown shut down"
}
