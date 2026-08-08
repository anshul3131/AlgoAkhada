interface ApiStatusProps {
  label: string;
  value: string;
}

export function ApiStatus({ label, value }: ApiStatusProps) {
  return (
    <div className="rounded-lg border border-border-hairline bg-bg-panel-raised px-3 py-2 text-xs uppercase tracking-[0.18em] text-text-secondary">
      <div>{label}</div>
      <div className="mt-1 font-mono text-sm text-text-primary">{value}</div>
    </div>
  );
}
