'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, Loader2, Plus, Trash2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { addDepartmentApi, fetchAdminDepartmentsApi, removeDepartmentApi } from '@/services/admin.service';

export function DepartmentsControlPage() {
  const departments = useStore((s) => s.departments);
  const setDepartments = useStore((s) => s.setDepartments);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = input.trim();
  const exists = useMemo(
    () => departments.some((d) => d.toLowerCase() === normalized.toLowerCase()),
    [departments, normalized]
  );

  const loadDepartments = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetchAdminDepartmentsApi();
      setDepartments(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load departments.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDepartments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onAdd = async () => {
    if (!normalized || exists) return;
    setSaving(true);
    setError(null);
    try {
      const res = await addDepartmentApi(normalized);
      setDepartments(Array.isArray(res?.data) ? res.data : []);
      setInput('');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to add department.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async (name: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await removeDepartmentApi(name);
      setDepartments(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to remove department.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto min-h-full max-w-4xl space-y-6 px-4 pb-12 pt-6 sm:px-0">
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-100 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-200/50">
            <Building2 className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Admin</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Departments control</h1>
            <p className="mt-2 text-sm text-slate-600">
              Manage the departments shown in the Register form dropdown.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6">
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Add department</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Graphic Design"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none ring-blue-100 transition focus:border-blue-500 focus:ring-2"
          />
          <button
            type="button"
            onClick={onAdd}
            disabled={!normalized || exists || saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Add'}
          </button>
        </div>
        {exists ? <p className="mt-2 text-xs font-medium text-amber-700">Department already exists.</p> : null}
        {error ? <p className="mt-2 text-xs font-medium text-rose-700">{error}</p> : null}
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Current departments</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
            {departments.length} total
          </span>
        </div>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-7 w-7 animate-spin text-slate-500" aria-label="Loading departments" />
          </div>
        ) : (
        <div className="space-y-2">
          {departments.map((d) => (
            <div
              key={d}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3"
            >
              <span className="text-sm font-medium text-slate-800">{d}</span>
              <button
                type="button"
                onClick={() => void onRemove(d)}
                disabled={departments.length <= 1 || saving}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                title={departments.length <= 1 ? 'At least one department is required' : 'Remove department'}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
