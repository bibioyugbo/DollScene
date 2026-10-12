import { useEffect } from 'react'
import { Link } from 'react-router'
import { AppShell, EmptyState, PageBody, Skeleton } from '../components/AppShell'
import { Icon, type IconName } from '../components/Icon'
import { useQueryDocs } from '../hooks/useData'
import { cx, timeAgo } from '../lib/ui'
import { backend } from '../services/backend'
import { P } from '../shared/paths'
import type { NotificationDoc, NotificationType } from '../shared/types'
import { useSession } from '../store/useSession'

const ICON: Record<NotificationType, IconName> = {
  'friend-request': 'people',
  'friend-accepted': 'check',
  message: 'chat',
  'message-request': 'chat',
  like: 'heart',
  comment: 'comment',
  follow: 'user',
  promotion: 'trophy',
  visit: 'door',
  system: 'bell',
}

export default function Notifications() {
  const uid = useSession((s) => s.user!.uid)
  const { data, loading } = useQueryDocs<NotificationDoc>(P.notifications(uid), { orderBy: ['createdAt', 'desc'], limit: 60 })

  // Mark everything read once seen.
  useEffect(() => {
    const unread = data.filter((n) => !n.read)
    if (!unread.length) return
    const t = window.setTimeout(() => {
      backend()
        .db.write(unread.slice(0, 400).map((n) => ({ type: 'update' as const, path: P.notification(uid, n.id), data: { read: true } })))
        .catch(() => undefined)
    }, 800)
    return () => window.clearTimeout(t)
  }, [data, uid])

  return (
    <AppShell title="Notifications">
      <PageBody className="flex max-w-2xl flex-col gap-2">
        {loading ? (
          <Skeleton className="h-64" />
        ) : data.length ? (
          <ul className="flex flex-col gap-1">
            {data.map((n) => {
              const body = (
                <>
                  <span className={cx('grid size-10 shrink-0 place-items-center rounded-full', n.read ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-primary')}>
                    <Icon name={ICON[n.type]} className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cx('block text-sm', !n.read && 'font-semibold')}>{n.text}</span>
                    <span className="block text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="size-2.5 shrink-0 rounded-full bg-primary" aria-label="unread" />}
                </>
              )
              return (
                <li key={n.id}>
                  {n.link ? (
                    <Link to={n.link} className="flex items-center gap-3 rounded-2xl p-3 hover:bg-muted">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 rounded-2xl p-3">{body}</div>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState icon="bell" title="All caught up" body="Friend requests, likes, promotions and visits show up here." />
        )}
      </PageBody>
    </AppShell>
  )
}
