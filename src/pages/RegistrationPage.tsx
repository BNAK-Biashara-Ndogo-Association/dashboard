import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Clock3, FileCheck2, LoaderCircle, RefreshCw, ShieldCheck, Smartphone, Upload } from 'lucide-react';
import { memberService } from '../services/memberService';
import { membershipService } from '../services/membershipService';
import { paymentService } from '../services/paymentService';
import type { KycRegistration, MembershipConfig } from '../types';
import type { DarajaPayment, PaymentConfig } from '../services/paymentService';

const declaration = 'I confirm that the information provided is accurate and consent to Biashara Ndogo Association of Kenya (BNAK) collecting and processing my information for membership administration, KYC verification, communication, business support, programmes, research, advocacy and other legitimate organizational purposes in accordance with applicable data protection requirements.';
const fileLimit = 5 * 1024 * 1024;
const formatKsh = (amount: number) => `KSh ${new Intl.NumberFormat('en-KE').format(amount)}`;

function selectedFile(form: HTMLFormElement, name: string) {
  const file = (new FormData(form).get(name));
  return file instanceof File && file.size ? file : null;
}
function filePayload(file: File) {
  return new Promise<{ name: string; mimeType: string; data: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => resolve({ name: file.name, mimeType: file.type, data: String(reader.result).split(',')[1] || '' });
    reader.readAsDataURL(file);
  });
}
function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`kyc-field ${className}`}><span>{label}</span>{children}</label>;
}
function SelectField({ label, name, options, placeholder, required = true }: { label: string; name: string; options: string[]; placeholder: string; required?: boolean }) {
  return <Field label={label}><select className="kyc-input" name={name} required={required} defaultValue=""><option value="" disabled>{placeholder}</option>{options.map(option => <option key={option} value={option}>{option}</option>)}</select></Field>;
}
function UploadField({ label, name }: { label: string; name: string }) {
  const [filename, setFilename] = useState('');
  return <Field label={label}><span className="kyc-upload"><Upload size={18} /><span><strong>{filename || 'Choose file'}</strong><small>{filename ? 'Selected' : 'JPEG, PNG, WebP or PDF · up to 5 MB'}</small></span><input name={name} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event => setFilename(event.target.files?.[0]?.name || '')} required /></span></Field>;
}
function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return <section className="kyc-section"><div className="kyc-section-heading"><span>{number}</span><h3>{title}</h3></div><div className="kyc-fields">{children}</div></section>;
}

