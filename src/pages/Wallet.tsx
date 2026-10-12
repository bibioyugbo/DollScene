import { Link } from 'react-router'
import { AppShell, EmptyState, PageBody, Skeleton } from '../components/AppShell'
import { Icon } from '../components/Icon'
import { useQueryDocs } from '../hooks/useData'
import { cx, formatGlam, timeAgo } from '../lib/ui'
import { CURRENCY, PREMIUM } from '../shared/economy'
import { C } from '../shared/paths'
import type { TransactionDoc } from '../shared/types'
import { useSession } from '../store/useSession'

const WAYS = [
  { to: '/crib', label: 'Daily and weekly missions' },
  { to: '/dollscene/runway', label: 'Enter and vote in fashion challenges' },
  { to: '/work', label: 'Work shifts and get promoted' },
  { to: '/crib', label: 'Tutorial goals like “Fill your space”' },
]

/** Balances plus a server-recorded history of every reward and purchase. */
export default function Wallet() {
  const uid = useSession((s) => s.user!.uid)
  const p = useSession((s) => s.progress)!
  const { data, loading } = useQueryDocs<TransactionDoc & { id?: string }>(C.transactions, { where: [['uid', '==', uid]], orderBy: ['createdAt', 'desc'], limit: 100 })
  return (
    <AppShell title="Wallet">
      <PageBody className="flex max-w-2xl flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[var(--radius-sheet)] border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{CURRENCY.name} · earned by playing</p>
            <p className="font-display text-4xl font-extrabold tabular-nums">{formatGlam(p.dollies)}</p>
          </div>
          <div className="rounded-[var(--radius-sheet)] border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{PREMIUM.name} · premium, kept separate</p>
            <p className="font-display text-4xl font-extrabold tabular-nums">{p.gems}</p>
            <p className="mt-1 text-xs text-muted-foreground">Gem purchases aren’t on sale yet. Nothing in the game requires them.</p>
          </div>
        </div>
        <section className="rounded-[var(--radius-sheet)] border border-border bg-card p-5">
          <h2 className="mb-2 font-display text-lg font-extrabold">Ways to earn</h2>
          <ul className="flex flex-col">
            {WAYS.map((w) => (
              <li key={w.to}>
                <Link to={w.to} className="flex min-h-11 items-center justify-between rounded-xl px-2 hover:bg-muted">
                  {w.label} <Icon name="forward" className="size-4" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-extrabold">History</h2>
          {loading ? (
            <Skeleton className="h-48" />
          ) : data.length ? (
            <ul className="divide-y divide-border rounded-[var(--radius-sheet)] border border-border bg-card">
              {data.map((t, i) => (
                <li key={`${t.createdAt}-${i}`} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{t.reason}</span>
                    <span className="block text-xs text-muted-foreground">{timeAgo(t.createdAt)}</span>
                  </span>
                  <span className={cx('font-semibold tabular-nums', t.amount > 0 ? 'text-[#15803D] dark:text-acid' : 'text-foreground')}>
                    {t.amount > 0 ? '+' : ''}
                    {formatGlam(t.amount)} {t.currency === 'gems' ? PREMIUM.name : CURRENCY.short}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="coin" title="No activity yet" body="Rewards and purchases show up here, recorded by the server." />
          )}
        </section>
      </PageBody>
    </AppShell>
  )
}
