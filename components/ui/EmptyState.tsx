interface Props {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ padding: "48px 20px", gap: 12 }}
    >
      {icon && (
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "var(--jk-panel)",
            color: "var(--jk-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 4,
          }}
        >
          {icon}
        </div>
      )}
      <p style={{ color: "var(--jk-text)", fontSize: 15, fontWeight: 700 }}>
        {title}
      </p>
      {description && (
        <p style={{ color: "var(--jk-muted)", fontSize: 13, maxWidth: 320, lineHeight: 1.6 }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
