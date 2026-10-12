import { useState } from 'react'
import { Link } from 'react-router'
import { runAction } from '../hooks/useAction'
import { useDoc, useQueryDocs, useResolvedUrl } from '../hooks/useData'
import { buttonClass, cx, inputClass, timeAgo } from '../lib/ui'
import { P } from '../shared/paths'
import type { CommentDoc, PostDoc } from '../shared/types'
import { useSession } from '../store/useSession'
import { DollAvatar } from './art/DollAvatar'
import { DollFigure } from './art/DollFigure'
import { Icon } from './Icon'
import { ReportDialog } from './social'

function PostImage({ post }: { post: PostDoc }) {
  const src = useResolvedUrl(post.image)
  if (src) return <img src={src} alt={post.caption || `${post.authorName}'s ${post.kind}`} className="aspect-[4/5] w-full object-cover" loading="lazy" />
  return (
    <div className="grid aspect-[4/5] w-full place-items-center bg-[linear-gradient(160deg,#F5D4DA,#DCD9E2)] py-6">
      <DollFigure avatar={post.authorAvatar} outfit={post.outfit ?? {}} className="h-full w-auto" />
    </div>
  )
}

export function PostCard({ post }: { post: PostDoc }) {
  const me = useSession((s) => s.user?.uid)
  const like = useDoc<{ uid: string }>(me ? P.like(post.id, me) : null)
  const [showComments, setShowComments] = useState(false)
  const [report, setReport] = useState(false)
  const liked = !!like.data
  return (
    <article id={post.id} className="overflow-hidden rounded-[var(--radius-sheet)] border border-border bg-card">
      <header className="flex items-center gap-3 p-3">
        <Link to={`/u/${post.authorId}`} className="flex min-w-0 flex-1 items-center gap-3">
          <DollAvatar avatar={post.authorAvatar} portrait={post.authorPortrait} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{post.authorName}</span>
            <span className="block text-xs text-muted-foreground">
              {post.kind === 'apartment' ? 'Apartment tour' : post.kind === 'selfie' ? 'Selfie' : 'New look'} · {timeAgo(post.createdAt)}
            </span>
          </span>
        </Link>
        {me && post.authorId === me ? (
          <button type="button" aria-label="Delete post" className="grid size-10 place-items-center rounded-full hover:bg-muted" onClick={() => window.confirm('Delete this post?') && runAction('deletePost', { postId: post.id })}>
            <Icon name="trash" className="size-4" />
          </button>
        ) : (
          <button type="button" aria-label="Report post" className="grid size-10 place-items-center rounded-full hover:bg-muted" onClick={() => setReport(true)}>
            <Icon name="flag" className="size-4" />
          </button>
        )}
      </header>
      <button type="button" className="block w-full" onDoubleClick={() => !liked && runAction('toggleLike', { postId: post.id })} aria-label="Double-tap to like">
        <PostImage post={post} />
      </button>
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-1">
          <button type="button" aria-pressed={liked} aria-label={liked ? 'Unlike' : 'Like'} onClick={() => runAction('toggleLike', { postId: post.id })} className={cx('flex min-h-10 items-center gap-1.5 rounded-full px-3 font-semibold hover:bg-muted', liked && 'text-primary')}>
            <Icon name="heart" filled={liked} /> {post.likes}
          </button>
          <button type="button" onClick={() => setShowComments(!showComments)} className="flex min-h-10 items-center gap-1.5 rounded-full px-3 font-semibold hover:bg-muted" aria-expanded={showComments}>
            <Icon name="comment" /> {post.comments}
          </button>
        </div>
        {post.caption && (
          <p className="text-sm">
            <span className="font-semibold">{post.authorName}</span> {post.caption}
          </p>
        )}
        {showComments && <Comments post={post} />}
      </div>
      {me && <ReportDialog open={report} onClose={() => setReport(false)} targetType="post" targetId={post.id} targetUid={post.authorId} name={post.authorName} />}
    </article>
  )
}

function Comments({ post }: { post: PostDoc }) {
  const { data } = useQueryDocs<CommentDoc>(P.comments(post.id), { orderBy: ['createdAt', 'asc'], limit: 100 })
  const [text, setText] = useState('')
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-2">
      <ul className="flex flex-col gap-1.5">
        {data.map((c) => (
          <li key={c.id} className="text-sm">
            <Link to={`/u/${c.authorId}`} className="font-semibold">
              {c.authorName}
            </Link>{' '}
            {c.text} <span className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!text.trim()) return
          const r = await runAction('addComment', { postId: post.id, text })
          if (r) setText('')
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment" maxLength={500} className={cx(inputClass, 'min-h-10')} aria-label="Comment" />
        <button type="submit" className={buttonClass('primary', 'sm')} disabled={!text.trim()}>
          Post
        </button>
      </form>
    </div>
  )
}
