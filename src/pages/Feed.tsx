import { useState } from 'react'
import { Link } from 'react-router'
import { AppShell, EmptyState, PageBody, Skeleton } from '../components/AppShell'
import { DollAvatar } from '../components/art/DollAvatar'
import { ChoiceChips } from '../components/Swatches'
import { PostCard } from '../components/PostCard'
import { runAction } from '../hooks/useAction'
import { useQueryDocs } from '../hooks/useData'
import { buttonClass, chipClass, inputClass } from '../lib/ui'
import { C } from '../shared/paths'
import type { PostDoc, PostKind } from '../shared/types'
import { useSession } from '../store/useSession'
import { toast } from '../store/useToasts'

export default function Feed() {
  const pub = useSession((s) => s.publicDoll)
  const friends = useSession((s) => s.friendUids)
  const blocked = useSession((s) => s.blockedUids)
  const [scope, setScope] = useState<'everyone' | 'friends'>('everyone')
  const [limit, setLimit] = useState(20)
  const { data, loading } = useQueryDocs<PostDoc>(C.posts, { orderBy: ['createdAt', 'desc'], limit })
  const [caption, setCaption] = useState('')
  const [kind, setKind] = useState<PostKind>('look')
  const posts = data.filter((p) => !blocked.includes(p.authorId) && (scope === 'everyone' || friends.includes(p.authorId) || p.authorId === pub?.uid))

  return (
    <AppShell title="Feed">
      <PageBody className="flex max-w-2xl flex-col gap-4">
        <section className="flex flex-col gap-3 rounded-[var(--radius-sheet)] border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <DollAvatar avatar={pub?.avatar} portrait={pub?.portrait} />
            <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={280} placeholder="Say something about your look…" className={inputClass} aria-label="Caption" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ChoiceChips
              label="Post type"
              hideLabel
              options={[
                { id: 'look', label: 'Current look' },
                { id: 'selfie', label: 'Selfie' },
              ]}
              value={kind}
              onChange={setKind}
            />
            <button
              type="button"
              className={buttonClass('primary', 'md')}
              onClick={async () => {
                const r = await runAction('createPost', { kind, caption })
                if (r) {
                  setCaption('')
                  toast.success('Posted')
                }
              }}
            >
              Post
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Full-body shots: <Link to="/wardrobe" className="font-semibold underline">post from your wardrobe</Link>. Apartment tours: <Link to="/crib" className="font-semibold underline">share from your crib</Link>.
          </p>
        </section>

        <div className="flex gap-2">
          <button type="button" aria-pressed={scope === 'everyone'} onClick={() => setScope('everyone')} className={chipClass(scope === 'everyone')}>
            Everyone
          </button>
          <button type="button" aria-pressed={scope === 'friends'} onClick={() => setScope('friends')} className={chipClass(scope === 'friends')}>
            Friends
          </button>
        </div>

        {loading && !data.length ? (
          <Skeleton className="h-96" />
        ) : posts.length ? (
          <>
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
            {data.length >= limit && (
              <button type="button" className={buttonClass('secondary', 'md', 'self-center')} onClick={() => setLimit(limit + 20)}>
                Load more
              </button>
            )}
          </>
        ) : (
          <EmptyState icon="image" title="Quiet in here" body="Be the first to post a look." />
        )}
      </PageBody>
    </AppShell>
  )
}
