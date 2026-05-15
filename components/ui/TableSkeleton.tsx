import { Skeleton } from "@heroui/react";

interface Props {
  rows?: number;
  cols?: number;
}

export default function TableSkeleton({ rows = 6, cols = 6 }: Props) {
  return (
    <div className="divide-y" style={{ borderColor: "var(--border)" }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          {/* Avatar + name block */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-3.5 rounded-md w-2/5" />
              <Skeleton className="h-3 rounded-md w-1/3" />
            </div>
          </div>

          {/* Badge placeholders */}
          {Array.from({ length: cols - 1 }).map((_, c) => (
            <Skeleton
              key={c}
              className="h-6 rounded-full shrink-0"
              style={{ width: `${48 + (c % 3) * 12}px` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
