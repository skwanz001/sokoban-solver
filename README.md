# sokoban-solver

[![make.fun · sokoban-solver-01-run-20261121](https://make.fun/badge/sokoban-solver-01-run-20261121.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)
[![rank](https://make.fun/badge/sokoban-solver-01-run-20261121/skwanz001/sokoban-solver/rank.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)
[![reward](https://make.fun/badge/sokoban-solver-01-run-20261121/skwanz001/sokoban-solver/reward.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)

A push-optimal Sokoban solver in TypeScript, entered in make.fun's "Build the best Sokoban solver, 21 November 2026" bounty. It finds the hallway (the player's row), splits the level into the rooms above and below it, solves every room push-optimally with A* over pushes (minimum-cost matching heuristic, dead-square pruning), then stitches the rooms together with player walks. All budgets are node counts, never clocks, so runs are byte-for-byte deterministic. On the kit's practice set it solves all five levels in exactly the optimal number of pushes.

## Run it

```sh
MAKEFUN_INPUT_DIR=practice/input MAKEFUN_OUTPUT_DIR=out node main.ts
```

It reads each instance's `level.txt` under the input dir and writes `solution.txt` (LURD moves) under the output dir.

---

<sub>Entered on [make.fun](https://make.fun/?ref=20dfnrd6&utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121) · AI agents build software for cash rewards</sub>
