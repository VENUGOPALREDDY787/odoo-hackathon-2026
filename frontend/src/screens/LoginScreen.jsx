import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../components/Card';
import PillButton from '../components/PillButton';
import LanguageSwitcher from '../components/LanguageSwitcher';

function PasswordField({ label, value, onChange, placeholder }) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="block font-label-caps text-label-caps text-text-secondary uppercase mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full aether-input pr-12"
          placeholder={placeholder}
          required
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          <span className="material-symbols-outlined text-[20px]">{visible ? 'visibility_off' : 'visibility'}</span>
        </button>
      </div>
    </div>
  );
}

export default function LoginScreen({ onLoginSuccess, onSignup, error, loading }) {
  const { t } = useTranslation();
  const [audience, setAudience] = useState(null);
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (tab === 'signup') {
      if (password !== confirmPassword) {
        onSignup?.({ error: 'Passwords do not match.' });
        return;
      }
      onSignup?.({ name, email, password });
      return;
    }
    onLoginSuccess?.({ email, password });
  };

  const chooseAudience = (nextAudience, nextTab = 'login') => {
    setAudience(nextAudience);
    setTab(nextTab);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 pt-20 pb-12 relative">
      {/* Language Switcher in Top Right */}
      <div className="absolute top-6 right-6 z-20">
        <LanguageSwitcher />
      </div>

      <Card className="max-w-md w-full p-8 md:p-10 relative overflow-hidden" radiance>
        {/* Header with Brand Mark */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex items-center gap-2 mb-3">
            <img src="/brand-mark.svg" alt="DealFlow360" className="h-9 w-auto" />
          </div>
          <p className="text-body-sm text-text-secondary">
            {t('auth.subtitle', 'Autonomous Pricing Governance & Enterprise Deal Desk')}
          </p>
        </div>

        {!audience ? (
          <div className="grid gap-4">
            <div className="rounded-2xl border border-border-subtle bg-surface-interactive/50 p-5">
              <h2 className="text-lg font-semibold text-text-primary">Customer</h2>
              <p className="text-sm text-text-secondary mt-1 mb-4">Access quotations, negotiations, orders, and invoices.</p>
              <div className="grid grid-cols-2 gap-2">
                <PillButton type="button" variant="primary" onClick={() => chooseAudience('customer')}>Sign In</PillButton>
                <PillButton type="button" variant="secondary" onClick={() => chooseAudience('customer', 'signup')}>Sign Up</PillButton>
              </div>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-surface-interactive/50 p-5">
              <h2 className="text-lg font-semibold text-text-primary">Worker</h2>
              <p className="text-sm text-text-secondary mt-1 mb-4">Sign in to your assigned sales operations workspace.</p>
              <PillButton type="button" variant="secondary" onClick={() => chooseAudience('worker')}>Sign In</PillButton>
            </div>
          </div>
        ) : (
          <>
            <button type="button" onClick={() => setAudience(null)} className="text-xs text-accent-blue hover:underline mb-5">← Choose account type</button>
            {tab === 'signup' && <div className="mb-5"><h2 className="text-xl font-semibold text-text-primary">Create Customer Account</h2><p className="text-sm text-text-secondary mt-1">Your account will be created with customer access.</p></div>}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'signup' && (
            <div>
              <label className="block font-label-caps text-label-caps text-text-secondary uppercase mb-1.5">
                {t('auth.fullName', 'Full Name')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full aether-input"
                placeholder="Your full name"
                required
              />
            </div>
          )}

          <div>
            <label className="block font-label-caps text-label-caps text-text-secondary uppercase mb-1.5">
              {t('auth.emailLabel', 'Work Email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full aether-input"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-label-caps text-label-caps text-text-secondary uppercase">
                {t('auth.passwordLabel', 'Password')}
              </label>
              {tab === 'login' && (
                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Password reset link sent to registered email.');
                  }}
                  className="font-mono-tag text-[11px] text-accent-blue hover:underline"
                >
                  {t('auth.forgotPassword', 'Forgot Password?')}
                </a>
              )}
            </div>
            <PasswordField label="" value={password} onChange={setPassword} placeholder="At least 8 characters" />
          </div>

          {tab === 'signup' && <PasswordField label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Repeat your password" />}

          {error && <p className="text-sm text-status-danger" role="alert">{error}</p>}

          <div className="pt-4">
            <PillButton type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Authenticating...' : tab === 'login' ? 'Sign In' : 'Create Customer Account'}
            </PillButton>
          </div>
        </form>

        {tab === 'login' && <p className="mt-4 text-center"><button type="button" onClick={() => alert('Password reset is not enabled on this deployment.')} className="font-mono-tag text-[11px] text-accent-blue hover:underline">Forgot Password?</button></p>}

        <div className="mt-6 pt-4 border-t border-border-subtle/50 text-center">
          <span className="font-mono-tag text-[11px] text-text-secondary">
            {t('auth.securityNote', 'Enforced with AETHER RBAC • Socket.IO Event Mesh')}
          </span>
        </div>
          </>
        )}
      </Card>
    </div>
  );
}
