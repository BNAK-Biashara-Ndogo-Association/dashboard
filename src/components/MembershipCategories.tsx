import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { membershipService } from '../services/membershipService';
import type { MembershipPackage } from '../types';

export function MembershipCategories({ packages, selectedId, onSelect }: { packages: MembershipPackage[]; selectedId?: string; onSelect?: (id: string) => void }) {
  return <section className="mt-6" aria-labelledby="membership-categories-heading">
    <h2 id="membership-categories-heading" className="text-xl font-semibold">Find your BNAK network</h2>
    <p className="mt-2 text-sm text-muted">Nine membership categories. Choose the network that matches your business.</p>
    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{packages.map(item => <article key={item.id} className="panel p-6 flex flex-col gap-3">
      <div className="flex items-center gap-3"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={item.icon || 'M4 4h16v16H4Z'} /></svg><h3 className="font-semibold">{item.title}</h3></div>
      <p className="text-xl font-semibold">KSh {item.amount.toLocaleString('en-KE')}</p>
      <p className="text-sm text-muted">{item.audience}</p>
      {item.targets?.length ? <><h4 className="text-sm font-semibold">Who should join</h4><ul className="list-disc pl-5 text-sm text-muted space-y-1">{item.targets.map(target => <li key={target}>{target}</li>)}</ul></> : null}
      <div className="mt-auto pt-4">{onSelect ? <button type="button" className="secondary-button" aria-pressed={selectedId === item.id} onClick={() => onSelect(item.id)}>{selectedId === item.id ? 'Selected: ' : 'Choose '}{item.title}</button> : <Link className="text-link" to={'/dashboard/registration?category=' + encodeURIComponent(item.id)}>Register for {item.title}</Link>}</div>
    </article>)}</div>
  </section>;
}

export function MembershipNetworkBrowser() {
  const [packages, setPackages] = useState<MembershipPackage[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; membershipService.config().then(config => { if (active) setPackages(config.packages); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load membership categories.'); }); return () => { active = false; }; }, []);
  if (error) return <p className="notice mt-5" role="alert">{error}</p>;
  if (!packages.length) return <p className="mt-5" role="status">Loading membership categories?</p>;
  return <MembershipCategories packages={packages} />;
}
