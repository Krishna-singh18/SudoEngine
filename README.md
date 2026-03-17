# 🧩 SUDOKU — Solver Platform

A production-grade Sudoku web application featuring a **C++ solving engine**, **Node.js REST API**, and a **Vanilla JS frontend** with advanced UX.

---

## Architecture

```
User (Browser) → Fetch API → Express Server → C++ Solver (child_process) → JSON Response → UI Animation
```

---

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Frontend    | HTML5, CSS3, Vanilla JS (Modules)   |
| Backend     | Node.js + Express                   |
| Engine      | C++ (g++ -O2, Pure Backtracking)    |
| Storage     | localStorage (puzzle history)       |

---

## Features

### Frontend
- ✅ Dynamic 9×9 grid rendered in JS
- ✅ Dark/Light theme toggle
- ✅ Click + keyboard input (1–9, arrows)
- ✅ Row/Column/Box highlight on cell select
- ✅ Real-time conflict validation + error highlighting
- ✅ User-entered numbers highlighted in accent color
- ✅ Pencil/Notes mode toggle
- ✅ Undo / Redo (100-step deep)
- ✅ Live timer
- ✅ Step-by-step solver animation
- ✅ Hint system (reveals one correct cell)
- ✅ Easy / Medium / Hard difficulty
- ✅ Puzzle history drawer (localStorage)
- ✅ Completion modal with stats

### Backend
- ✅ `POST /api/solve` — Solve any valid board
- ✅ `GET /api/generate?difficulty=1|2|3` — Generate unique puzzle
- ✅ `POST /api/hint` — Return single correct move
- ✅ Solver timeout protection (5s)
- ✅ Invalid board detection (value range 0–9)

### C++ Engine
- ✅ Pure backtracking algorithm — no bitmasks, no char conversion
- ✅ `int board[9][9]` — `0` for empty, `1–9` for filled
- ✅ Single `isSafe()` checks row, column, and 3×3 box in one loop
- ✅ Randomized puzzle generation with uniqueness guarantee
- ✅ `countSolutions()` stops at 2 — fast uniqueness check
- ✅ Supports `solve` / `generate` / `hint` modes via stdin
- ✅ Input validation with descriptive JSON error messages

---

## Quick Start

### 1. Compile the C++ solver

```bash
g++ -O2 -std=c++17 -o cpp/solver cpp/solver.cpp
```

### 2. Install Node.js dependencies

```bash
npm install
```

### 3. Start the server

```bash
npm start
```

### 4. Open in browser

```
http://localhost:3000
```

---

## API Reference

### `POST /api/solve`
```json
Request:  { "board": [[5,3,0,...], ...] }
Response: { "solved": true, "board": [[...]], "steps": 4208, "timeMs": 0.393 }
```

### `GET /api/generate?difficulty=1`
```json
Response: { "puzzle": [[...]], "solution": [[...]], "difficulty": 1 }
```

### `POST /api/hint`
```json
Request:  { "board": [[...]] }
Response: { "hint": { "row": 0, "col": 2, "num": 4 } }
```

---

## Board Format

The engine uses a flat integer convention throughout the entire stack:

| Value | Meaning     |
|-------|-------------|
| `0`   | Empty cell  |
| `1–9` | Filled cell |

No `char`, no `'.'`, no string conversion anywhere — JS, Node.js, and C++ all speak the same `int` format.

---

## Project Structure

```
sudoku-solver/
├── frontend/
│   ├── index.html       # SPA entry point
│   ├── style.css        # Full design system
│   └── script.js        # Modular game engine (6 modules)
├── backend/
│   └── server.js        # Express MVC API
├── cpp/
│   ├── solver.cpp       # C++ engine source
│   └── solver           # Compiled binary (after build)
├── package.json
└── README.md
```

---

## C++ Engine — How It Works

### `isSafe(row, col, num)`
Checks row, column, and 3×3 box in a single loop using the formula:
```cpp
board[3*(row/3)+i/3][3*(col/3)+i%3]  // box cell access
```

### `solve()`
Standard recursive backtracking — scans top-left to bottom-right, tries 1–9 at each empty cell, backtracks on failure.

### `solveRandom(rng)`
Same as `solve()` but shuffles candidates before trying, producing a different valid completed grid each time. Used to seed puzzle generation.

### `countSolutions(limit)`
Same backtracking structure, counts solutions up to `limit` (always called with `2`). If result is `1`, the puzzle has a unique solution.

### `generatePuzzle(difficulty)`
1. Fill blank board with `solveRandom()`
2. Shuffle all 81 cells randomly
3. Remove cells one by one — restore if `countSolutions(2) != 1`
4. Stop after removing target count (43 / 51 / 58 for Easy / Medium / Hard)

---

## Engine Performance

| Difficulty | Avg. Solve Time | Avg. Steps  |
|------------|-----------------|-------------|
| Easy       | ~0.4ms          | ~1,000–5,000|
| Medium     | ~1ms            | ~5,000–20,000|
| Hard       | ~2–6ms          | ~20,000–60,000|

The engine uses pure recursive backtracking with a single `isSafe()` scan per placement (27 comparisons per call — 9 for row, 9 for column, 9 for box).
