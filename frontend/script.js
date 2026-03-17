/**
 * Sudoku Solver — Frontend Engine
 * Modular vanilla JS: State, Grid, Timer, API, History, Animations
 */

'use strict';

const API_BASE = '/api';

// ═══════════════════════════════════════════════
// MODULE: State
// ═══════════════════════════════════════════════
const State = (() => {
  let _state = {
    board: Array.from({length:9}, () => Array(9).fill(0)),
    solution: Array.from({length:9}, () => Array(9).fill(0)),
    given: Array.from({length:9}, () => Array(9).fill(false)),
    notes: Array.from({length:9}, () => Array.from({length:9}, () => new Set())),
    selectedRow: -1,
    selectedCol: -1,
    pencilMode: false,
    difficulty: 1,
    moves: 0,
    errors: 0,
    hints: 0,
    isSolved: false,
    isSolving: false,
    undoStack: [],
    redoStack: [],
  };

  const listeners = [];

  function get() { return _state; }

  function set(patch) {
    _state = { ..._state, ...patch };
    listeners.forEach(fn => fn(_state));
  }

  function subscribe(fn) { listeners.push(fn); }

  function pushUndo(snapshot) {
    _state.undoStack.push(snapshot);
    if (_state.undoStack.length > 100) _state.undoStack.shift();
    _state.redoStack = [];
  }

  function snapshotBoard() {
    return {
      board: _state.board.map(r => [...r]),
      notes: _state.notes.map(r => r.map(s => new Set(s))),
    };
  }

  return { get, set, subscribe, pushUndo, snapshotBoard };
})();


// ═══════════════════════════════════════════════
// MODULE: Validator
// ═══════════════════════════════════════════════
const Validator = (() => {
  function getConflictCells(board, row, col, num) {
    const conflicts = new Set();
    if (num === 0) return conflicts;
    const boxR = Math.floor(row/3)*3;
    const boxC = Math.floor(col/3)*3;
    for (let i = 0; i < 9; i++) {
      if (i !== col && board[row][i] === num) conflicts.add(`${row}-${i}`);
      if (i !== row && board[i][col] === num) conflicts.add(`${i}-${col}`);
    }
    for (let r = boxR; r < boxR+3; r++) {
      for (let c = boxC; c < boxC+3; c++) {
        if ((r !== row || c !== col) && board[r][c] === num) conflicts.add(`${r}-${c}`);
      }
    }
    return conflicts;
  }

  function getAllErrors(board) {
    const errors = new Set();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const v = board[r][c];
        if (v === 0) continue;
        const conf = getConflictCells(board, r, c, v);
        if (conf.size > 0) {
          errors.add(`${r}-${c}`);
          conf.forEach(k => errors.add(k));
        }
      }
    }
    return errors;
  }

  function isBoardComplete(board) {
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (board[r][c] === 0) return false;
    return getAllErrors(board).size === 0;
  }

  return { getConflictCells, getAllErrors, isBoardComplete };
})();


// ═══════════════════════════════════════════════
// MODULE: Timer
// ═══════════════════════════════════════════════
const Timer = (() => {
  let startTime = null;
  let elapsed = 0;
  let interval = null;
  let el = null;

  function init(element) { el = element; }

  function format(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  }

  function start() {
    if (interval) return;
    startTime = Date.now() - elapsed;
    interval = setInterval(() => {
      elapsed = Date.now() - startTime;
      if (el) el.textContent = format(elapsed);
    }, 500);
  }

  function pause() {
    clearInterval(interval);
    interval = null;
  }

  function reset() {
    pause();
    elapsed = 0;
    startTime = null;
    if (el) el.textContent = '00:00';
  }

  function getElapsed() { return elapsed; }
  function getFormatted() { return format(elapsed); }

  return { init, start, pause, reset, getElapsed, getFormatted };
})();


// ═══════════════════════════════════════════════
// MODULE: API
// ═══════════════════════════════════════════════
const API = (() => {
  async function solve(board) {
    const res = await fetch(`${API_BASE}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board }),
    });
    if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
    return res.json();
  }

  async function generate(difficulty) {
    const res = await fetch(`${API_BASE}/generate?difficulty=${difficulty}`);
    if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
    return res.json();
  }

  async function hint(board) {
    const res = await fetch(`${API_BASE}/hint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board }),
    });
    if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
    return res.json();
  }

  return { solve, generate, hint };
})();


