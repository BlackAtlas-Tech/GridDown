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
    git pull
    echo "Updated to $(git describe --tags 2>/dev/null || git rev-parse --short HEAD)"
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

# ── Quick Launch ────────────────────────────────────────────────

# Full startup: wake lock + background server
gd-start() {
    termux-wake-lock 2>/dev/null || true
    nohup python3 "$GRIDDOWN_DIR/scripts/griddown-server.py" > /dev/null 2>&1 &
    echo "GridDown started on port 8080 (PID $!)"
}

# Full shutdown: stop server + release wake lock
gd-shutdown() {
    pkill -f 'griddown-server' 2>/dev/null || true
    termux-wake-unlock 2>/dev/null || true
    echo "GridDown shut down"
}