export function RegistrationPage() {
  const [config, setConfig] = useState<MembershipConfig | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [registration, setRegistration] = useState<KycRegistration | null>(null);
  const [payment, setPayment] = useState<DarajaPayment | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [selectedLocationType, setSelectedLocationType] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const requestKey = useRef<string | null>(null);
  const pollState = useRef({ id: '', attempts: 0 });

  useEffect(() => {
    let current = true;
    Promise.all([membershipService.config(), membershipService.registration()]).then(([nextConfig, nextRegistration]) => {
      if (current) { setConfig(nextConfig); setRegistration(nextRegistration); }
    }).catch(reason => { if (current) setError(reason instanceof Error ? reason.message : 'Could not load registration.'); })
      .finally(() => { if (current) setLoading(false); });
    paymentService.config().then(value => { if (current) setPaymentConfig(value); }).catch(reason => { if (current) setNotice(reason instanceof Error ? reason.message : 'M-PESA is temporarily unavailable.'); });
    paymentService.list().then(history => { if (current && history[0]) setPayment(history[0]); }).catch(() => { /* Registration remains available if payment history is offline. */ });
    return () => { current = false; };
  }, []);

  const checkPayment = useCallback(async (id: string) => {
    setChecking(true);
    try {
      setPayment(await paymentService.refresh(id));
      const latest = await membershipService.registration();
      setRegistration(latest);
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not verify the payment.'); }
    finally { setChecking(false); }
  }, []);

  useEffect(() => {
    if (!paymentConfig?.ready || !payment?.canCheck || payment.status !== 'pending') return;
    if (pollState.current.id !== payment.id) pollState.current = { id: payment.id, attempts: 0 };
    if (pollState.current.attempts >= 8) return;
    const timer = window.setTimeout(() => {
      pollState.current.attempts++;
      void checkPayment(payment.id);
    }, 15000);
    return () => window.clearTimeout(timer);
  }, [payment?.id, payment?.canCheck, payment?.status, paymentConfig?.ready, checking, checkPayment]);

  async function beginPayment(record: KycRegistration, phone: string) {
    if (!paymentConfig?.ready) { setNotice(paymentConfig?.message || 'Your registration is saved. M-PESA payment is not available yet.'); setBusy(false); return; }
    setBusy(true); setError(''); setNotice('');
    requestKey.current ??= crypto.randomUUID();
    try {
      const nextPayment = await paymentService.initiate(phone, record.packageId, requestKey.current);
      requestKey.current = null;
      setPayment(nextPayment);
      setRegistration(await membershipService.registration());
      setNotice('Your registration is submitted. Follow the M-PESA prompt on your phone.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not send the M-PESA prompt.');
      try {
        const [latest, history] = await Promise.all([membershipService.registration(), paymentService.list()]);
        setRegistration(latest);
        if (history[0]) setPayment(history[0]);
      } catch { /* Keep the original payment error visible. */ }
    } finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !config) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const form = event.currentTarget;
      const front = selectedFile(form, 'idFront');
      const back = selectedFile(form, 'idBack');
      if (!front || !back) throw new Error('Upload both sides of your National ID or passport.');
      if (front.size > fileLimit || back.size > fileLimit) throw new Error('Each ID file must be 5 MB or smaller.');
      const values = new FormData(form);
      const value = (name: string) => String(values.get(name) ?? '');
      const normalizedPaymentPhone = value('paymentMobileNumber').replace(/[\s()-]/g, '').replace(/^\+/, '');
      if (!/^(?:0|254)[17]\d{8}$/.test(normalizedPaymentPhone)) throw new Error('Enter a Kenyan M-PESA number such as 0712345678 or +254712345678.');
      const nextRegistration = await membershipService.submit({
        fullName: value('fullName'), idNumber: value('idNumber'), gender: value('gender'), ageGroup: value('ageGroup'),
        mobileNumber: value('mobileNumber'), county: value('county'), constituency: value('constituency'), ward: value('ward'),
        businessArea: value('businessArea'), locationType: value('locationType'), otherLocationType: value('otherLocationType'),
        locationName: value('locationName'), businessName: value('businessName'), sector: value('sector'),
        registrationStatus: value('registrationStatus'), employees: value('employees'), turnover: value('turnover'),
        packageId: value('packageId'), paymentMobileNumber: value('paymentMobileNumber'), consent: values.get('consent') === 'on',
        idFront: await filePayload(front), idBack: await filePayload(back),
      });
      setRegistration(nextRegistration);
      await beginPayment(nextRegistration, nextRegistration.paymentMobileNumber);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not submit your registration.');
      setBusy(false);
    }
  }

  async function paySavedRegistration() {
    if (!registration) return;
    await beginPayment(registration, registration.paymentMobileNumber);
  }

  const selectedPackage = config?.packages.find(item => item.id === registration?.packageId);
  if (loading) return <><div className="page-intro"><div><p className="eyebrow mb-2">BNAK MEMBER PORTAL</p><h2>Registration & KYC</h2><p>Loading your membership registration…</p></div></div><div className="panel p-6 text-sm text-muted">Please wait.</div></>;

  return <>
    <div className="page-intro"><div><p className="eyebrow mb-2">BIASHARA NDOGO ASSOCIATION OF KENYA</p><h2>Member registration & KYC</h2><p>Please complete the required fields. Registration takes approximately 2–3 minutes.</p></div><span className="member-number"><Clock3 size={15} />2–3 minutes</span></div>
    {error && <div role="alert" className="payment-error mb-5">{error}</div>}
    {notice && <div role="status" className="notice mb-5">{notice}</div>}
    {!config ? <section className="panel p-6">Membership registration is temporarily unavailable.</section> : registration ? <>
      <section className="registration-result">
        <div className="registration-result-head"><span className="registration-check"><Check size={22} /></span><div><p className="eyebrow">REGISTRATION RECEIVED</p><h3>{registration.membershipStatus === 'active' ? 'Your membership is active' : 'Your application is pending'}</h3><p>{registration.membershipStatus === 'active' ? 'Your payment has been verified and your BNAK membership is active.' : 'Your details and identity documents are submitted. Membership activates after successful payment verification.'}</p></div></div>
        <dl className="registration-summary">
          <div><dt>BNAK Membership ID</dt><dd>{registration.membershipNumber || 'Generated after successful payment'}</dd></div>
          <div><dt>Membership package</dt><dd>{selectedPackage?.title || registration.packageId}{selectedPackage ? ` · ${formatKsh(selectedPackage.amount)}` : ''}</dd></div>
          <div><dt>Payment reference</dt><dd>{registration.paymentReference || 'Awaiting payment'}</dd></div>
          <div><dt>Payment status</dt><dd><span className={`status status-${registration.paymentStatus === 'paid' ? 'active' : registration.paymentStatus}` }><span />{registration.paymentStatus === 'paid' ? 'Successful' : registration.paymentStatus === 'failed' ? 'Failed' : 'Pending'}</span></dd></div>
          <div><dt>Membership status</dt><dd><span className={`status status-${registration.membershipStatus}`}><span />{registration.membershipStatus.toUpperCase()}</span></dd></div>
          <div><dt>KYC status</dt><dd><span className="status status-pending"><span />{registration.kycStatus}</span></dd></div>
          <div><dt>National ID / passport</dt><dd>{registration.documents.frontUploaded && registration.documents.backUploaded ? 'Front and back received' : 'Documents incomplete'}</dd></div>
          <div><dt>Verified by</dt><dd>{registration.verifiedBy || 'Pending review'}</dd></div>
          <div><dt>Verification date</dt><dd>{registration.verifiedAt || 'Pending review'}</dd></div>
        </dl>
        {registration.membershipStatus !== 'active' && <div className="registration-payment">
          <div><div className="flex items-center gap-2 font-semibold"><Smartphone size={17} />M-PESA STK Push</div><p className="mt-1 text-xs leading-5 text-muted">An STK prompt is sent to {registration.paymentMobileNumber}. Enter your PIN on your phone only.</p></div>
          {registration.paymentReference && registration.paymentStatus === 'pending' ? <button type="button" className="secondary-button" onClick={() => payment?.canCheck && void checkPayment(payment.id)} disabled={!payment?.canCheck || checking}>{checking ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={15} />}{checking ? 'Checking…' : 'Check payment'}</button> : <button type="button" className="primary-button" onClick={() => void paySavedRegistration()} disabled={busy || !paymentConfig?.ready}>{busy ? <LoaderCircle size={16} className="animate-spin" /> : <Smartphone size={16} />}{busy ? 'Sending…' : registration.paymentStatus === 'failed' ? 'Try payment again' : 'Send M-PESA prompt'}</button>}
        </div>}
      </section>
      <p className="kyc-privacy"><ShieldCheck size={16} />Identity documents are stored encrypted and are not included in your member dashboard response.</p>
    </> : <form ref={formRef} onSubmit={event => void submit(event)} className="kyc-form">
      <Section number="01" title="Personal information">
        <Field label="Full name *"><input className="kyc-input" name="fullName" autoComplete="name" defaultValue={`${memberService.getMember().firstName} ${memberService.getMember().lastName}`} maxLength={120} required /></Field>
        <Field label="National ID / Passport number *"><input className="kyc-input" name="idNumber" autoComplete="off" maxLength={40} required /></Field>
        <SelectField label="Gender *" name="gender" options={config.options.genders} placeholder="Select gender" />
        <SelectField label="Age group *" name="ageGroup" options={config.options.ageGroups} placeholder="Select age group" />
        <Field label="Mobile number *"><input className="kyc-input" name="mobileNumber" type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" maxLength={24} required /></Field>
      </Section>
      <Section number="02" title="Business location">
        <SelectField label="County *" name="county" options={config.counties} placeholder="Select county" />
        <Field label="Constituency *"><input className="kyc-input" name="constituency" autoComplete="address-level2" maxLength={120} required /></Field>
        <Field label="Ward *"><input className="kyc-input" name="ward" maxLength={120} required /></Field>
        <Field label="Business area / location *"><input className="kyc-input" name="businessArea" placeholder="Town, market or street" maxLength={120} required /></Field>
        <Field label="Business location type *"><select className="kyc-input" name="locationType" value={selectedLocationType} onChange={event => setSelectedLocationType(event.target.value)} required><option value="" disabled>Select location type</option>{config.options.locationTypes.map(option => <option key={option} value={option}>{option}</option>)}</select></Field>
        <Field label="Building / estate / market / area name"><input className="kyc-input" name="locationName" maxLength={120} /></Field>
        {selectedLocationType === 'Other' && <Field label="Specify location type *"><input className="kyc-input" name="otherLocationType" maxLength={100} required /></Field>}
      </Section>
      <Section number="03" title="Business information">
        <Field label="Business / enterprise name *"><input className="kyc-input" name="businessName" maxLength={120} required /></Field>
        <SelectField label="Business sector *" name="sector" options={config.options.sectors} placeholder="Select sector" />
        <SelectField label="Business registration status *" name="registrationStatus" options={config.options.registrationStatuses} placeholder="Select status" />
        <SelectField label="Number of employees *" name="employees" options={config.options.employeeGroups} placeholder="Select number" />
        <SelectField label="Estimated average monthly turnover *" name="turnover" options={config.options.turnoverGroups} placeholder="Select turnover" />
      </Section>
      <Section number="04" title="Identity verification">
        <UploadField label="National ID / passport – front *" name="idFront" />
        <UploadField label="National ID / passport – back *" name="idBack" />
      </Section>
      <Section number="05" title="Membership package">
        <Field label="Select membership package *"><select className="kyc-input" name="packageId" value={selectedPackageId} onChange={event => setSelectedPackageId(event.target.value)} required><option value="" disabled>Select package</option>{config.packages.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field>
        <Field label="Membership fee"><output className="kyc-fee">{config.packages.find(item => item.id === selectedPackageId) ? formatKsh(config.packages.find(item => item.id === selectedPackageId)!.amount) : 'Select a package to see its fee'}</output></Field>
        <Field label="Payment mobile number *"><input className="kyc-input" name="paymentMobileNumber" type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" maxLength={24} required /></Field>
        <p className="kyc-field-note">Your selected package and applicable fee will be displayed before payment.</p>
      </Section>
      <Section number="06" title="Payment">
        <div className="kyc-payment-method"><span className="icon-tile"><Smartphone size={20} /></span><div><strong>M-PESA STK Push</strong><p>{paymentConfig?.ready ? 'A payment prompt will be sent after you submit the registration.' : paymentConfig?.message || 'Payment service status is loading.'}</p></div></div>
        <p className="kyc-field-note">After submitting, approve the prompt on your phone. Payment is verified automatically; your membership ID is generated after successful confirmation.</p>
      </Section>
      <Section number="07" title="Declaration & consent">
        <label className="kyc-consent"><input type="checkbox" name="consent" required /><span>{declaration}</span></label>
      </Section>
      <div className="kyc-submit"><span><ShieldCheck size={16} />Your identity documents are encrypted at rest.</span><button className="primary-button" type="submit" disabled={busy}>{busy ? <><LoaderCircle size={17} className="animate-spin" />Submitting…</> : <><FileCheck2 size={17} />Submit registration</>}</button></div>
    </form>}
  </>;
}
