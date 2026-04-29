'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore, type Department } from '@/lib/store';
import { mapProfileToStoreUser } from '@/lib/auth/map-api-user';
import { getCurrentUserProfile, updateProfileApi } from '@/services/user.service';
import { Info, Camera, Loader2 } from 'lucide-react';
import { PROFILE_IMAGE_MAX_BYTES, PROFILE_IMAGE_MAX_MB } from '@/lib/file-upload-limits';
import { toast } from '@/lib/toast';
import { isAxiosError } from 'axios';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100';

function apiErrorMessage(e: unknown): string {
  if (
    isAxiosError(e) &&
    e.response?.data &&
    typeof e.response.data === 'object' &&
    e.response.data !== null &&
    'message' in e.response.data
  ) {
    return String((e.response.data as { message: unknown }).message);
  }
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}

export default function ProfilePage() {
  const currentUser = useStore((s) => s.currentUser);
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const upsertUser = useStore((s) => s.upsertUser);
  const departments = useStore((s) => s.departments);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingImageRef = useRef<File | null>(null);

  const [name, setName] = useState('');
  const [cnic, setCnic] = useState('');
  const [department, setDepartment] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(undefined);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    async function load() {
      setLoadingProfile(true);
      try {
        const p = await getCurrentUserProfile();
        if (cancelled) return;
        setName(p.name ?? '');
        setCnic(p.cnic ?? '');
        setDepartment(p.department ?? '');
        setEmail(p.email ?? '');
        setPhone(p.phone ?? '');
        setAddress(p.address ?? '');
        setAvatar(p.profile_image ?? undefined);
        pendingImageRef.current = null;
        setAvatarPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return undefined;
        });
      } catch (e) {
        if (!cancelled) toast(apiErrorMessage(e), 'error');
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
        No profile data. Please sign in.
      </div>
    );
  }

  const displayAvatar =
    avatarPreview ||
    avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=0ea5e9&color=fff&size=256`;

  const uniqueId = currentUser.employeeCode || currentUser.id;

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > PROFILE_IMAGE_MAX_BYTES) {
      toast(`Image too large (max ${PROFILE_IMAGE_MAX_MB} MB for profile photos).`, 'error');
      e.target.value = '';
      return;
    }
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    pendingImageRef.current = file;
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName || !trimmedEmail) {
      toast('Name and email are required.', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateProfileApi(
        {
          name: trimmedName,
          email: trimmedEmail,
          phone: phone.trim(),
          department: department || '',
          cnic: cnic.trim(),
          address: address.trim(),
        },
        pendingImageRef.current
      );
      pendingImageRef.current = null;
      setAvatarPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return undefined;
      });
      const p = await getCurrentUserProfile();
      setAvatar(p.profile_image ?? undefined);
      const user = mapProfileToStoreUser(p, currentUser.id, currentUser.role);
      setCurrentUser(user);
      upsertUser(user);
      toast('Profile saved.');
    } catch (err) {
      toast(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const departmentOptions: string[] =
    department && !departments.includes(department as Department)
      ? [department, ...departments]
      : [...departments];

  return (
    <div className="mx-auto max-w-4xl pb-12">
      <h1 className="mb-6 text-2xl font-light tracking-tight text-sky-600">Profile</h1>

      <div className="mb-8 flex items-start gap-3 rounded-xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm text-slate-700">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" aria-hidden />
        <p>
          Details load from your account on the server. Save changes to update via the API. Unique ID is
          system-assigned and cannot be changed here. Profile photos are limited to {PROFILE_IMAGE_MAX_MB} MB.
        </p>
      </div>

      {loadingProfile ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-sky-600" aria-label="Loading profile" />
        </div>
      ) : (
        <form onSubmit={(e) => void handleSave(e)} className="space-y-8">
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-white bg-slate-200 shadow-md ring-1 ring-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={displayAvatar} alt="" className="h-full w-full object-cover" />
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={saving}
                className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-sky-600 text-white shadow-md ring-2 ring-white transition hover:bg-sky-700 disabled:opacity-50"
                title="Upload photo"
                aria-label="Upload profile photo"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</label>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">CNIC</label>
              <input
                className={inputClass}
                value={cnic}
                onChange={(e) => setCnic(e.target.value)}
                placeholder="35202-0000000-0"
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Department</label>
              <select
                className={inputClass}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={saving}
              >
                <option value="">Select department</option>
                {departmentOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</label>
              <input
                type="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone Number</label>
              <input
                className={inputClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+92 …"
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unique ID</label>
              <input className={`${inputClass} cursor-not-allowed bg-slate-100/90`} readOnly value={uniqueId} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Addresses</label>
              <textarea
                rows={3}
                className={`${inputClass} resize-y`}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, city, country…"
                disabled={saving}
              />
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-6">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-8 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save changes
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
