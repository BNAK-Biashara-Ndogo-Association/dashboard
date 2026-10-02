import type { LucideIcon } from 'lucide-react';
export function StatCard({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: LucideIcon }) {
  return <article className="panel stat-card"><div className="flex items-center justify-between gap-3"><p className="text-sm text-muted">{label}</p><span className="icon-tile"><Icon size={20} /></span></div><p className="stat-value">{value}</p><p className="mt-2 text-xs text-muted">{note}</p></article>;
}
