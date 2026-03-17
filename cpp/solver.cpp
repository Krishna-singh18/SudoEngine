#include <bits/stdc++.h>
using namespace std;

// ════════════════════════════════════════════════════════════
//  Global board — 0 = empty, 1-9 = filled
// ════════════════════════════════════════════════════════════

int board[9][9];
int steps = 0;

// ════════════════════════════════════════════════════════════
//  CORE — same logic as your original, pure int, no char
// ════════════════════════════════════════════════════════════

bool isSafe(int row, int col, int num) {
    for (int i = 0; i < 9; i++) {
        if (board[row][i] == num)                        return false;
        if (board[i][col] == num)                        return false;
        if (board[3*(row/3)+i/3][3*(col/3)+i%3] == num) return false;
    }
    return true;
}

bool solve() {
    for (int row = 0; row < 9; row++) {
        for (int col = 0; col < 9; col++) {
            if (board[row][col] == 0) {
                for (int num = 1; num <= 9; num++) {
                    if (isSafe(row, col, num)) {
                        board[row][col] = num;
                        steps++;

                        if (solve()) return true;
                        board[row][col] = 0;
                    }
                }
                return false;
            }
        }
    }
    return true;
}

// ════════════════════════════════════════════════════════════
//  GENERATION — same isSafe, shuffled candidates
// ════════════════════════════════════════════════════════════

bool solveRandom(mt19937& rng) {
    for (int row = 0; row < 9; row++) {
        for (int col = 0; col < 9; col++) {
            if (board[row][col] == 0) {
                vector<int> nums = {1,2,3,4,5,6,7,8,9};
                shuffle(nums.begin(), nums.end(), rng);
                for (int num : nums) {
                    if (isSafe(row, col, num)) {
                        board[row][col] = num;
                        if (solveRandom(rng)) return true;
                        board[row][col] = 0;
                    }
                }
                return false;
            }
        }
    }
    return true;
}

// Counts solutions up to limit (stops at 2 for uniqueness check)
int countSolutions(int limit) {
    for (int row = 0; row < 9; row++) {
        for (int col = 0; col < 9; col++) {
            if (board[row][col] == 0) {
                int cnt = 0;
                for (int num = 1; num <= 9; num++) {
                    if (isSafe(row, col, num)) {
                        board[row][col] = num;
                        cnt += countSolutions(limit);
                        board[row][col] = 0;
                        if (cnt >= limit) return cnt;
                    }
                }
                return cnt;
            }
        }
    }
    return 1;
}

void generatePuzzle(int difficulty, mt19937& rng) {
    memset(board, 0, sizeof(board));
    solveRandom(rng);

    // easy -> ~38 givens, medium -> ~30, hard -> ~23
    int removeCount = (difficulty == 1) ? 43 : (difficulty == 2) ? 51 : 58;

    vector<pair<int,int>> cells;
    for (int r = 0; r < 9; r++)
        for (int c = 0; c < 9; c++)
            cells.push_back({r, c});
    shuffle(cells.begin(), cells.end(), rng);

    int removed = 0;
    for (auto &p : cells) {
    int r = p.first;
    int c = p.second;
        if (removed >= removeCount) break;
        int backup = board[r][c];
        board[r][c] = 0;
        if (countSolutions(2) == 1) {
            removed++;
        } else {
            board[r][c] = backup;
        }
    }
}

// ════════════════════════════════════════════════════════════
//  HINT
// ════════════════════════════════════════════════════════════
struct HintResult { int r, c, num; bool found; };

HintResult findHint(int solution[9][9]) {
    for (int r = 0; r < 9; r++)
        for (int c = 0; c < 9; c++)
            if (board[r][c] == 0)
                return {r, c, solution[r][c], true};
    return {0, 0, 0, false};
}



// ════════════════════════════════════════════════════════════
//  JSON OUTPUT
// ════════════════════════════════════════════════════════════
void printBoard() {
    cout << "[[";
    for (int r = 0; r < 9; r++) {
        if (r > 0) cout << ",[";
        for (int c = 0; c < 9; c++) {
            if (c > 0) cout << ",";
            cout << board[r][c];
        }
        cout << "]";
    }
    cout << "]";
}



// ════════════════════════════════════════════════════════════
//  MAIN — stdin/stdout JSON protocol
//  Modes:  solve    <81 ints>
//          generate <difficulty 1-3> <seed>
//          hint     <81 ints>
// ════════════════════════════════════════════════════════════
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    string mode;
    cin >> mode;

    // ── SOLVE / HINT ─────────────────────────────────────────
    if (mode == "solve" || mode == "hint") {

        for (int r = 0; r < 9; r++) {
            for (int c = 0; c < 9; c++) {
                if (!(cin >> board[r][c])) {
                    cout << "{\"error\":\"Invalid input: expected 81 integers\"}";
                    return 1;
                }
                if (board[r][c] < 0 || board[r][c] > 9) {
                    cout << "{\"error\":\"Invalid value " << board[r][c]
                         << " at [" << r << "," << c << "]: must be 0-9\"}";
                    return 1;
                }
            }
        }

        steps = 0;

        if (mode == "solve") {
            auto t0 = chrono::high_resolution_clock::now();
            bool solved = solve();
            auto t1 = chrono::high_resolution_clock::now();
            double ms = chrono::duration<double, milli>(t1 - t0).count();

            if (!solved) {
                cout << "{\"error\":\"No solution exists\"}";
                return 0;
            }
            cout << "{\"solved\":true,\"board\":";
            printBoard();
            cout << ",\"steps\":"  << steps
                 << ",\"timeMs\":" << fixed << setprecision(3) << ms << "}";

        } else { // hint
            int puzzleBoard[9][9];
            memcpy(puzzleBoard, board, sizeof(board));

            bool solved = solve();
            if (!solved) {
                cout << "{\"error\":\"No solution exists\"}";
                return 0;
            }
            int solution[9][9];
            memcpy(solution, board, sizeof(board));

            memcpy(board, puzzleBoard, sizeof(board));
            HintResult h = findHint(solution);
            if (!h.found)
                cout << "{\"hint\":null,\"message\":\"Puzzle already solved\"}";
            else
                cout << "{\"hint\":{\"row\":" << h.r
                     << ",\"col\":"           << h.c
                     << ",\"num\":"           << h.num << "}}";
        }

    // ── GENERATE ─────────────────────────────────────────────
    
    } else if (mode == "generate") {
        int difficulty;
        unsigned seed;
        cin >> difficulty >> seed;
        if (difficulty < 1 || difficulty > 3) difficulty = 1;

        mt19937 rng(seed);
        generatePuzzle(difficulty, rng);

        int puzzle[9][9];
        memcpy(puzzle, board, sizeof(board));

        steps = 0;
        solve();
        int solution[9][9];
        memcpy(solution, board, sizeof(board));

        memcpy(board, puzzle, sizeof(board));

        cout << "{\"puzzle\":";
        printBoard();
        cout << ",\"solution\":[[";
        for (int r = 0; r < 9; r++) {
            if (r > 0) cout << ",[";
            for (int c = 0; c < 9; c++) {
                if (c > 0) cout << ",";
                cout << solution[r][c];
            }
            cout << "]";
        }
        cout << "]}";

    } else {
        cout << "{\"error\":\"Unknown mode: " << mode << "\"}";
    }

    return 0;
}
