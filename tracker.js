#!/usr/bin/env node

/**
 * VS Code Time Tracker
 * Tracks time from when VS Code is open to when it's closed.
 * Zero npm dependencies. Minimal RAM usage.
 *
 * Usage:
 *   node tracker.js          → start tracking (runs in background)
 *   node tracker.js report   → show daily & weekly totals
 *   node tracker.js report --full → show all sessions ever
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// ─── Config ────────────────────────────────────────────────────────────────
const LOG_FILE = path.join(__dirname, 'vscode-sessions.json')
const POLL_INTERVAL_MS = 10_000 // check every 10 seconds (light on CPU)
// ───────────────────────────────────────────────────────────────────────────

// ── Detect OS and check if VS Code main window process is running ───────────
function isVSCodeRunning() {
    try {
        if (process.platform === 'win32') {
            const out = execSync('tasklist /FI "IMAGENAME eq Code.exe" /NH', {
                stdio: ['ignore', 'pipe', 'ignore'],
            }).toString()
            return out.toLowerCase().includes('code.exe')
        } else {
            // Linux/macOS: look for the main VS Code window process only.
            // The main process has --type=... absent (no --type flag),
            // while helper processes (renderer, GPU, extension-host) all have --type=xxx.
            // We use ps to read full command lines and filter accordingly.
            const out = execSync('ps -eo args', {
                stdio: ['ignore', 'pipe', 'ignore'],
                shell: true,
            }).toString()

            const lines = out.split('\n')
            const mainProcess = lines.find(line => {
                const trimmed = line.trim()

                // Must start with the exact code binary path (main process only)
                const isMainBinary =
                    /^\/usr\/share\/code\/code(\s|$)/.test(trimmed) ||
                    /^\/usr\/bin\/code(\s|$)/.test(trimmed)
                if (!isMainBinary) return false

                // Must NOT be a helper process
                if (/--type=/.test(trimmed)) return false

                // Must NOT be crashpad or other known sub-processes
                if (
                    /chrome_crashpad_handler|--crash-reporter|--extension-host/.test(
                        trimmed
                    )
                )
                    return false

                return true
            })

            return !!mainProcess
        }
    } catch {
        return false
    }
}

// ── Load / save sessions ────────────────────────────────────────────────────
function loadSessions() {
    if (!fs.existsSync(LOG_FILE)) return []
    try {
        return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'))
    } catch {
        return []
    }
}

function saveSessions(sessions) {
    fs.writeFileSync(LOG_FILE, JSON.stringify(sessions, null, 2))
}

// ── Tracking loop ───────────────────────────────────────────────────────────
function startTracking() {
    let sessionStart = null
    let wasRunning = false

    console.log('VS Code Time Tracker started.')
    console.log(
        `Polling every ${POLL_INTERVAL_MS / 1000}s — press Ctrl+C to stop.\n`
    )

    // Handle graceful shutdown: close open session on exit
    function shutdown() {
        if (sessionStart) {
            const sessions = loadSessions()
            sessions.push({
                start: sessionStart,
                end: new Date().toISOString(),
            })
            saveSessions(sessions)
            console.log('\nOpen session saved. Goodbye.')
        }
        process.exit(0)
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

    function tick() {
        const running = isVSCodeRunning()

        if (running && !wasRunning) {
            // VS Code just opened
            sessionStart = new Date().toISOString()
            console.log(
                `[${fmt(sessionStart)}] VS Code opened — session started.`
            )
        } else if (!running && wasRunning && sessionStart) {
            // VS Code just closed
            const end = new Date().toISOString()
            const sessions = loadSessions()
            sessions.push({ start: sessionStart, end })
            saveSessions(sessions)
            const dur = duration(sessionStart, end)
            console.log(`[${fmt(end)}] VS Code closed — session: ${dur}`)
            sessionStart = null
        }

        wasRunning = running
    }

    tick() // run immediately on start
    setInterval(tick, POLL_INTERVAL_MS)
}

// ── Report ──────────────────────────────────────────────────────────────────
function showReport(full = false) {
    const sessions = loadSessions()
    if (sessions.length === 0) {
        console.log('No sessions recorded yet.')
        return
    }

    const now = new Date()
    const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    )
    const startOfWeek = new Date(startOfToday)
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay()) // Sunday

    // Group sessions by day
    const byDay = {}
    for (const s of sessions) {
        const day = s.start.slice(0, 10) // "YYYY-MM-DD"
        if (!byDay[day]) byDay[day] = []
        byDay[day].push(s)
    }

    const sortedDays = Object.keys(byDay).sort()
    const daysToShow = full
        ? sortedDays
        : sortedDays.filter(d => new Date(d) >= startOfWeek)

    if (daysToShow.length === 0) {
        console.log('No sessions this week. Use --full to see all history.')
        return
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(
        '  VS Code Time Report' + (full ? ' (All Time)' : ' (This Week)')
    )
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    let weekTotal = 0

    for (const day of daysToShow) {
        const daySessions = byDay[day]
        let dayTotal = 0

        console.log(`  📅 ${formatDate(day)}`)
        for (const s of daySessions) {
            const ms = new Date(s.end) - new Date(s.start)
            dayTotal += ms
            const startTime = new Date(s.start).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
            })
            const endTime = new Date(s.end).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
            })
            console.log(`     ${startTime} → ${endTime}   (${msToHuman(ms)})`)
        }

        weekTotal += dayTotal
        console.log(`     Total: ${msToHuman(dayTotal)}\n`)
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(
        `  ${full ? 'All-time' : 'Week'} total: ${msToHuman(weekTotal)}`
    )
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function duration(start, end) {
    return msToHuman(new Date(end) - new Date(start))
}

function msToHuman(ms) {
    const totalMins = Math.floor(ms / 60000)
    const h = Math.floor(totalMins / 60)
    const m = totalMins % 60
    if (h === 0) return `${m}m`
    return `${h}h ${m}m`
}

function fmt(iso) {
    return new Date(iso).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    })
}

function formatDate(dateStr) {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString([], {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    })
}

// ── Entry point ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
if (args[0] === 'report') {
    showReport(args.includes('--full'))
} else {
    startTracking()
}
