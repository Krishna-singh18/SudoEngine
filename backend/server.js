/**
 * Sudoku Solver — Express Backend
 * Architecture: MVC-style, modular handlers, C++ engine via child_process
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawnSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const SOLVER_PATH = path.join(__dirname, '../cpp/solver');
const SOLVER_TIMEOUT_MS = 5000;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── Engine Wrapper ──────────────────────────────────────────────────────────
function runSolver(input) {
  const result = spawnSync(SOLVER_PATH, [], {
    input,
    encoding: 'utf8',
    timeout: SOLVER_TIMEOUT_MS,
  });

  if (result.error) {
    if (result.error.code === 'ETIMEDOUT') {
      throw { status: 408, message: 'Solver timed out' };
    }
    throw { status: 500, message: `Solver error: ${result.error.message}` };
  }

  if (result.status !== 0) {
    throw { status: 500, message: `Solver exited with code ${result.status}: ${result.stderr}` };
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    throw { status: 500, message: `Invalid solver output: ${result.stdout}` };
  }
}

// ─── Validation ──────────────────────────────────────────────────────────────
function validateBoard(board) {
  if (!Array.isArray(board) || board.length !== 9) return 'Board must be 9 rows';
  for (let r = 0; r < 9; r++) {
    if (!Array.isArray(board[r]) || board[r].length !== 9) return `Row ${r} must have 9 columns`;
    for (let c = 0; c < 9; c++) {
      const v = board[r][c];
      if (!Number.isInteger(v) || v < 0 || v > 9) return `Invalid value at [${r},${c}]: ${v}`;
    }
  }
  return null;
}

function boardToInput(board) {
  return board.map(row => row.join(' ')).join(' ');
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// POST /api/solve
app.post('/api/solve', (req, res) => {
  const { board } = req.body;
  const err = validateBoard(board);
  if (err) return res.status(400).json({ error: err });

  try {
    const input = `solve ${boardToInput(board)}`;
    const data = runSolver(input);
    if (data.error) return res.status(422).json({ error: data.error });
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Internal error' });
  }
});

// GET /api/generate?difficulty=1|2|3
app.get('/api/generate', (req, res) => {
  const difficulty = parseInt(req.query.difficulty) || 1;
  if (![1, 2, 3].includes(difficulty)) {
    return res.status(400).json({ error: 'Difficulty must be 1 (easy), 2 (medium), or 3 (hard)' });
  }
  const seed = Date.now() % 1000000 + Math.floor(Math.random() * 999999);
  try {
    const input = `generate ${difficulty} ${seed}`;
    const data = runSolver(input);
    if (data.error) return res.status(500).json({ error: data.error });
    res.json({ ...data, difficulty, seed });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Internal error' });
  }
});

// POST /api/hint
app.post('/api/hint', (req, res) => {
  const { board } = req.body;
  const err = validateBoard(board);
  if (err) return res.status(400).json({ error: err });

  try {
    const input = `hint ${boardToInput(board)}`;
    const data = runSolver(input);
    if (data.error) return res.status(422).json({ error: data.error });
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Internal error' });
  }
});

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok', ts: Date.now() }));

// SPA fallback
app.get('*', (_, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

// ─── Error Handler ───────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error' });
});

app.listen(PORT, () => {
  console.log(`🧩 Sudoku Solver API running on http://localhost:${PORT}`);
});
