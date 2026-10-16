// Eyebrow label + title + optional badge, with right-side actions as children.
export default function SectionTitle({ eyebrow, title, badge, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div className="grid gap-0.5">
        {eyebrow && (
          <span className="text-xs font-bold uppercase tracking-wider text-[#5c5c5c]">{eyebrow}</span>
        )}
        <h2 className="flex flex-wrap items-center gap-2 text-xl">
          {title}
          {badge}
        </h2>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
