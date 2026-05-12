interface Props {
  rows?: number;
  cols?: number;
}

export default function TableSkeleton({ rows = 6, cols = 6 }: Props) {
  return (
    <div className="animate-pulse divide-y" style={{ borderColor: "var(--border)" }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          {/* Name + email block */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className="h-9 w-9 rounded-xl shrink-0"
              style={{ background: "var(--surface-2)" }}
            />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="h-3.5 rounded-md w-2/5" style={{ background: "var(--surface-2)" }} />
              <div className="h-3   rounded-md w-1/3" style={{ background: "var(--surface-2)" }} />
            </div>
          </div>

          {/* Badge placeholders */}
          {Array.from({ length: cols - 1 }).map((_, c) => (
            <div
              key={c}
              className="h-6 rounded-full shrink-0"
              style={{ background: "var(--surface-2)", width: `${48 + (c % 3) * 12}px` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
