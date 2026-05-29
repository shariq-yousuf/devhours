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

## Run on system startup (Linux)

Add this to your `~/.bashrc` or `~/.profile` to auto-start the tracker when you log in:

```bash
node /path/to/tracker.js &
```

Or create a systemd service for a cleaner background process.

---

## License

MIT