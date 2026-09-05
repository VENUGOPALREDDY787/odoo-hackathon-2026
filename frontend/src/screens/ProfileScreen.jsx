import React, { useState } from 'react';
import Card from '../components/Card';
import PillButton from '../components/PillButton';
import { changePassword, updateProfile } from '../auth/authApi';

function PasswordField({ label, value, onChange }) {
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

export default function ProfileScreen({ user, onUserUpdated, onLogout, showToast }) {
  const [name, setName] = useState(user?.fullName || user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await updateProfile({ full_name: name });
      onUserUpdated(updated);
      showToast('Profile updated.');
    } catch (error) {
      showToast(error.message);
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      showToast('Password changed successfully.');
    } catch (error) {
      showToast(error.message);
    } finally {
      setSaving(false);
    }
  };

  const displayName = user?.fullName || user?.full_name || user?.name || 'Account user';
  const role = user?.role || 'customer';

  return (
    <div data-tour="account" className="space-y-6">
      <div>
        <p className="font-mono-tag text-accent-blue text-xs uppercase tracking-[0.18em]">Account</p>
        <h1 className="font-display-hero text-4xl text-text-primary mt-2">Profile</h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card className="p-6" radiance>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-full bg-accent-blue/20 border border-accent-blue/40 flex items-center justify-center font-mono text-lg font-bold text-accent-blue">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">{displayName}</h2>
              <p className="text-sm text-text-secondary">{user?.email}</p>
            </div>
          </div>
          <dl className="space-y-4 border-t border-border-subtle pt-5">
            <div className="flex justify-between gap-4"><dt className="text-text-secondary">Role</dt><dd className="text-text-primary font-medium capitalize">{role}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-text-secondary">Account Status</dt><dd className="text-status-live">Active</dd></div>
          </dl>
          <form onSubmit={saveProfile} className="mt-6 space-y-4 border-t border-border-subtle pt-5">
            <div>
              <label className="block font-label-caps text-label-caps text-text-secondary uppercase mb-1.5">Name</label>
              <input value={name} onChange={(event) => setName(event.target.value)} className="w-full aether-input" required />
            </div>
            <PillButton type="submit" variant="primary" disabled={saving}>{saving ? 'Saving...' : 'Edit Profile'}</PillButton>
          </form>
        </Card>
        <Card className="p-6" radiance>
          <h2 className="text-xl font-semibold text-text-primary mb-5">Change Password</h2>
          <form onSubmit={savePassword} className="space-y-4">
            <PasswordField label="Current Password" value={currentPassword} onChange={setCurrentPassword} />
            <PasswordField label="New Password" value={newPassword} onChange={setNewPassword} />
            <PillButton type="submit" variant="secondary" disabled={saving}>{saving ? 'Saving...' : 'Change Password'}</PillButton>
          </form>
          <button type="button" onClick={onLogout} className="mt-8 text-sm text-status-danger hover:underline">Logout</button>
        </Card>
      </div>
    </div>
  );
}
