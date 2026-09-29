# Nexus — Personal Operating System

Nexus puts tasks, notes, calendar, habits, focus, goals, journal, finance and analytics in one app. It stores everything in your browser and needs no backend or account.

## Run

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # typecheck + production build → dist/
npm run preview    # serve the production build
npm run smoke      # headless-Chromium smoke test of every page (needs Playwright)
```

The root URL opens the marketing page; **Open Nexus** (or any `#/dashboard`-style link) opens the app. The first launch loads a demo workspace so the charts have data. To start empty, go to **Settings → Erase everything**.

To refresh the product screenshots used on the marketing page: `npm run build && node scripts/shots.mjs && npm run build`.

## Design

The look is deliberately quiet: Inter set tight, a neutral light palette by default (Apple-style dark theme available), ink-black pill buttons, blue text links, frosted chrome, hairline borders instead of heavy shadows, and colour used only for meaning (priority, project dots, overdue). No emoji, gradients or glow in the product UI.

## Features

| Module | Highlights |
| --- | --- |
| **Dashboard** | Daily score out of 100 (tasks, focus, habits, journal), today's tasks and overdue tasks with one-click reschedule, live schedule with a "NOW" marker, habit check-ins, mood picker, weekly chart, insights, goals, finance snapshot, activity feed |
| **Tasks** | List, Kanban and Table views. Kanban has drag-and-drop ordering and a WIP warning. Group by due date, project, priority or status. Sort, fuzzy filter, filter by project, priority or tag. Multi-select (Ctrl/⌘-click) for bulk complete, reschedule, prioritize, move or delete. Subtasks, Markdown descriptions, estimates vs. tracked time, recurring tasks (daily, weekdays, weekly, monthly) that make the next copy when you complete one, undo on delete and complete, project manager |
| **Natural-language quick add** (`N`) | `Pay rent tomorrow 9am !high #bills +Home ~15m every month` fills in the date, time, priority, tag, project (created if missing), estimate and recurrence, with a live chip preview. Press Tab to switch between Task, Event and Note |
| **Notes** | Markdown editor with edit, split and preview modes, a formatting toolbar and shortcuts (⌘B/I/K). Lists continue when you press Enter. `[[Wiki links]]` show backlinks, and clicking a link to a missing note creates it. `#tags` are picked up automatically. Checklists can be ticked in the preview. Also: callouts, tables, code blocks, folders, pinning, 5 templates, outline, word count and reading time, `.md` export, and a force-directed **graph view** of how notes link |
| **Calendar** | Month, Week (time grid, side-by-side overlapping events, current-time line) and Agenda views. Drag tasks or events onto a day or hour to reschedule. Click a day or slot to create an event. Tasks with due dates show up inline |
| **Habits** | Target counts per day (e.g. 8 glasses of water), chosen weekdays, current and best streaks, 30-day consistency, 20-week heatmap per habit, completion trend chart, archive |
| **Focus** | Pomodoro timer that keeps running when you change pages, with a mini timer in the sidebar and a countdown in the tab title. Link a session to a task and the time counts toward it. Auto-cycles between short and long breaks. Chime and desktop notifications. Ambient noise made in the browser (white, pink, brown, rain) with a volume control. Zen full-screen mode, daily goal, session log |
| **Goals** | Three ways to track progress: automatically from a project's completed tasks, automatically from focus minutes, or by manual count. Shows deadline and an on-track / behind status |
| **Journal** | Mood and energy, a daily prompt, a gratitude field, a mood-colored month calendar, a 30-day mood chart and the mood distribution |
| **Finance** | Income and expense transactions, category budgets with an "expected by today" marker and over-budget warnings, spending donut, 6-month cash flow, daily spending bars, month-over-month change, savings rate, month-end forecast, CSV export |
| **Analytics** | Compare 7, 30 or 90 days against the previous period. Charts for tasks and focus, a 26-week activity heatmap, score trend, breakdowns by weekday, hour and project, habit consistency, estimation accuracy, and generated insights (e.g. how mood relates to focus) |
| **Landing page** | Frosted nav, sculpted-ribbon hero, device mockup with real product screenshots, tabbed feature grid on a soft colour mesh, dark “how it works” section, split product tiles, privacy and keyboard sections, footer |
| **Settings** | Light, dark or system theme. Accent color from presets or a custom color. Density, reduced motion, week start, currency, timer lengths, sounds and notifications. JSON backup export and import, load demo data, erase everything |

### Global
- **Command palette** (`Ctrl/⌘ K` or `/`): fuzzy search across tasks, notes, events, projects and habits, plus every action and page.
- **Keyboard shortcuts**: `N` new, `G` then `D/T/N/C/H/F/G/J/M/A/S` to go to a page, `[` to toggle the sidebar, `?` for help, `Space` to start or pause the timer.
- Pages are lazy-loaded, and the layout adapts to phone screens with an off-canvas sidebar. Also: an accessible focus-trapped modal, toasts with Undo, and an error boundary.

## Architecture

```
src/
  types.ts            data model
  store/data.ts       Zustand store + localStorage persistence, all domain actions
  store/ui.ts         UI state (routing, modals, toasts, timer state)
  lib/                date utils, NLP parser, markdown renderer, analytics,
                      timer engine, Web Audio (chime/noise), seed data
  components/         Shell, CommandPalette, QuickAdd, Task/Event modals,
                      SVG charts (area, bar, donut, ring, heatmap, sparkline), UI kit, icons
  pages/              one file per module (lazy-loaded), incl. Landing
  styles.css          base component styles
  theme.css           design-language refinement layer
  landing.css         marketing page
public/shots/         product screenshots (generated by scripts/shots.mjs)
```

Dependencies are React, Zustand and Vite only. Charts, icons, the Markdown renderer, the date parser and audio are all written for this project. The Markdown renderer escapes HTML before parsing, so rendered content is XSS-safe.
