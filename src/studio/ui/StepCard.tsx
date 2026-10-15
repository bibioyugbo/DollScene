import { useState } from 'react'
import { cancelAction, skipAction } from '../actions/engine'
import { runStep, type Product, type StepDef } from '../actions/steps'
import { useStudio } from '../state/store'
import { Chips } from './controls'
import { Icon } from './icons'

/** Product cards: name, blurb and a swatch. */
export function ProductPicker({ products, value, onPick, label }: { products: Product[]; value: string; onPick: (p: Product) => void; label: string }) {
  if (products.length <= 1) return null
  return (
    <div role="radiogroup" aria-label={label} className="ds-scroll-x -mx-4 flex gap-2 px-4 py-0.5">
      {products.map((p) => {
        const on = p.id === value
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(p)}
            className={`flex w-[9.5rem] shrink-0 flex-col gap-1.5 rounded-2xl border p-2.5 text-left transition-colors ${on ? 'border-accent bg-accent/10' : 'border-line active:bg-raised'}`}
          >
            <span className="flex items-center gap-2">
              <span className="h-6 w-4 rounded-md shadow-inner" style={{ background: p.color }} aria-hidden />
              <span className="font-display text-[14px] leading-tight">{p.name}</span>
            </span>
            <span className="text-[11px] leading-snug text-muted">{p.blurb}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Running-action bar: what's playing, how far, and Skip (lands the finished state at once). */
export function ActionHud() {
  const action = useStudio((s) => s.action)
  if (!action) return null
  return (
    <div className="pointer-events-auto ds-pop ds-sheet flex items-center gap-3 rounded-full border border-line py-1.5 pl-4 pr-1.5 shadow-xl" role="status" aria-live="polite">
      <div className="min-w-0">
        <p className="truncate font-display text-[14px] leading-tight">{action.label}</p>
        <div className="mt-1 h-1 w-36 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(action.progress * 100)} aria-label={`${action.label} progress`}>
          <div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${Math.round(action.progress * 100)}%` }} />
        </div>
      </div>
      <button type="button" onClick={() => skipAction()} className="flex min-h-10 items-center gap-1.5 rounded-full bg-text px-3.5 text-[12px] font-semibold text-ink">
        <Icon name="skip" className="h-3.5 w-3.5" />
        Skip
      </button>
      <button type="button" aria-label="Stop" onClick={() => cancelAction()} className="grid h-10 w-10 place-items-center rounded-full text-muted hover:text-text">
        <Icon name="close" className="h-4 w-4" />
      </button>
    </div>
  )
}

export interface StepCardProps {
  step: StepDef
  /** 1-based position in a routine (for the progress indicator). */
  index?: number
  total?: number
  done?: boolean
  onBack?: () => void
  onNext?: () => void
  /** Products override (e.g. picked by hair type). */
  products?: Product[]
  extra?: Record<string, string | number>
  /** Called after the step finished or was skipped (its state is applied). */
  onFinished?: () => void
}

/**
 * One routine step: pick a product (and option / target), play it, skip it, replay it.
 * The avatar changes only when the step really completes; see actions/steps.ts.
 */
export function StepCard({ step, index, total, done, onBack, onNext, products, extra, onFinished }: StepCardProps) {
  const look = useStudio((s) => s.look)
  const action = useStudio((s) => s.action)
  const ready = useStudio((s) => s.characterReady)
  const list = products ?? step.products
  const [productId, setProductId] = useState(list[0]?.id ?? '')
  const [option, setOption] = useState(step.options?.list[0]?.id ?? null)
  const targets = step.targets?.(look) ?? null
  const [targetId, setTargetId] = useState<string | null>(null)
  const target = targets ? (targets.find((t) => t.id === targetId) ?? targets[0] ?? null) : null
  const blocked = step.blocked?.(look) ?? (targets && !targets.length ? 'Nothing to do here right now.' : null)
  const product = list.find((p) => p.id === productId) ?? list[0] ?? { id: 'hands', name: 'Hands', blurb: '', color: '#ffffff' }
  const busy = !!action

  const play = async () => {
    const r = await runStep(step, { product, target: target?.id ?? null, option, extra })
    if (r !== 'cancelled') onFinished?.()
  }

  return (
    <div className="ds-enter flex flex-col gap-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {index && total ? (
            <div className="mb-1.5 flex items-center gap-2" aria-label={`Step ${index} of ${total}`}>
              <span className="text-[11px] uppercase tracking-[0.18em] text-accent">
                Step {index} of {total}
              </span>
              <span className="flex flex-1 gap-0.5" aria-hidden>
                {Array.from({ length: total }, (_, i) => (
                  <span key={i} className={`h-1 flex-1 rounded-full ${i < index - 1 ? 'bg-accent/70' : i === index - 1 ? 'bg-accent' : 'bg-line'}`} />
                ))}
              </span>
            </div>
          ) : null}
          <h3 className="flex items-center gap-2 font-display text-[22px] leading-tight">
            {step.name}
            {done && (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-accent-ink" aria-label="Done">
                <Icon name="check" className="h-3.5 w-3.5" />
              </span>
            )}
          </h3>
          <p className="mt-0.5 text-[13px] text-muted">{step.blurb}</p>
          {step.note && <p className="mt-1 text-[11px] text-muted/80">{step.note}</p>}
        </div>
      </div>
      <ProductPicker products={list} value={product.id} onPick={(p) => setProductId(p.id)} label={`${step.name} product`} />
      {step.options && <Chips label={step.options.label} value={option} onPick={setOption} options={step.options.list} />}
      {targets && targets.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Which one</p>
          <Chips label="Target" value={target?.id ?? null} onPick={setTargetId} options={targets} />
        </div>
      )}
      {blocked && <p className="rounded-xl border border-line px-3 py-2 text-[12px] text-muted">{blocked}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {onBack && (
          <button type="button" onClick={onBack} aria-label="Previous step" className="grid h-11 w-11 place-items-center rounded-full border border-line">
            <Icon name="back" className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          disabled={busy || !!blocked || !ready}
          onClick={play}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-accent px-5 font-display text-[16px] text-accent-ink disabled:opacity-40"
        >
          <Icon name={done ? 'replay' : 'play'} className="h-4 w-4" />
          {!ready ? 'Getting ready…' : done ? 'Do it again' : 'Start'}
        </button>
        {onNext && (
          <button type="button" onClick={onNext} className="flex min-h-11 items-center gap-1 rounded-full border border-line px-4 text-[13px]">
            {done ? 'Next' : 'Skip step'}
            <Icon name="next" className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
