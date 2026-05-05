'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useStore, useShallow } from '@/lib/store';
import type { ReviewStatusFilter } from './constants';
import { toast } from '@/lib/toast';
import {
  approveLeaveRequestApi,
  approveManualRequestApi,
  fetchLeaveRequestsApi,
  fetchManualRequestsApi,
  rejectLeaveRequestApi,
  rejectManualRequestApi,
} from '@/services/attendance-requests.service';

export function useRequestManagementController() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    currentUser,
    Leave,
    users,
    manualTimeRequests,
    setLeaveRequests,
    setManualTimeRequests,
  } = useStore(
    useShallow((s) => ({
      currentUser: s.currentUser,
      Leave: s.Leave,
      users: s.users,
      manualTimeRequests: s.manualTimeRequests,
      setLeaveRequests: s.setLeaveRequests,
      setManualTimeRequests: s.setManualTimeRequests,
    }))
  );

  const activeTab = useMemo((): 'leave' | 'manual' => {
    const t = searchParams.get('tab');
    return t === 'manual' ? 'manual' : 'leave';
  }, [searchParams]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>('Pending');
  const [activeRejectId, setActiveRejectId] = useState<string | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState('');

  const loadRequests = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      try {
        const [leaveRows, manualRows] = await Promise.all([fetchLeaveRequestsApi(), fetchManualRequestsApi()]);
        setLeaveRequests(leaveRows);
        setManualTimeRequests(manualRows);
      } catch (error) {
        if (!silent) {
          toast(error instanceof Error ? error.message : 'Unable to load requests.', 'error');
        }
      }
    },
    [setLeaveRequests, setManualTimeRequests]
  );

  useEffect(() => {
    if (!currentUser?.id) return;
    void loadRequests({ silent: false });
  }, [currentUser?.id, loadRequests]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const id = setInterval(() => void loadRequests({ silent: true }), 35_000);
    return () => clearInterval(id);
  }, [currentUser?.id, loadRequests]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadRequests({ silent: true });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [currentUser?.id, loadRequests]);

  const getUsername = (userId: string) =>
    users.find((u) => u.id === userId)?.name ||
    Leave.find((l) => l.userId === userId)?.requesterName ||
    manualTimeRequests.find((m) => m.userId === userId)?.requesterName ||
    `User ${String(userId).slice(0, 8)}`;

  const filteredLeave = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return Leave.filter((leave) => {
      const userName = getUsername(leave.userId).toLowerCase();
      const matchesSearch = userName.includes(q);
      const matchesStatus = statusFilter === 'All' || leave.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [Leave, searchTerm, statusFilter, users, manualTimeRequests]);

  const filteredManual = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return manualTimeRequests.filter((req) => {
      const userName = getUsername(req.userId).toLowerCase();
      const matchesSearch = userName.includes(q);
      const matchesStatus = statusFilter === 'All' || req.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [manualTimeRequests, searchTerm, statusFilter, users, Leave]);

  const sortedLeave = useMemo(
    () =>
      [...filteredLeave].sort((a, b) => {
        if (a.status === 'Pending' && b.status !== 'Pending') return -1;
        if (a.status !== 'Pending' && b.status === 'Pending') return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    [filteredLeave]
  );

  const sortedManual = useMemo(
    () =>
      [...filteredManual].sort((a, b) => {
        if (a.status === 'Pending' && b.status !== 'Pending') return -1;
        if (a.status !== 'Pending' && b.status === 'Pending') return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    [filteredManual]
  );

  const canReviewLeave = currentUser?.role === 'Admin' || currentUser?.role === 'HR';
  const canReviewManual = currentUser?.role === 'Admin' || currentUser?.role === 'HR';

  const onTabChange = (tab: 'leave' | 'manual') => {
    const q = new URLSearchParams(searchParams.toString());
    q.set('tab', tab);
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    setStatusFilter('Pending');
    setActiveRejectId(null);
    setRejectFeedback('');
  };

  const approveLeave = async (id: string) => {
    await approveLeaveRequestApi(id);
    await loadRequests({ silent: true });
  };

  const rejectLeave = async (id: string, reason: string) => {
    await rejectLeaveRequestApi(id, reason);
    await loadRequests({ silent: true });
  };

  const approveManual = async (id: string) => {
    await approveManualRequestApi(id);
    await loadRequests({ silent: true });
  };

  const rejectManual = async (id: string, reason: string) => {
    await rejectManualRequestApi(id, reason);
    await loadRequests({ silent: true });
  };

  return {
    activeTab,
    onTabChange,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    sortedLeave,
    sortedManual,
    getUsername,
    canReviewLeave,
    canReviewManual,
    approveLeave,
    rejectLeave,
    approveManual,
    rejectManual,
    activeRejectId,
    setActiveRejectId,
    rejectFeedback,
    setRejectFeedback,
  };
}
