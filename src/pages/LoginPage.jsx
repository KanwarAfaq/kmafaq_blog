import { KeyRound, LockKeyhole, Mail, ShieldCheck, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SEO from '../components/SEO';
import { requestAuthOtp, verifyAuthOtp } from '../lib/api';
import { supabase } from '../lib/supabase';

const MODES = [
  ['password', 'Password'],
  ['otp', '4-digit OTP'],
  ['signup', 'Create account'],
];

function Field({ label, ...props }) {
  return (
    <label className="block text-sm font-semibold text-gray-700">
      {label}
      <input
        {...props}
        className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 font-normal outline-none transition focus:border-primary focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState('password');
  const [step, setStep] = useState('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [working, setWorking] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const redirect = useMemo(() => {
    const value = searchParams.get('redirect');
    return value?.startsWith('/') && !value.startsWith('//') ? value : '/';
  }, [searchParams]);

  function reset(nextMode) {
    setMode(nextMode);
    setStep('form');
    setPassword('');
    setConfirmPassword('');
    setCode('');
  }

  async function signInWithPassword(event) {
    event.preventDefault();
    if (!supabase) return toast.error('Supabase is not configured yet.');
    setWorking(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      toast.success('Signed in.');
      navigate(redirect, { replace: true });
    } catch (error) {
      toast.error(error.message || 'Could not sign in.');
    } finally {
      setWorking(false);
    }
  }

  async function requestCode(event) {
    event.preventDefault();
    if (!email.trim()) return;
    if ((mode === 'signup' || mode === 'reset') && password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if ((mode === 'signup' || mode === 'reset') && password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setWorking(true);
    try {
      await requestAuthOtp(email.trim(), mode === 'otp' ? 'login' : mode);
      setCode('');
      setStep('verify');
      toast.success('4-digit code sent by email.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setWorking(false);
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    if (!/^\d{4}$/.test(code)) return toast.error('Enter the 4-digit code.');
    setWorking(true);
    try {
      const purpose = mode === 'otp' ? 'login' : mode;
      const result = await verifyAuthOtp({
        email: email.trim(),
        purpose,
        code,
        password: purpose === 'signup' || purpose === 'reset' ? password : undefined,
        redirect,
      });

      if (result.mode === 'action-link' && result.action_link) {
        window.location.assign(result.action_link);
        return;
      }

      if (purpose === 'signup') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        toast.success('Account created.');
        navigate(redirect, { replace: true });
        return;
      }

      if (purpose === 'reset') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          toast.success('Password reset. Sign in with your new password.');
          reset('password');
          return;
        }
        toast.success('Password reset and signed in.');
        navigate(redirect, { replace: true });
      }
    } catch (error) {
      toast.error(error.message || 'Could not verify code.');
    } finally {
      setWorking(false);
    }
  }

  const title = mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Reset password' : 'Sign in';
  const Icon = mode === 'signup' ? UserPlus : mode === 'reset' ? LockKeyhole : mode === 'otp' ? ShieldCheck : Mail;

  return (
    <section className="mx-auto max-w-xl px-4 py-14 sm:px-6 sm:py-20">
      <SEO title={title} path="/login" noIndex />
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-primary">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-3xl font-black text-ink">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Use email/password or KM Afaq's secure 4-digit email code.
        </p>

        {mode !== 'reset' && (
          <div className="mt-6 grid grid-cols-3 gap-2 rounded-2xl bg-gray-100 p-1.5">
            {MODES.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => reset(value)}
                className={`rounded-xl px-2 py-2.5 text-xs font-black transition ${mode === value ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {mode === 'password' && (
          <form onSubmit={signInWithPassword} className="mt-7 space-y-4">
            <Field required type="email" autoComplete="email" label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            <Field required type="password" autoComplete="current-password" label="Password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
            <button disabled={working} className="w-full rounded-xl bg-primary px-5 py-3 font-black text-white transition hover:bg-blue-700 disabled:opacity-60">
              {working ? 'Signing in…' : 'Sign in with password'}
            </button>
            <button type="button" onClick={() => reset('reset')} className="w-full text-sm font-bold text-primary hover:underline">
              Forgot password? Reset with 4-digit OTP
            </button>
          </form>
        )}

        {(mode === 'otp' || mode === 'signup' || mode === 'reset') && step === 'form' && (
          <form onSubmit={requestCode} className="mt-7 space-y-4">
            <Field required type="email" autoComplete="email" label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            {(mode === 'signup' || mode === 'reset') && (
              <>
                <Field required minLength={8} type="password" autoComplete="new-password" label={mode === 'reset' ? 'New password' : 'Password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
                <Field required minLength={8} type="password" autoComplete="new-password" label="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password" />
              </>
            )}
            <button disabled={working} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-black text-white disabled:opacity-60">
              <KeyRound className="h-4 w-4" /> {working ? 'Sending…' : 'Send 4-digit code'}
            </button>
            {mode === 'reset' && (
              <button type="button" onClick={() => reset('password')} className="w-full text-sm font-bold text-gray-500 hover:text-primary">Back to sign in</button>
            )}
          </form>
        )}

        {(mode === 'otp' || mode === 'signup' || mode === 'reset') && step === 'verify' && (
          <form onSubmit={verifyCode} className="mt-7 space-y-5">
            <div className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-900">
              We sent a 4-digit code to <strong>{email}</strong>. It expires in 5 minutes.
            </div>
            <Field
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              pattern="[0-9]{4}"
              label="Verification code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="1234"
            />
            <button disabled={working} className="w-full rounded-xl bg-primary px-5 py-3 font-black text-white disabled:opacity-60">
              {working ? 'Verifying…' : mode === 'reset' ? 'Verify & reset password' : mode === 'signup' ? 'Verify & create account' : 'Verify & sign in'}
            </button>
            <div className="flex items-center justify-between gap-4 text-sm">
              <button type="button" onClick={() => setStep('form')} className="font-bold text-gray-500 hover:text-primary">Change details</button>
              <button type="button" onClick={requestCode} disabled={working} className="font-bold text-primary hover:underline disabled:opacity-50">Send a new code</button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
