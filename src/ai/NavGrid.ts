/**
 * A walking map of a level for enemies that can't jump, built from the level text.
 *
 * Each node is a tile cell something can be in: standing on a floor, shelf or
 * ladder top, standing on a stair, or hanging on a ladder. Edges are the moves a
 * zombie can make from one cell to the next: walk (along a floor or up and down
 * stairs), climb (up and down a ladder) and drop (step off a ledge and fall).
 * There is no jumping, so a player on a shelf is out of reach and the zombie can
 * only wait below them.
 *
 * Nothing here knows about Phaser, so it can be tested on its own.
 */

export type Move = 'walk' | 'climb' | 'drop';

export interface Cell {
  x: number;
  y: number;
}

export interface Step extends Cell {
  move: Move;
}

export interface PathResult {
  /** Cells from the start to the goal (or as near as the zombie can get), start included. */
  path: Step[];
  /** False when the goal can't be reached and the path ends at the closest reachable cell instead. */
  reached: boolean;
}

export class NavGrid {
  readonly width: number;
  readonly height: number;
  private readonly rows: string[];
  private readonly edges: Step[][];

  /** `rows` is the level text, one string per tile row. */
  constructor(rows: string[]) {
    this.rows = rows;
    this.height = rows.length;
    this.width = rows[0]?.length ?? 0;
    this.edges = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) this.edges.push(this.isNode(x, y) ? this.findEdges(x, y) : []);
    }
  }

  // ------------------------------------------------------------ tile tests

  private ch(x: number, y: number): string {
    if (x < 0 || x >= this.width || y >= this.height) return '#';
    if (y < 0) return ' ';
    return this.rows[y][x];
  }

  /** Inside the map: falling off the bottom is not a way to get anywhere. */
  private inside(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  isSolid(x: number, y: number): boolean {
    const c = this.ch(x, y);
    return c === '#' || c === 'X' || c === 'M';
  }

  isLadder(x: number, y: number): boolean {
    return this.ch(x, y) === 'H';
  }

  isStairs(x: number, y: number): boolean {
    const c = this.ch(x, y);
    return c === '/' || c === '\\';
  }

  private open(x: number, y: number): boolean {
    return this.inside(x, y) && !this.isSolid(x, y);
  }

  /** Something to stand on in the cell below: a floor, a shelf, or the top rung of a ladder. */
  private supported(x: number, y: number): boolean {
    const below = this.ch(x, y + 1);
    if (below === 'H') return !this.isLadder(x, y);
    return below === '#' || below === 'X' || below === 'M' || below === '=';
  }

  /** A cell a zombie can stand in, with room for its head. */
  isStandable(x: number, y: number): boolean {
    if (!this.open(x, y) || this.isSolid(x, y - 1)) return false;
    return this.isStairs(x, y) || this.supported(x, y);
  }

  isNode(x: number, y: number): boolean {
    return this.isStandable(x, y) || (this.inside(x, y) && this.isLadder(x, y));
  }

  // ------------------------------------------------------------ edges

  /** The moves out of cell (x, y). */
  neighbours(x: number, y: number): readonly Step[] {
    return this.inside(x, y) ? this.edges[y * this.width + x] : [];
  }

  private findEdges(x: number, y: number): Step[] {
    const out: Step[] = [];
    const here = this.ch(x, y);

    if (this.isStandable(x, y)) {
      for (const dx of [-1, 1]) {
        const nx = x + dx;
        // A stair climbs one row per tile: '/' up to the right, '\' up to the left.
        const upward = (here === '/' && dx > 0) || (here === '\\' && dx < 0);
        if (upward) {
          if (this.isStandable(nx, y - 1)) out.push({ x: nx, y: y - 1, move: 'walk' });
          continue;
        }
        // Walking down onto a stair (from the top of a run, or the next step down).
        const downStair = this.ch(nx, y + 1);
        if ((downStair === '/' && dx < 0) || (downStair === '\\' && dx > 0)) {
          if (this.isStandable(nx, y + 1)) out.push({ x: nx, y: y + 1, move: 'walk' });
          continue;
        }
        if (this.isStandable(nx, y)) {
          out.push({ x: nx, y, move: 'walk' });
          continue;
        }
        // Step off a ledge and fall until something is underneath.
        if (!this.open(nx, y) || this.isSolid(nx, y - 1)) continue;
        for (let fy = y + 1; fy < this.height; fy++) {
          if (!this.open(nx, fy)) break;
          if (this.isStandable(nx, fy)) {
            out.push({ x: nx, y: fy, move: 'drop' });
            break;
          }
        }
      }
    }

    // Ladders: up and down a rung at a time, and off the top onto the floor above it.
    if (this.isLadder(x, y - 1) || (this.isLadder(x, y) && this.isStandable(x, y - 1))) {
      out.push({ x, y: y - 1, move: 'climb' });
    }
    if (this.isLadder(x, y + 1)) out.push({ x, y: y + 1, move: 'climb' });
    return out;
  }

  // ------------------------------------------------------------ search

  /**
   * The shortest route from `from` to `to`. If `to` can't be reached, the route
   * goes to the reachable standing spot closest to it instead, so a zombie waits
   * under a player who is out of reach rather than giving up on the spot.
   */
  findPath(from: Cell, to: Cell, maxSteps = Infinity): PathResult | null {
    if (!this.isNode(from.x, from.y)) return null;
    const w = this.width;
    const start = from.y * w + from.x;
    const goal = to.y * w + to.x;
    const prev = new Int32Array(w * this.height).fill(-1);
    const dist = new Int32Array(w * this.height).fill(-1);
    const move: Move[] = [];
    dist[start] = 0;
    const queue = [start];
    let best = start;
    let bestScore = Infinity;
    const score = (i: number) => {
      const x = i % w;
      const y = (i - x) / w;
      return Math.abs(x - to.x) + 3 * Math.abs(y - to.y);
    };

    for (let head = 0; head < queue.length; head++) {
      const i = queue[head];
      if (i === goal) {
        best = i;
        bestScore = 0;
        break;
      }
      const x = i % w;
      const y = (i - x) / w;
      if (this.isStandable(x, y)) {
        const s = score(i) + dist[i] * 0.01;
        if (s < bestScore) {
          bestScore = s;
          best = i;
        }
      }
      if (dist[i] >= maxSteps) continue;
      for (const n of this.edges[i]) {
        const j = n.y * w + n.x;
        if (dist[j] !== -1) continue;
        dist[j] = dist[i] + 1;
        prev[j] = i;
        move[j] = n.move;
        queue.push(j);
      }
    }

    const path: Step[] = [];
    for (let i = best; i !== -1; i = prev[i]) {
      const x = i % w;
      path.push({ x, y: (i - x) / w, move: move[i] ?? 'walk' });
    }
    path.reverse();
    return { path, reached: best === goal };
  }
}
