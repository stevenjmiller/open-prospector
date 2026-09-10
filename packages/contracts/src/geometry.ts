export interface GridCell { row: number; column: number }
export function gridCell(cell: GridCell): void {
  if (!Number.isInteger(cell.row) || !Number.isInteger(cell.column) || cell.row < 0 || cell.row > 255 || cell.column < 0 || cell.column > 255) throw new Error('Cell outside grid');
}
export function cellCenter(cell: GridCell): { e_mm: number; n_mm: number } {
  gridCell(cell); return { e_mm: cell.column * 1000 + 500, n_mm: (255 - cell.row) * 1000 + 500 };
}
export function octile(from: GridCell, to: GridCell): number {
  gridCell(from); gridCell(to);
  const x = Math.abs(from.column - to.column), y = Math.abs(from.row - to.row);
  return 1000 * Math.max(x, y) + 414 * Math.min(x, y);
}
export function edgeLength(from: GridCell, to: GridCell): number {
  const length = octile(from, to);
  if (Math.abs(from.row - to.row) > 1 || Math.abs(from.column - to.column) > 1 || length === 0) throw new Error('Not an adjacent edge');
  return length;
}
export function bresenham(from: GridCell, to: GridCell): GridCell[] {
  gridCell(from); gridCell(to);
  let x = from.column, y = from.row;
  const dx = Math.abs(to.column - x), sx = x < to.column ? 1 : -1;
  const dy = -Math.abs(to.row - y), sy = y < to.row ? 1 : -1;
  let err = dx + dy;
  const result: GridCell[] = [];
  for (;;) {
    result.push({ row: y, column: x });
    if (x === to.column && y === to.row) return result;
    const twice = 2 * err;
    if (twice >= dy) { err += dy; x += sx; }
    if (twice <= dx) { err += dx; y += sy; }
  }
}
export function expandAdvisory(waypoints: readonly GridCell[]): GridCell[] {
  waypoints.forEach(gridCell);
  if (!waypoints.length) return [];
  return [ { ...waypoints[0]! }, ...waypoints.slice(1).flatMap((cell, i) => bresenham(waypoints[i]!, cell).slice(1)) ];
}
export function sweepFootprint(center: GridCell): GridCell[] {
  gridCell(center); const cells: GridCell[] = [];
  for (let row = Math.max(0, center.row - 20); row <= Math.min(255, center.row + 20); row++) {
    for (let column = Math.max(0, center.column - 20); column <= Math.min(255, center.column + 20); column++) {
      if ((row - center.row) ** 2 + (column - center.column) ** 2 <= 400) cells.push({ row, column });
    }
  }
  return cells;
}