// ═══════════════════════════════════════════════
// MODULE: History (localStorage)
// ═══════════════════════════════════════════════
const History = (() => {
  const KEY = 'sudoku_history_v2';
  const MAX = 20;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }

  function save(entry) {
    const list = load();
    list.unshift(entry);
    if (list.length > MAX) list.length = MAX;
    localStorage.setItem(KEY, JSON.stringify(list));
  }

  function clear() { localStorage.removeItem(KEY); }

  return { load, save, clear };
})();


// ═══════════════════════════════════════════════
// MODULE: Grid UI
// ═══════════════════════════════════════════════
const Grid = (() => {
  let container = null;
  let cells = [];

  function init(el) {
    container = el;
    cells = [];
    container.innerHTML = '';
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = r;
        cell.dataset.col = c;
        container.appendChild(cell);
        cells.push(cell);
      }
    }
  }

  function getCell(r, c) { return cells[r * 9 + c]; }

  function renderCell(r, c) {
    const { board, given, notes, solution } = State.get();
    const cell = getCell(r, c);
    const val = board[r][c];

    // Clear classes
    cell.className = 'cell';
    cell.innerHTML = '';

    if (given[r][c]) cell.classList.add('given');
    else if (val !== 0) cell.classList.add('user-entered');

    const ns = notes[r][c];
    if (!given[r][c] && ns.size > 0 && val === 0) {
      // Notes mode display
      const grid = document.createElement('div');
      grid.className = 'notes-grid';
      for (let n = 1; n <= 9; n++) {
        const nd = document.createElement('div');
        nd.className = 'note-num' + (ns.has(n) ? ' active' : '');
        nd.textContent = ns.has(n) ? n : '';
        grid.appendChild(nd);
      }
      cell.appendChild(grid);
    } else if (val !== 0) {
      const span = document.createElement('span');
      span.className = 'cell-value';
      span.textContent = val;
      cell.appendChild(span);
    }

    return cell;
  }

  function renderAll() {
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        renderCell(r, c);
    applyHighlights();
    applyErrors();
  }

  function applyHighlights() {
    const { board, selectedRow: sr, selectedCol: sc } = State.get();
    const selVal = (sr >= 0 && sc >= 0) ? board[sr][sc] : 0;

    cells.forEach(cell => {
      const r = +cell.dataset.row;
      const c = +cell.dataset.col;
      cell.classList.remove('selected', 'highlighted', 'same-num');

      if (r === sr && c === sc) {
        cell.classList.add('selected');
        return;
      }
      if (sr < 0) return;

      const sameBox = Math.floor(r/3)===Math.floor(sr/3) && Math.floor(c/3)===Math.floor(sc/3);
      if (r === sr || c === sc || sameBox) cell.classList.add('highlighted');
      if (selVal !== 0 && board[r][c] === selVal) cell.classList.add('same-num');
    });
  }

  function applyErrors() {
    const { board, given } = State.get();
    const errors = Validator.getAllErrors(board);
    cells.forEach(cell => {
      const key = `${cell.dataset.row}-${cell.dataset.col}`;
      if (errors.has(key)) cell.classList.add('error');
      else cell.classList.remove('error');
    });
  }

  function animateSolve(steps, onDone) {
    let i = 0;
    const delay = Math.max(8, Math.min(40, 2000 / steps.length));

    function next() {
      if (i >= steps.length) { onDone(); return; }
      const [r, c, v] = steps[i++];
      const cell = getCell(r, c);
      cell.classList.add('solving');
      const span = document.createElement('span');
      span.className = 'cell-value';
      span.textContent = v;
      cell.innerHTML = '';
      cell.appendChild(span);
      setTimeout(next, delay);
    }
    next();
  }

  function flashHint(r, c) {
    const cell = getCell(r, c);
    cell.classList.add('hint');
    const val = State.get().board[r][c];
    if (val !== 0) {
      const span = document.createElement('span');
      span.className = 'cell-value';
      span.textContent = val;
      cell.innerHTML = '';
      cell.appendChild(span);
    }
  }

  function popCell(r, c) {
    const cell = getCell(r, c);
    cell.classList.remove('pop');
    void cell.offsetWidth; // reflow
    cell.classList.add('pop');
  }

  return { init, getCell, renderCell, renderAll, applyHighlights, applyErrors, animateSolve, flashHint, popCell };
})();


