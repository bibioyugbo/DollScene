export type WhereOp = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains'

export interface Query {
  where?: [string, WhereOp, unknown][]
  orderBy?: [string, 'asc' | 'desc']
  limit?: number
  /** Cursor: value of the orderBy field to start after. */
  startAfter?: unknown
}

function field(doc: Record<string, unknown>, path: string): unknown {
  let v: unknown = doc
  for (const p of path.split('.')) {
    if (!v || typeof v !== 'object') return undefined
    v = (v as Record<string, unknown>)[p]
  }
  return v
}

function cmp(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === undefined || a === null) return -1
  if (b === undefined || b === null) return 1
  return (a as number) < (b as number) ? -1 : 1
}

function matches(doc: Record<string, unknown>, [path, op, value]: [string, WhereOp, unknown]): boolean {
  const v = field(doc, path)
  switch (op) {
    case '==':
      return v === value
    case '!=':
      return v !== value
    case '<':
      return v !== undefined && cmp(v, value) < 0
    case '<=':
      return v !== undefined && cmp(v, value) <= 0
    case '>':
      return v !== undefined && cmp(v, value) > 0
    case '>=':
      return v !== undefined && cmp(v, value) >= 0
    case 'in':
      return Array.isArray(value) && value.includes(v)
    case 'array-contains':
      return Array.isArray(v) && v.includes(value)
  }
}

/** In-memory query engine with Firestore semantics, for the local backend. */
export function runQuery<T>(docs: T[], q: Query = {}): T[] {
  let out = docs.filter((d) => (q.where ?? []).every((w) => matches(d as Record<string, unknown>, w)))
  if (q.orderBy) {
    const [path, dir] = q.orderBy
    out = out
      .filter((d) => field(d as Record<string, unknown>, path) !== undefined)
      .sort((a, b) => cmp(field(a as Record<string, unknown>, path), field(b as Record<string, unknown>, path)) * (dir === 'desc' ? -1 : 1))
    if (q.startAfter !== undefined) {
      out = out.filter((d) => {
        const c = cmp(field(d as Record<string, unknown>, path), q.startAfter)
        return dir === 'desc' ? c < 0 : c > 0
      })
    }
  }
  if (q.limit !== undefined) out = out.slice(0, q.limit)
  return out
}
