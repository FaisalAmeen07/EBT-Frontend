'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStore, useShallow, type LeaveType } from '@/lib/store';
import { toast } from '@/lib/toast';
import type { RequestStatusFilter } from './types';
import {
  createLeaveRequestApi,
  createManualRequestApi,
  fetchLeaveRequestsApi,
  fetchManualRequestsApi,
} from '@/services/attendance-requests.service';

export function useMyRequestsController() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const { currentUser, Leave, manualTimeRequests, setLeaveRequests, setManualTimeRequests } = useStore(
    useShallow((s) => ({
      currentUser: s.currentUser,
      Leave: s.Leave,
      manualTimeRequests: s.manualTimeRequests,
      setLeaveRequests: s.setLeaveRequests,
      setManualTimeRequests: s.setManualTimeRequests,
    }))
  );

  const [activeTab, setActiveTab] = useState<'leave' | 'manual'>(() =>
    tabParam === 'manual' ? 'manual' : 'leave'
  );
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

  useEffect(() => {
    if (!currentUser?.id) return;
    let cancelled = false;

    void (async () => {
      try {
        const [leaveRows, manualRows] = await Promise.all([fetchLeaveRequestsApi(), fetchManualRequestsApi()]);
        if (cancelled) return;
        setLeaveRequests(leaveRows);
        setManualTimeRequests(manualRows);
      } catch (error) {
        if (!cancelled) {
          toast(error instanceof Error ? error.message : 'Unable to load requests.', 'error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, setLeaveRequests, setManualTimeRequests]);

  const handleTabChange = (tab: 'leave' | 'manual') => {
    setActiveTab(tab);
    setLeaveFormOpen(false);
    setManualFormOpen(false);
  };

  const myLeave = useMemo(
    () =>
      Leave
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [Leave]
  );

  const myManualTimeRequests = useMemo(
    () =>
      manualTimeRequests
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [manualTimeRequests]
  );

  const filteredLeave = useMemo(
    () => myLeave.filter((l) => LeavetatusFilter === 'All' || l.status === LeavetatusFilter),
    [myLeave, LeavetatusFilter]
  );

  const filteredManual = useMemo(
    () => myManualTimeRequests.filter((r) => manualStatusFilter === 'All' || r.status === manualStatusFilter),
    [myManualTimeRequests, manualStatusFilter]
  );

  const submitLeave = async (e: React.FormEvent) => {
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
    try {
      await createLeaveRequestApi({ type: leaveType, startDate, endDate, reason });
      const leaveRows = await fetchLeaveRequestsApi();
      setLeaveRequests(leaveRows);
      toast('Leave request submitted successfully.');
      setStartDate('');
      setEndDate('');
      setReason('');
      setLeaveFormOpen(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Unable to submit leave request.', 'error');
    }
  };

  const submitManual = async (e: React.FormEvent) => {
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
    try {
      await createManualRequestApi({
        date: manualDate,
        clockInTime,
        clockOutTime,
        breakInTime: breakInTime || undefined,
        breakOutTime: breakOutTime || undefined,
        reason: manualReason || undefined,
      });
      const manualRows = await fetchManualRequestsApi();
      setManualTimeRequests(manualRows);
      toast('Manual time request submitted successfully.');
      setManualDate('');
      setBreakInTime('');
      setBreakOutTime('');
      setManualReason('');
      setManualFormOpen(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Unable to submit manual request.', 'error');
    }
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
