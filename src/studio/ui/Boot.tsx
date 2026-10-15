/** Shown only when the game can't load: the reason and Try again. (There is no loading screen.) */
export function Boot({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="ds-boot-gradient absolute inset-0 z-40 grid place-items-center" role="alert">
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <p className="max-w-xs text-[15px] font-semibold text-white">{error}</p>
        <button type="button" onClick={onRetry} className="min-h-11 rounded-full bg-white px-6 text-[16px] font-black text-[#2b1622]">
          Try again
        </button>
      </div>
    </div>
  )
}