// ═══════════════════════════════════════════════
// MODULE: UI Updates
// ═══════════════════════════════════════════════
const UI = (() => {
  let statMoves, statErrors, statHints, statScore;
  let engStatus, engTime, engSteps;
  let progressBar, progressLabel;
  let statusMsg, statusTimeout;

  function init() {
    statMoves = document.getElementById('statMoves');
    statErrors = document.getElementById('statErrors');
    statHints = document.getElementById('statHints');
    statScore = document.getElementById('statScore');
    engStatus = document.getElementById('engStatus');
    engTime = document.getElementById('engTime');
    engSteps = document.getElementById('engSteps');
    progressBar = document.getElementById('progressBar');
    progressLabel = document.getElementById('progressLabel');
    statusMsg = document.getElementById('statusMsg');
  }

  function updateStats() {
    const s = State.get();
    statMoves.textContent = s.moves;
    statErrors.textContent = s.errors;
    statHints.textContent = s.hints;
    // Score: base 1000, -10 per error, -5 per hint, -1 per 10s
    const timeBonus = Math.max(0, 100 - Math.floor(Timer.getElapsed() / 10000));
    const score = Math.max(0, 1000 - s.errors * 10 - s.hints * 5 + timeBonus);
    statScore.textContent = s.isSolved ? score : '—';
  }

  function updateProgress() {
    const { board } = State.get();
    let filled = 0;
    board.forEach(row => row.forEach(v => { if (v !== 0) filled++; }));
    const pct = (filled / 81) * 100;
    progressBar.style.width = pct + '%';
    progressLabel.textContent = `${filled} / 81 filled`;
  }

  function setEngineStatus(status, timeMs, steps) {
    engStatus.textContent = status;
    engTime.textContent = timeMs !== null ? `${timeMs.toFixed(2)}ms` : '—';
    engSteps.textContent = steps !== null ? steps.toLocaleString() : '—';
  }

  function showStatus(msg, type = 'info', duration = 3000) {
    clearTimeout(statusTimeout);
    statusMsg.textContent = msg;
    statusMsg.className = `status-msg ${type}`;
    if (duration) {
      statusTimeout = setTimeout(() => {
        statusMsg.textContent = '';
        statusMsg.className = 'status-msg';
      }, duration);
    }
  }

  function showLoading(show, text = 'LOADING...') {
    const overlay = document.getElementById('loadingOverlay');
    const txt = document.getElementById('loadingText');
    if (show) { overlay.classList.remove('hidden'); txt.textContent = text; }
    else overlay.classList.add('hidden');
  }

  function showCompletion(difficulty, timeStr, moves, errors, hints) {
    const diffNames = { 1:'EASY', 2:'MEDIUM', 3:'HARD' };
    document.getElementById('modalSub').textContent =
      `${diffNames[difficulty] || 'UNKNOWN'} PUZZLE COMPLETED`;
    document.getElementById('modalStats').innerHTML = `
      <div class="modal-stat"><div class="modal-stat-val">${timeStr}</div><div class="modal-stat-lbl">TIME</div></div>
      <div class="modal-stat"><div class="modal-stat-val">${moves}</div><div class="modal-stat-lbl">MOVES</div></div>
      <div class="modal-stat"><div class="modal-stat-val">${errors}</div><div class="modal-stat-lbl">ERRORS</div></div>
    `;
    document.getElementById('completionModal').classList.remove('hidden');
  }

  return { init, updateStats, updateProgress, setEngineStatus, showStatus, showLoading, showCompletion };
})();


