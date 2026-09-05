import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../components/Card';
import PillButton from '../components/PillButton';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function LoginScreen({ onLoginSuccess }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('marcus.vance@dealflow360.io');
  const [password, setPassword] = useState('••••••••••••');
  const [role, setRole] = useState('rep');
  const [name, setName] = useState('Marcus Vance');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onLoginSuccess) {
      onLoginSuccess({ email, password, role, name, isSignup: tab === 'signup' });
    }
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

        {/* Tab Toggle: Log In / Sign Up */}
        <div className="flex items-center p-1 bg-surface-interactive rounded-full mb-6 border border-border-subtle">
          <button
            type="button"
            onClick={() => setTab('login')}
            className={`flex-1 py-2 text-xs font-semibold rounded-full transition-all duration-200 cursor-pointer ${
              tab === 'login'
                ? 'bg-text-primary text-surface-base shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t('navigation.login', 'Log In')}
          </button>
          <button
            type="button"
            onClick={() => setTab('signup')}
            className={`flex-1 py-2 text-xs font-semibold rounded-full transition-all duration-200 cursor-pointer ${
              tab === 'signup'
                ? 'bg-text-primary text-surface-base shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t('auth.signUp', 'Sign Up')}
          </button>
        </div>

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
                placeholder="Marcus Vance"
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
              placeholder="rep@dealflow360.io"
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
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full aether-input"
              placeholder="••••••••••••"
              required
            />
          </div>

          {/* Role selector for demo convenience */}
          <div className="pt-2">
            <label className="block font-label-caps text-label-caps text-text-secondary uppercase mb-2">
              {t('auth.demoRolesTitle', 'Sign In As Role (Demo Access)')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'rep', key: 'roles.rep', fallback: 'Sales Rep' },
                { id: 'manager', key: 'roles.manager', fallback: 'Sales Mgr' },
                { id: 'finance', key: 'roles.finance', fallback: 'Finance VP' },
                { id: 'admin', key: 'roles.admin', fallback: 'Admin' },
                { id: 'customer', key: 'roles.customer', fallback: 'Customer' },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={`px-2 py-1.5 text-xs font-mono rounded-lg border text-center transition-all ${
                    role === r.id
                      ? 'bg-accent-blue/15 border-accent-blue text-accent-blue font-bold'
                      : 'bg-surface-interactive border-border-subtle text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {t(r.key, r.fallback)}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4">
            <PillButton type="submit" variant="primary" size="lg" className="w-full">
              {tab === 'login' ? t('auth.signInBtn', 'Authenticate & Enter') : t('auth.createAccount', 'Create Enterprise Account')}
            </PillButton>
          </div>
        </form>

        <div className="mt-6 pt-4 border-t border-border-subtle/50 text-center">
          <span className="font-mono-tag text-[11px] text-text-secondary">
            {t('auth.securityNote', 'Enforced with AETHER RBAC • Socket.IO Event Mesh')}
          </span>
        </div>
      </Card>
    </div>
  );
}
