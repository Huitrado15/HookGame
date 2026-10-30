# GANCHO

A playable browser prototype of a 2D grappling-hook platformer level, built with [Phaser 3](https://phaser.io/) (loaded from a CDN, nothing to install).
Reach the end of the level, grab the key, and get back to the door at the start within 60 seconds.

## How to run it

The game must be served by a local web server; opening `index.html` by double-clicking may not work in every browser.
From the project folder, run either of these:

```bash
python -m http.server 8000
```

```bash
npx serve
```

Then open `http://localhost:8000` in your browser (with `npx serve`, use the address it prints).

### Controls

| Action | Keys |
|---|---|
| Move | Arrow keys or A / D |
| Jump (hold = higher) | Space, W or Up arrow |
| Hook (hold = keep hanging) | X, J or mouse click |
| Restart at last checkpoint | R |
| Debug mode (hitboxes, hook range) | F1 |
| Warp to each section (debug mode only) | F2 to F6 |

## Where to edit the level map

The level map is in **`level.js`**. It contains only data: no game logic.

The level is split into four sections (`Introduccion`, `Desarrollo`, `Giro`, `Conclusion`) that the game joins left to right. Each character is one 32 px tile:

| Symbol | Meaning |
|---|---|
| `#` | Solid ground / platform |
| `=` | Stair step |
| `\|` | Wall (climbed with the hook) |
| `A` | Wall anchor: the hook pulls you up to it |
| `G` | Green block: the hook lets you swing like a pendulum |
| `B` | Box: the hook pulls it; if it falls on an enemy, the enemy dies |
| `E` | Static enemy (stacked `E`s form one tall enemy) |
| `^` | Spikes |
| `P` | Player start |
| `C` | Checkpoint |
| `K` | Key |
| `D` | Exit door |
| `*` | Optional gem |
| `.` | Empty |

Rules:
- Every row in a section must have the same length.
- Every section must have the same number of rows (18).

## Where to tune the game feel

All physics and gameplay values are in the `CONFIG` block at the top of **`game.js`** (jump height, hook range, swing speed, return time limit, etc.). Each value has a comment explaining what changes when you raise or lower it. Set `USE_TEST_MAP: true` to load a small test room with one example of each hook use.

## Files

| File | Contents |
|---|---|
| `index.html` | Loads Phaser and the two scripts. |
| `level.js` | The level map (text) and its legend. |
| `game.js` | All game logic, with the `CONFIG` block at the top. |
| `CHANGES.md` | Changes from the paper design and why (Spanish). |