// ═══════════════════════════════════════════════
// MODULE: Game Controller
// ═══════════════════════════════════════════════
const Game = (() => {

  async function newGame(difficulty) {
    UI.showLoading(true, 'GENERATING PUZZLE...');
    UI.setEngineStatus('GENERATING', null, null);
    try {
      const data = await API.generate(difficulty);
      Timer.reset();
      State.set({
        board: data.puzzle.map(r => [...r]),
        solution: data.solution.map(r => [...r]),
        given: data.puzzle.map(r => r.map(v => v !== 0)),
        notes: Array.from({length:9}, () => Array.from({length:9}, () => new Set())),
        selectedRow: -1,
        selectedCol: -1,
        moves: 0,
        errors: 0,
        hints: 0,
        isSolved: false,
        isSolving: false,
        undoStack: [],
        redoStack: [],
        difficulty,
      });
      Grid.renderAll();
      UI.updateStats();
      UI.updateProgress();
      UI.setEngineStatus('READY', null, null);
      UI.showStatus(`NEW ${['','EASY','MEDIUM','HARD'][difficulty]} PUZZLE GENERATED`, 'info');
      Timer.start();
    } catch (e) {
      UI.showStatus('FAILED TO GENERATE PUZZLE', 'error');
      console.error(e);
    } finally {
      UI.showLoading(false);
    }
  }

  function selectCell(r, c) {
    State.set({ selectedRow: r, selectedCol: c });
    Grid.applyHighlights();
  }

  function enterNumber(num) {
    const { selectedRow: r, selectedCol: c, given, board, pencilMode, notes, isSolving, isSolved } = State.get();
    if (r < 0 || c < 0 || given[r][c] || isSolving || isSolved) return;

    State.pushUndo(State.snapshotBoard());

    if (pencilMode && num !== 0) {
      const ns = new Set(notes[r][c]);
      if (ns.has(num)) ns.delete(num); else ns.add(num);
      const newNotes = notes.map(row => row.map(s => new Set(s)));
      newNotes[r][c] = ns;
      State.set({ notes: newNotes });
      Grid.renderCell(r, c);
      return;
    }

    const newBoard = board.map(row => [...row]);
    newBoard[r][c] = num;

    // Clear notes for this cell
    const newNotes = notes.map(row => row.map(s => new Set(s)));
    newNotes[r][c] = new Set();
    // Also clear notes in row/col/box for this number
    if (num !== 0) {
      const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3;
      for (let i = 0; i < 9; i++) {
        newNotes[r][i].delete(num);
        newNotes[i][c].delete(num);
      }
      for (let dr = 0; dr < 3; dr++)
        for (let dc = 0; dc < 3; dc++)
          newNotes[br+dr][bc+dc].delete(num);
    }

    let errors = State.get().errors;
    let moves = State.get().moves;

    if (num !== 0) {
      moves++;
      // Check against solution
      const { solution } = State.get();
      if (solution[r][c] !== 0 && solution[r][c] !== num) errors++;
    }

    State.set({ board: newBoard, notes: newNotes, moves, errors });
    Grid.renderAll();
    Grid.popCell(r, c);
    UI.updateStats();
    UI.updateProgress();

    if (num !== 0 && Validator.isBoardComplete(newBoard)) {
      onPuzzleComplete();
    }
  }

  function undo() {
    const s = State.get();
    if (s.undoStack.length === 0) return;
    const snap = s.undoStack.pop();
    s.redoStack.push(State.snapshotBoard());
    State.set({ board: snap.board, notes: snap.notes });
    Grid.renderAll();
    UI.updateStats();
    UI.updateProgress();
  }

  function redo() {
    const s = State.get();
    if (s.redoStack.length === 0) return;
    const snap = s.redoStack.pop();
    s.undoStack.push(State.snapshotBoard());
    State.set({ board: snap.board, notes: snap.notes });
    Grid.renderAll();
    UI.updateStats();
    UI.updateProgress();
  }

  async function autoSolve() {
    const { board, isSolving, isSolved, given } = State.get();
    if (isSolving || isSolved) return;
    State.set({ isSolving: true });
    UI.setEngineStatus('SOLVING...', null, null);
    UI.showStatus('SENDING TO C++ ENGINE...', 'info', 0);

    try {
      const data = await API.solve(board);
      if (data.error) {
        UI.showStatus(data.error, 'error');
        State.set({ isSolving: false });
        return;
      }

      UI.setEngineStatus('SOLVED', data.timeMs, data.steps);
      Timer.pause();

      // Compute solve steps (only cells that were empty)
      const steps = [];
      for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++)
          if (!given[r][c] && board[r][c] === 0)
            steps.push([r, c, data.board[r][c]]);

      // Apply to state
      const newBoard = data.board.map(r => [...r]);
      State.set({ board: newBoard });

      UI.showStatus(`SOLVED IN ${data.timeMs.toFixed(2)}ms — ${data.steps} STEPS`, 'success', 0);

      // Animate
      Grid.animateSolve(steps, () => {
        // Final pass: mark auto-solved
        for (let r = 0; r < 9; r++)
          for (let c = 0; c < 9; c++) {
            const cell = Grid.getCell(r, c);
            cell.classList.remove('solving');
            if (!given[r][c]) cell.classList.add('auto-solved');
          }
        State.set({ isSolving: false, isSolved: true });
        UI.updateProgress();
      });

      // Save to history
      History.save({
        puzzle: board,
        solution: data.board,
        difficulty: State.get().difficulty,
        date: new Date().toISOString(),
        autoSolved: true,
      });

    } catch (e) {
      UI.showStatus('SOLVER ERROR: ' + e.message, 'error');
      UI.setEngineStatus('ERROR', null, null);
      State.set({ isSolving: false });
    }
  }

  async function getHint() {
    const { board, isSolving, isSolved, given } = State.get();
    if (isSolving || isSolved) return;

    try {
      const data = await API.hint(board);
      if (data.error) { UI.showStatus(data.error, 'error'); return; }
      if (!data.hint) { UI.showStatus('PUZZLE IS COMPLETE!', 'success'); return; }

      const { row: r, col: c, num } = data.hint;
      State.pushUndo(State.snapshotBoard());
      const newBoard = board.map(row => [...row]);
      newBoard[r][c] = num;

      State.set({
        board: newBoard,
        hints: State.get().hints + 1,
        selectedRow: r,
        selectedCol: c,
      });

      Grid.renderAll();
      Grid.flashHint(r, c);
      Grid.popCell(r, c);
      UI.updateStats();
      UI.updateProgress();
      UI.showStatus(`HINT: PLACE ${num} AT ROW ${r+1}, COL ${c+1}`, 'info');

      if (Validator.isBoardComplete(newBoard)) onPuzzleComplete();
    } catch (e) {
      UI.showStatus('HINT ERROR: ' + e.message, 'error');
    }
  }

  function onPuzzleComplete() {
    Timer.pause();
    State.set({ isSolved: true });
    UI.updateStats();
    const s = State.get();
    setTimeout(() => {
      UI.showCompletion(s.difficulty, Timer.getFormatted(), s.moves, s.errors, s.hints);
    }, 600);

    History.save({
      puzzle: s.board,
      difficulty: s.difficulty,
      date: new Date().toISOString(),
      time: Timer.getElapsed(),
      autoSolved: false,
    });
  }

  return { newGame, selectCell, enterNumber, undo, redo, autoSolve, getHint };
})();


