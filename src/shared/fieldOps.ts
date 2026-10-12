/**
 * Backend-neutral field operations. The Firestore adapters map these to
 * FieldValue.increment / arrayUnion / arrayRemove / delete; the local
 * adapter applies them directly.
 */
export type FieldOp =
  | { __op: 'inc'; n: number }
  | { __op: 'union'; values: unknown[] }
  | { __op: 'remove'; values: unknown[] }
  | { __op: 'delete' }

export const inc = (n: number): FieldOp => ({ __op: 'inc', n })
export const arrayUnion = (...values: unknown[]): FieldOp => ({ __op: 'union', values })
export const arrayRemove = (...values: unknown[]): FieldOp => ({ __op: 'remove', values })
export const deleteField = (): FieldOp => ({ __op: 'delete' })

export function isFieldOp(v: unknown): v is FieldOp {
  return !!v && typeof v === 'object' && '__op' in (v as object)
}

type Obj = Record<string, unknown>

function applyOp(current: unknown, op: FieldOp): unknown {
  switch (op.__op) {
    case 'inc':
      return (typeof current === 'number' ? current : 0) + op.n
    case 'union': {
      const arr = Array.isArray(current) ? [...current] : []
      for (const v of op.values) if (!arr.some((x) => JSON.stringify(x) === JSON.stringify(v))) arr.push(v)
      return arr
    }
    case 'remove': {
      const arr = Array.isArray(current) ? current : []
      return arr.filter((x) => !op.values.some((v) => JSON.stringify(x) === JSON.stringify(v)))
    }
    case 'delete':
      return undefined
  }
}

/** Firestore `update` semantics: keys may be dotted paths; values may be FieldOps. */
export function applyUpdate<T extends Obj>(doc: T, patch: Obj): T {
  const out: Obj = structuredClone(doc)
  for (const [key, value] of Object.entries(patch)) {
    const parts = key.split('.')
    let target = out
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i]
      if (!target[p] || typeof target[p] !== 'object') target[p] = {}
      target = target[p] as Obj
    }
    const last = parts[parts.length - 1]
    const next = isFieldOp(value) ? applyOp(target[last], value) : structuredClone(value)
    if (next === undefined) delete target[last]
    else target[last] = next
  }
  return out as T
}

/** Firestore `set(..., { merge: true })` semantics: deep-merge plain objects. */
export function applyMerge<T extends Obj>(doc: T | null, data: Obj): T {
  const out: Obj = doc ? structuredClone(doc) : {}
  const merge = (target: Obj, src: Obj) => {
    for (const [k, v] of Object.entries(src)) {
      if (isFieldOp(v)) {
        const next = applyOp(target[k], v)
        if (next === undefined) delete target[k]
        else target[k] = next
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        if (!target[k] || typeof target[k] !== 'object' || Array.isArray(target[k])) target[k] = {}
        merge(target[k] as Obj, v as Obj)
      } else {
        target[k] = structuredClone(v)
      }
    }
  }
  merge(out, data)
  return out as T
}

/** Resolve FieldOps for a brand-new document (set without merge). */
export function resolveOps<T extends Obj>(data: Obj): T {
  return applyMerge<T>(null, data)
}
