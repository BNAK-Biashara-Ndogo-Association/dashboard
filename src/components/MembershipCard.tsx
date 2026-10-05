import { ArrowUpRight, Download, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Member, Membership } from '../types';
import { formatDate } from '../services/memberService';
import { StatusBadge } from './StatusBadge';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);
}

function downloadCertificate(member: Member, membership: Membership) {
  const issuedOn = new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  const certificate = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>BNAK Membership Certificate</title>
<style>
@page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{margin:0;background:#eef2ed;color:#25372e;font-family:Georgia,'Times New Roman',serif}.sheet{position:relative;display:flex;min-height:210mm;align-items:center;justify-content:center;padding:22mm;background:#fff}.frame{display:flex;width:100%;min-height:166mm;flex-direction:column;align-items:center;justify-content:center;border:2px solid #174b3a;outline:1px solid #bc9a49;outline-offset:-8px;padding:20mm;text-align:center}.brand{font-family:Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:3px;color:#174b3a}.eyebrow{margin:24px 0 8px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#9a7c3c}.title{margin:0;font-size:35px;font-weight:400}.rule{width:70px;margin:18px auto;border:0;border-top:1px solid #bc9a49}.recipient{margin:8px 0;font-size:31px;color:#174b3a}.copy{max-width:650px;font-size:16px;line-height:1.7}.details{display:flex;gap:56px;margin-top:30px;font-family:Arial,sans-serif}.details p{margin:0;text-align:left}.details span{display:block;margin-bottom:6px;font-size:9px;letter-spacing:1px;color:#748078;text-transform:uppercase}.details strong{font-size:13px;font-weight:600}.issued{margin-top:26px;font-family:Arial,sans-serif;font-size:11px;color:#748078}.print{position:fixed;right:20px;top:20px;border:0;border-radius:4px;background:#174b3a;padding:11px 16px;color:white;font:600 12px Arial,sans-serif;cursor:pointer}@media print{body{background:white}.sheet{min-height:210mm}.print{display:none}}
</style></head><body><button class="print" onclick="window.print()">Print / Save as PDF</button><main class="sheet"><article class="frame"><p class="brand">BNAK</p><p class="eyebrow">Biashara Ndogo Association of Kenya</p><h1 class="title">Certificate of Membership</h1><hr class="rule"><p class="copy">This certifies that</p><h2 class="recipient">${escapeHtml(`${member.firstName} ${member.lastName}`)}</h2><p class="copy">is an active member of the Biashara Ndogo Association of Kenya.</p><div class="details"><p><span>Membership ID</span><strong>${escapeHtml(member.membershipNumber)}</strong></p><p><span>Membership package</span><strong>${escapeHtml(membership.plan)}</strong></p><p><span>Valid until</span><strong>${escapeHtml(formatDate(membership.validUntil))}</strong></p></div><p class="issued">Issued ${escapeHtml(issuedOn)}</p></article></main></body></html>`;
  const url = URL.createObjectURL(new Blob([certificate], { type: 'text/html;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `BNAK-${member.membershipNumber}-membership-certificate.html`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function MembershipCard({ member, membership }: { member: Member; membership: Membership }) {
  return <section className="panel overflow-hidden">
    <div className="section-heading"><h2>Membership details</h2><ShieldCheck size={20} className="text-muted" /></div>
    <div className="membership-body">
      <div className="member-pass"><div className="flex items-center justify-between"><span className="font-bold tracking-wider">BNAK<span className="brand-dot">.</span></span><ShieldCheck size={25} /></div><p className="mt-8 text-xs text-white/70">BUSINESS MEMBER</p><p className="mt-2 text-xl font-semibold">{member.firstName} {member.lastName}</p><div className="mt-6 flex items-end justify-between gap-2"><span className="font-mono text-sm">{member.membershipNumber}</span><span className="text-[10px] text-white/70">GROWING TOGETHER</span></div></div>
      <dl className="detail-list">{[['Membership number', member.membershipNumber], ['Membership plan', membership.plan], ['Status', <StatusBadge key="status" status={membership.status} />], ['Joined', formatDate(membership.joinedAt)], ['Valid until', formatDate(membership.validUntil)]].map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </div>
    <div className="panel-footer"><span className="text-xs text-muted">Your connection to a stronger business community.</span><div className="flex items-center gap-3">
      {membership.status === 'active' && <button type="button" className="icon-button" title="Download membership certificate" aria-label="Download membership certificate" onClick={() => downloadCertificate(member, membership)}><Download size={18} /></button>}
      <Link to="/dashboard/membership" className="text-link">Manage membership <ArrowUpRight size={15} /></Link>
    </div></div>
  </section>;
}
