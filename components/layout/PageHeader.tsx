"use client";

interface Props {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, actions, children }: Props) {
  return (
    <div className="mb-7">
      <div className="flex items-start justify-between gap-3 mb-1">
        {/* Title + subtitle */}
        <div className="flex-1 min-w-0">
          <h1 className="page-title">
            {title}
          </h1>
          {subtitle && (
            <p className="page-subtitle">
              {subtitle}
            </p>
          )}
        </div>

        {/* Action buttons */}
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0 pt-1">
            {actions}
          </div>
        )}
      </div>

      {/* Optional row below (e.g. date filter) */}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
