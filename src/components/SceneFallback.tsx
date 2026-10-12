export function SceneFallback({ label }: { label: string }) {
  return (
    <div className="grid h-full w-full place-items-center" role="status">
      <div className="flex flex-col items-center gap-3">
        <span aria-hidden className="size-14 rounded-full bg-primary/20 motion-safe:animate-pulse" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}
