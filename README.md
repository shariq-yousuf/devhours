# devhours

A lightweight Node.js script that automatically tracks how long VS Code is open and which project you're working on — no typing required, no heavy dependencies, minimal RAM usage.

Built for freelancers and developers who bill by the hour and want accurate time logs without manually starting and stopping timers.

---

## How it works

- Polls every 10 seconds using native OS process commands
- Detects when VS Code opens and closes
- Reads VS Code's internal `storage.json` to know which project is active
- Detects project switches mid-session and logs each separately
- Saves everything to a local `vscode-sessions.json` file

---

## Requirements

- Node.js (no npm install needed — zero dependencies)
- Linux or macOS (Windows support included via `tasklist`)

---

## Usage

**Start tracking**

```bash
node tracker.js
```

**This week's report**

```bash
node tracker.js report
```

**All-time report**

```bash
node tracker.js report --full
```

**Reset billing period** (archive sessions so tracking starts fresh)

A confirmation prompt will appear before any data is archived.

```bash
node tracker.js reset                          # archive all sessions
node tracker.js reset --project my-app         # archive only one project
```

Archived files are saved as `vscode-sessions-<timestamp>.json` or `vscode-sessions-<project>-<timestamp>.json`.

---

## Sample report

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VS Code Time Report (This Week)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  📅 Friday, May 30, 2026
     [my-app]      09:15 → 11:00  (1h 45m)
     [api-server]  11:00 → 12:30  (1h 30m)
     Day total: 3h 15m

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Project breakdown
──────────────────────────────────────────────────
  my-app                  5h 20m  ████████████
  api-server              2h 10m  █████
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TOTAL                   7h 30m
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Data

Sessions are stored locally in `vscode-sessions.json` next to the script. Nothing is sent anywhere.

---

## Run on system startup (Linux) — systemd service

Start the tracker automatically as a background daemon with systemd.

1. **Create a service file** at `/etc/systemd/system/devhours.service`:

    ```ini
    [Unit]
    Description=VS Code Time Tracker (devhours)
    After=network.target

    [Service]
    ExecStart=/usr/local/bin/node /path/to/devhours/tracker.js
    Restart=on-failure
    RestartSec=5
    User=<YOUR_USERNAME>

    [Install]
    WantedBy=default.target
    ```

    Replace `<YOUR_USERNAME>` with your actual username (run `whoami`).  
    **Important**: systemd doesn't use your shell's PATH. If Node is installed via nvm, find the full path with `which node` and use it in `ExecStart`.

2. **Enable and start the service**:

    ```bash
    sudo systemctl daemon-reload
    sudo systemctl enable devhours.service
    sudo systemctl start devhours.service
    ```

3. **Check status**:

    ```bash
    sudo systemctl status devhours.service
    ```

4. **View logs**:

    ```bash
    sudo journalctl -u devhours.service -f
    ```

5. **Stop / disable later**:
    ```bash
    sudo systemctl stop devhours.service
    sudo systemctl disable devhours.service
    ```

The service will auto-start on boot, survive logout, and restart on failure.

---

## Global command

Create a wrapper script at `~/.local/bin/dh` so you can run commands from anywhere:

```bash
#!/bin/bash
exec node /path/to/devhours/tracker.js "$@"
```

Make it executable:

```bash
chmod +x ~/.local/bin/dh
```

Now from any terminal:

```bash
dh                     # start tracking
dh report              # this week's report
dh report --full       # all-time report
dh reset               # archive all sessions (prompts for confirmation)
dh reset --project foo # archive only one project (prompts for confirmation)
```

---

## License

MIT
