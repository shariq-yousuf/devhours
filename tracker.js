#!/usr/bin/env node

/**
 * VS Code Time Tracker
 * Tracks time per project by reading VS Code's active workspace from storage.json.
 * Detects project switches mid-session and logs each separately.
 * Zero npm dependencies. Minimal RAM usage.
 *
 * Usage:
 *   node tracker.js            → start tracking
 *   node tracker.js report     → this week: hours per project + total
 *   node tracker.js report --full → all-time report
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

// ─── Config ─────────────────────────────────────────────────────────────────
const LOG_FILE = path.join(__dirname, 'vscode-sessions.json')
const POLL_INTERVAL_MS = 10_000 // every 10 seconds

// VS Code's storage.json — tracks recently active workspace
const VSCODE_STORAGE = path.join(
    os.homedir(),
    '.config/Code/User/globalStorage/storage.json'
)
// ────────────────────────────────────────────────────────────────────────────

// ── Check if VS Code main window is running ──────────────────────────────────
function isVSCodeRunning() {
    try {
        if (process.platform === 'win32') {
            const out = execSync('tasklist /FI "IMAGENAME eq Code.exe" /NH', {
                stdio: ['ignore', 'pipe', 'ignore'],
            }).toString()
            return out.toLowerCase().includes('code.exe')
        } else {
            const out = execSync('ps -eo args', {
                stdio: ['ignore', 'pipe', 'ignore'],
                shell: true,
            }).toString()
            return out.split('\n').some(line => {
                const t = line.trim()
                if (
                    !/^\/usr\/share\/code\/code(\s|$)|^\/usr\/bin\/code(\s|$)/.test(
                        t
                    )
                )
                    return false
                if (/--type=|chrome_crashpad_handler/.test(t)) return false
                return true
            })
        }
    } catch {
        return false
    }
}

// ── Read active project from VS Code's storage.json ──────────────────────────
function getActiveProject() {
    try {
        const raw = fs.readFileSync(VSCODE_STORAGE, 'utf8')
        const data = JSON.parse(raw)

        // VS Code stores last active workspace/folder here
        const entry =
            data?.windowsState?.lastActiveWindow?.folder ||
            data?.windowsState?.lastActiveWindow?.workspace?.configPath ||
            data?.windowsState?.openedWindows?.[0]?.folder ||
            null

        if (!entry) return 'unknown'

        // entry is a URI like "file:///home/user/projects/my-app"
        const decoded = decodeURIComponent(entry.replace('file://', ''))
        return path.basename(decoded) || decoded
    } catch {
        return 'unknown'
    }
}

// ── Load / save sessions ─────────────────────────────────────────────────────
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

// ── Flush current segment to disk ────────────────────────────────────────────
function flushSegment(sessions, start, project) {
    const end = new Date().toISOString()
    sessions.push({ project, start, end })
    saveSessions(sessions)
    return end
}

// ── Tracking loop ─────────────────────────────────────────────────────────────
function startTracking() {
    let segmentStart = null
    let currentProject = null
    let wasRunning = false

    console.log('VS Code Time Tracker started (with project tracking).')
    console.log(
        `Polling every ${POLL_INTERVAL_MS / 1000}s — press Ctrl+C to stop.\n`
    )

    function shutdown() {
        if (segmentStart) {
            const sessions = loadSessions()
            flushSegment(sessions, segmentStart, currentProject)
            console.log('\nOpen segment saved. Goodbye.')
        }
        process.exit(0)
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

    function tick() {
        const running = isVSCodeRunning()

        if (running && !wasRunning) {
            // VS Code just opened
            segmentStart = new Date().toISOString()
            currentProject = getActiveProject()
            console.log(
                `[${fmt(segmentStart)}] Opened — project: ${currentProject}`
            )
        } else if (running && wasRunning) {
            // VS Code still open — check for project switch
            const project = getActiveProject()
            if (project !== currentProject && segmentStart) {
                const sessions = loadSessions()
                const end = flushSegment(sessions, segmentStart, currentProject)
                console.log(
                    `[${fmt(end)}] Switched: ${currentProject} → ${project} (${duration(segmentStart, end)})`
                )
                segmentStart = new Date().toISOString()
                currentProject = project
            }
        } else if (!running && wasRunning && segmentStart) {
            // VS Code just closed
            const sessions = loadSessions()
            const end = flushSegment(sessions, segmentStart, currentProject)
            console.log(
                `[${fmt(end)}] Closed — ${currentProject}: ${duration(segmentStart, end)}`
            )
            segmentStart = null
            currentProject = null
        }

        wasRunning = running
    }

    tick()
    setInterval(tick, POLL_INTERVAL_MS)
}

// ── Report ────────────────────────────────────────────────────────────────────
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
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay())

    const filtered = full
        ? sessions
        : sessions.filter(s => new Date(s.start) >= startOfWeek)

    if (filtered.length === 0) {
        console.log('No sessions this week. Use --full to see all history.')
        return
    }

    // Group by day
    const byDay = {}
    for (const s of filtered) {
        const day = s.start.slice(0, 10)
        if (!byDay[day]) byDay[day] = []
        byDay[day].push(s)
    }

    // Tally per project across all filtered sessions
    const projectTotals = {}
    for (const s of filtered) {
        const ms = new Date(s.end) - new Date(s.start)
        projectTotals[s.project] = (projectTotals[s.project] || 0) + ms
    }

    const W = 50
    const line = '━'.repeat(W)

    console.log(`\n${line}`)
    console.log(`  VS Code Time Report${full ? ' (All Time)' : ' (This Week)'}`)
    console.log(`${line}\n`)

    let grandTotal = 0

    for (const day of Object.keys(byDay).sort()) {
        const daySessions = byDay[day]
        let dayTotal = 0
        console.log(`  📅 ${formatDate(day)}`)

        for (const s of daySessions) {
            const ms = new Date(s.end) - new Date(s.start)
            dayTotal += ms
            const t1 = new Date(s.start).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
            })
            const t2 = new Date(s.end).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
            })
            console.log(
                `     [${s.project}]  ${t1} → ${t2}  (${msToHuman(ms)})`
            )
        }

        grandTotal += dayTotal
        console.log(`     Day total: ${msToHuman(dayTotal)}\n`)
    }

    // Per-project summary
    console.log(`${line}`)
    console.log(`  Project breakdown`)
    console.log(`${'─'.repeat(W)}`)
    for (const [proj, ms] of Object.entries(projectTotals).sort(
        (a, b) => b[1] - a[1]
    )) {
        const bar = '█'.repeat(Math.round((ms / grandTotal) * 20))
        console.log(`  ${proj.padEnd(20)} ${msToHuman(ms).padStart(8)}  ${bar}`)
    }
    console.log(`${line}`)
    console.log(`  ${'TOTAL'.padEnd(20)} ${msToHuman(grandTotal).padStart(8)}`)
    console.log(`${line}\n`)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function duration(start, end) {
    return msToHuman(new Date(end) - new Date(start))
}

function msToHuman(ms) {
    const totalMins = Math.floor(ms / 60000)
    const h = Math.floor(totalMins / 60)
    const m = totalMins % 60
    return h === 0 ? `${m}m` : `${h}h ${m}m`
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

// ── Entry point ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
if (args[0] === 'report') {
    showReport(args.includes('--full'))
} else {
    startTracking()
}
