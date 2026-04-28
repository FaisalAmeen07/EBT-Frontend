'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStore, useShallow, type LeaveType } from '@/lib/store';
import { toast } from '@/lib/toast';
import type { RequestStatusFilter } from './types';

export function useMyRequestsController() {
  const searchParams = useSearchParams();
  const { currentUser, Leave, applyLeave, manualTimeRequests, applyManualTimeRequest } = useStore(
    useShallow((s) => ({
      currentUser: s.currentUser,
      Leave: s.Leave,
      applyLeave: s.applyLeave,
      manualTimeRequests: s.manualTimeRequests,
      applyManualTimeRequest: s.applyManualTimeRequest,
    }))
  );

  const [activeTab, setActiveTab] = useState<'leave' | 'manual'>('leave');
  const [LeavetatusFilter, setLeavetatusFilter] = useState<RequestStatusFilter>('Pending');
  const [manualStatusFilter, setManualStatusFilter] = useState<RequestStatusFilter>('Pending');
  const [leaveFormOpen, setLeaveFormOpen] = useState(false);
  const [manualFormOpen, setManualFormOpen] = useState(false);

  const [leaveType, setLeaveType] = useState<LeaveType>('Leave');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const [manualDate, setManualDate] = useState('');
  const [clockInTime, setClockInTime] = useState('09:00');
  const [clockOutTime, setClockOutTime] = useState('18:00');
  const [breakInTime, setBreakInTime] = useState('');
  const [breakOutTime, setBreakOutTime] = useState('');
  const [manualReason, setManualReason] = useState('');

  const tabParam = searchParams.get('tab');
  useEffect(() => {
    if (tabParam === 'manual') {
      setActiveTab('manual');
    } else if (tabParam === 'leave') {
      setActiveTab('leave');
    }
  }, [tabParam]);

  const handleTabChange = (tab: 'leave' | 'manual') => {
    setActiveTab(tab);
    setLeaveFormOpen(false);
    setManualFormOpen(false);
  };

  const myLeave = useMemo(
    () =>
      Leave
        .filter((l) => l.userId === currentUser?.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [Leave, currentUser?.id]
  );

  const myManualTimeRequests = useMemo(
    () =>
      manualTimeRequests
        .filter((r) => r.userId === currentUser?.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [manualTimeRequests, currentUser?.id]
  );

  const filteredLeave = useMemo(
    () => myLeave.filter((l) => LeavetatusFilter === 'All' || l.status === LeavetatusFilter),
    [myLeave, LeavetatusFilter]
  );

  const filteredManual = useMemo(
    () => myManualTimeRequests.filter((r) => manualStatusFilter === 'All' || r.status === manualStatusFilter),
    [myManualTimeRequests, manualStatusFilter]
  );

  const submitLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!startDate || !endDate) {
      toast('Please fill in both start and end dates.', 'error');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast('End date cannot be before start date.', 'error');
      return;
    }
    applyLeave({ userId: currentUser.id, type: leaveType, startDate, endDate, reason });
    toast('Leave request submitted successfully.');
    setStartDate('');
    setEndDate('');
    setReason('');
    setLeaveFormOpen(false);
  };

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!manualDate) {
      toast('Please select a date.', 'error');
      return;
    }
    if (breakInTime && !breakOutTime) {
      toast('If you add Break In, you must also add Break Out.', 'error');
      return;
    }
    if (!breakInTime && breakOutTime) {
      toast('If you add Break Out, you must also add Break In.', 'error');
      return;
    }
    applyManualTimeRequest({
      date: manualDate,
      clockInTime,
      clockOutTime,
      breakInTime: breakInTime || undefined,
      breakOutTime: breakOutTime || undefined,
      reason: manualReason || undefined,
    });
    toast('Manual time request submitted successfully.');
    setManualDate('');
    setBreakInTime('');
    setBreakOutTime('');
    setManualReason('');
    setManualFormOpen(false);
  };

  const onStatusFilterChange = (v: string) => {
    const next = v as RequestStatusFilter;
    if (activeTab === 'leave') setLeavetatusFilter(next);
    else setManualStatusFilter(next);
  };

  return {
    activeTab,
    handleTabChange,
    LeavetatusFilter,
    manualStatusFilter,
    onStatusFilterChange,
    leaveFormOpen,
    setLeaveFormOpen,
    manualFormOpen,
    setManualFormOpen,
    myLeave,
    myManualTimeRequests,
    filteredLeave,
    filteredManual,
    leaveForm: {
      leaveType,
      setLeaveType,
      startDate,
      setStartDate,
      endDate,
      setEndDate,
      reason,
      setReason,
      onSubmit: submitLeave,
    },
    manualForm: {
      manualDate,
      setManualDate,
      clockInTime,
      setClockInTime,
      clockOutTime,
      setClockOutTime,
      breakInTime,
      setBreakInTime,
      breakOutTime,
      setBreakOutTime,
      manualReason,
      setManualReason,
      onSubmit: submitManual,
    },
  };
}