// ═══════════════════════════════════════════════
// MODULE: History Drawer
// ═══════════════════════════════════════════════
const HistoryUI = (() => {
  const diffNames = { 1:'EASY', 2:'MEDIUM', 3:'HARD' };

  function open() {
    const drawer = document.getElementById('historyDrawer');
    const overlay = document.getElementById('drawerOverlay');
    drawer.classList.add('open');
    overlay.classList.add('visible');
    render();
  }

  function close() {
    document.getElementById('historyDrawer').classList.remove('open');
    document.getElementById('drawerOverlay').classList.remove('visible');
  }

  function render() {
    const list = document.getElementById('historyList');
    const items = History.load();
    if (items.length === 0) {
      list.innerHTML = '<div style="color:var(--text-3);font-family:Space Mono,monospace;font-size:11px;text-align:center;padding:40px">NO HISTORY YET</div>';
      return;
    }
    list.innerHTML = '';
    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'history-item';
      const date = new Date(item.date).toLocaleDateString('en-US', {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
      el.innerHTML = `
        <div class="history-item-header">
          <span class="history-item-diff">${diffNames[item.difficulty]||'?'} ${item.autoSolved?'· AUTO-SOLVED':''}</span>
          <span class="history-item-date">${date}</span>
        </div>
        <div class="history-mini-grid">
          ${(item.puzzle||item.board||[]).flat().map(v =>
            `<div class="history-mini-cell${v?` given`:''}">${v||''}</div>`
          ).join('')}
        </div>
      `;
      list.appendChild(el);
    });
  }

  return { open, close };
})();


