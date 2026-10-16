// Fixed bottom bar: counter text left, CTA children right.
// Renders its own layout spacer so page content never hides behind the bar.
export default function StickyCta({ counter, children }) {
  return (
    <>
      <div className="cta-spacer" aria-hidden="true" />
      <div className="sticky-cta">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 p-3">
          {counter && <span className="text-sm font-bold">{counter}</span>}
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{children}</div>
        </div>
      </div>
    </>
  )
}
