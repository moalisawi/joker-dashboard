interface Props {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-4">
      {icon && (
        <div className="opacity-20 mb-1">{icon}</div>
      )}
      <p className="font-bold text-base" style={{ color: "var(--text-primary)" }}>
        {title}
      </p>
      {description && (
        <p className="text-sm max-w-xs" style={{ color: "var(--text-secondary)" }}>
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