// ═══════════════════════════════════════════════
// MODULE: Input Handler
// ═══════════════════════════════════════════════
const Input = (() => {
  function init() {
    // Grid click
    document.getElementById('sudokuGrid').addEventListener('click', e => {
      const cell = e.target.closest('.cell');
      if (!cell) return;
      Game.selectCell(+cell.dataset.row, +cell.dataset.col);
    });

    // Numpad click
    document.getElementById('numpad').addEventListener('click', e => {
      const key = e.target.closest('.num-key');
      if (!key) return;
      Game.enterNumber(+key.dataset.num);
    });

    // Keyboard
    document.addEventListener('keydown', e => {
      const s = State.get();

      // Arrow keys
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
        e.preventDefault();
        let { selectedRow: r, selectedCol: c } = s;
        if (r < 0) { r = 0; c = 0; }
        else {
          if (e.key === 'ArrowUp') r = Math.max(0, r-1);
          else if (e.key === 'ArrowDown') r = Math.min(8, r+1);
          else if (e.key === 'ArrowLeft') c = Math.max(0, c-1);
          else if (e.key === 'ArrowRight') c = Math.min(8, c+1);
        }
        Game.selectCell(r, c);
        return;
      }

      // Number keys
      if (e.key >= '1' && e.key <= '9') { Game.enterNumber(+e.key); return; }
      if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') { Game.enterNumber(0); return; }

      // Undo/Redo
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); Game.undo(); return; }
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); Game.redo(); return; }
    });

    // Buttons
    document.getElementById('newGameBtn').addEventListener('click', () => {
      Game.newGame(State.get().difficulty);
    });

    document.getElementById('solveBtn').addEventListener('click', () => {
      Game.autoSolve();
    });

    document.getElementById('hintBtn').addEventListener('click', () => {
      Game.getHint();
    });

    document.getElementById('undoBtn').addEventListener('click', () => Game.undo());
    document.getElementById('redoBtn').addEventListener('click', () => Game.redo());

    document.getElementById('pencilBtn').addEventListener('click', () => {
      const pencilMode = !State.get().pencilMode;
      State.set({ pencilMode });
      document.getElementById('pencilBtn').classList.toggle('active', pencilMode);
      UI.showStatus(pencilMode ? 'PENCIL MODE ON' : 'PENCIL MODE OFF', 'info', 1500);
    });

    document.getElementById('themeToggle').addEventListener('click', () => {
      const el = document.documentElement;
      el.dataset.theme = el.dataset.theme === 'dark' ? 'light' : 'dark';
    });

    document.getElementById('historyBtn').addEventListener('click', () => HistoryUI.open());
    document.getElementById('closeHistory').addEventListener('click', () => HistoryUI.close());
    document.getElementById('drawerOverlay').addEventListener('click', () => HistoryUI.close());

    // Difficulty buttons
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        State.set({ difficulty: +btn.dataset.diff });
      });
    });

    document.getElementById('modalNewGame').addEventListener('click', () => {
      document.getElementById('completionModal').classList.add('hidden');
      Game.newGame(State.get().difficulty);
    });
  }

  return { init };
})();


// ═══════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════
(function bootstrap() {
  Grid.init(document.getElementById('sudokuGrid'));
  Timer.init(document.getElementById('timerDisplay'));
  UI.init();
  Input.init();

  // Initial render with empty board
  Grid.renderAll();
  UI.updateProgress();
  UI.setEngineStatus('IDLE', null, null);

  // Auto-load a puzzle
  Game.newGame(1);
})();
