import { ArrowUpRight, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Event } from '../types';
export function EventCard({ event }: { event: Event }) {
  const date = new Date(`${event.date}T12:00:00`);
  return <article className="event-card"><div className="flex items-start gap-4"><div className="date-tile"><span>{date.toLocaleDateString('en-GB', { month: 'short' })}</span><strong>{date.getDate()}</strong></div><div className="min-w-0"><p className="eyebrow">{event.category}</p><h3 className="mt-1 font-semibold">{event.name}</h3><p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><MapPin size={14} className="shrink-0" />{event.location}</p><p className="mt-1 text-xs text-muted">{date.getFullYear()} · {event.time}</p></div></div><Link to={`/dashboard/events/${event.id}`} className="text-link mt-4 justify-end">View details <ArrowUpRight size={15} /></Link></article>;
}
