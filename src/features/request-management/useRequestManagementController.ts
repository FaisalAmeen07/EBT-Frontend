'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useStore, useShallow } from '@/lib/store';
import type { ReviewStatusFilter } from './constants';

export function useRequestManagementController() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    currentUser,
    Leave,
    users,
    updateLeavetatus,
    manualTimeRequests,
    approveManualTimeRequest,
    rejectManualTimeRequest,
  } = useStore(
    useShallow((s) => ({
      currentUser: s.currentUser,
      Leave: s.Leave,
      users: s.users,
      updateLeavetatus: s.updateLeavetatus,
      manualTimeRequests: s.manualTimeRequests,
      approveManualTimeRequest: s.approveManualTimeRequest,
      rejectManualTimeRequest: s.rejectManualTimeRequest,
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

  const getUsername = (userId: string) => users.find((u) => u.id === userId)?.name || 'Unknown User';

  const filteredLeave = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return Leave.filter((leave) => {
      const userName = (users.find((u) => u.id === leave.userId)?.name || 'Unknown User').toLowerCase();
      const matchesSearch = userName.includes(q);
      const matchesStatus = statusFilter === 'All' || leave.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [Leave, searchTerm, statusFilter, users]);

  const filteredManual = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return manualTimeRequests.filter((req) => {
      const userName = (users.find((u) => u.id === req.userId)?.name || 'Unknown User').toLowerCase();
      const matchesSearch = userName.includes(q);
      const matchesStatus = statusFilter === 'All' || req.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [manualTimeRequests, searchTerm, statusFilter, users]);

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
    updateLeavetatus,
    approveManualTimeRequest,
    rejectManualTimeRequest,
    activeRejectId,
    setActiveRejectId,
    rejectFeedback,
    setRejectFeedback,
  };
}
