'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  AlertCircle,
  BookOpen,
  Building2,
  CheckCircle2,
  Shield,
  UserCog,
  Users,
  Plus,
  X,
  ChevronDown,
  Menu,
  Loader2,
  UserMinus,
  Trash2,
} from 'lucide-react';
import { isAxiosError } from 'axios';
import { useStore, useShallow, type User } from '@/lib/store';
import {
  addEmployeesApi,
  buildUsersWithResolvedTeams,
  createTeamApi,
  deleteTeamApi,
  detachMemberApi,
  findTeamRowByName,
  findTwoTeamRowsByName,
  moveMemberApi,
} from '@/services/team.service';
import { cn } from '@/lib/utils';
import { AttendanceLogPagination } from '@/components/attendance/attendanceLogUi';

const TEAM_ALL = 'All';

function sameTeamName(userTeam: string | undefined, filterTeam: string): boolean {
  return (userTeam?.trim() ?? '') === filterTeam.trim();
}

/** Team roster “Department” column: team `workSite` (from API `teams.department`), else profile `department`. */
function displayRosterDepartment(member: User, teamLeader?: User | null): string {
  const ws = member.workSite?.trim();
  if (ws) return ws;
  const prof = member.department != null ? String(member.department).trim() : '';
  if (prof) return prof;
  if (teamLeader) {
    const tw = teamLeader.workSite?.trim();
    if (tw) return tw;
    const tp = teamLeader.department != null ? String(teamLeader.department).trim() : '';
    if (tp) return tp;
  }
  return '—';
}

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
  return 'Request failed';
}

export default function TeamAssignTLPage() {
  const { users, teams, currentUser, replaceDirectoryUsers } = useStore(
    useShallow((s) => ({
      users: s.users,
      teams: s.teams,
      currentUser: s.currentUser,
      replaceDirectoryUsers: s.replaceDirectoryUsers,
    }))
  );

  const [teamNameFilter, setTeamNameFilter] = useState(TEAM_ALL);
  const [selectedLeaderId, setSelectedLeaderId] = useState('');
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [modalOpen, setModalOpen] = useState(false);
  const [leaderId, setLeaderId] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(() => new Set());
  const [modalTeamName, setModalTeamName] = useState('');
  /** Stored on users as `workSite` (used for dept filters); label is department. */
  const [departmentName, setDepartmentName] = useState('');

  const [addToTeamIds, setAddToTeamIds] = useState<Set<string>>(() => new Set());
  const [savingTeam, setSavingTeam] = useState(false);
  const [deletingTeam, setDeletingTeam] = useState(false);
  const [detachingId, setDetachingId] = useState<string | null>(null);
  const [addingEmployees, setAddingEmployees] = useState(false);
  const [shiftingMemberId, setShiftingMemberId] = useState<string | null>(null);
  const [assigningLeader, setAssigningLeader] = useState(false);

  const teamLeadersWithoutTeam = useMemo(
    () => users.filter((u) => u.role === 'Team Leader' && !(u.team?.trim())),
    [users]
  );

  /** Only formally created teams (`store.teams`), not stray strings on user records. */
  const teamNameOptions = useMemo(() => {
    const list = teams
      .map((t) => (typeof t === 'string' ? t.trim() : ''))
      .filter(Boolean);
    return [...new Set(list)].sort((a, b) => a.localeCompare(b));
  }, [teams]);

  /** Team leaders on this team + **unassigned** TLs (no `team`) so they can be placed via `move-member`. */
  const leaderChoices = useMemo(() => {
    if (teamNameFilter === TEAM_ALL) {
      return users.filter((u) => u.role === 'Team Leader' && u.team);
    }
    const t = teamNameFilter.trim();
    const onTeam = users.filter((u) => u.role === 'Team Leader' && sameTeamName(u.team, t));
    const unassigned = users.filter((u) => u.role === 'Team Leader' && !(u.team?.trim()));
    const seen = new Set<string>();
    const merged: User[] = [];
    for (const u of [...onTeam, ...unassigned]) {
      if (!seen.has(u.id)) {
        seen.add(u.id);
        merged.push(u);
      }
    }
    return merged;
  }, [users, teamNameFilter]);

  useEffect(() => {
    if (!selectedLeaderId) return;
    const ok = leaderChoices.some((u) => u.id === selectedLeaderId);
    if (!ok) setSelectedLeaderId('');
  }, [leaderChoices, selectedLeaderId]);

  useEffect(() => {
    if (teamNameFilter !== TEAM_ALL && !teams.includes(teamNameFilter)) {
      setTeamNameFilter(TEAM_ALL);
    }
  }, [teams, teamNameFilter]);

  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'Admin' && currentUser.role !== 'HR')) return;
    let cancelled = false;
    (async () => {
      try {
        const fresh = await buildUsersWithResolvedTeams();
        if (!cancelled) replaceDirectoryUsers(fresh);
      } catch {
        /* offline or401 — keep local roster */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, currentUser?.role, replaceDirectoryUsers]);

  const selectedLeader = useMemo(
    () => users.find((u) => u.id === selectedLeaderId),
    [users, selectedLeaderId]
  );

  /** Team context: TL’s team, or filtered team name when TL is still unassigned. */
  const selectedTeam = useMemo(() => {
    if (selectedLeaderId) {
      const p = users.find((u) => u.id === selectedLeaderId);
      const fromUser = (p?.team ?? '').trim();
      if (fromUser) return fromUser;
      if (teamNameFilter !== TEAM_ALL) return teamNameFilter.trim();
      return '';
    }
    if (teamNameFilter !== TEAM_ALL) return teamNameFilter.trim();
    return '';
  }, [selectedLeaderId, teamNameFilter, users]);

  /** Employees with no team — shown when creating the first roster or adding to existing teams. */
  const employeesWithoutTeam = useMemo(
    () => users.filter((u) => u.role === 'Employee' && !(u.team?.trim())),
    [users]
  );

  const tableRows = useMemo(() => {
    const team = selectedTeam;
    if (!team) return [];

    const rows: { id: string; name: string; email: string; team: string; site: string; role: string }[] = [];

    if (selectedLeaderId) {
      const leader = users.find((u) => u.id === selectedLeaderId);
      if (leader?.role === 'Team Leader') {
        rows.push({
          id: `tl-${leader.id}`,
          name: leader.name,
          email: leader.email,
          team,
          site: displayRosterDepartment(leader, leader),
          role: 'Team Leader',
        });
        for (const m of users.filter((u) => sameTeamName(u.team, team) && u.role === 'Employee')) {
          rows.push({
            id: m.id,
            name: m.name,
            email: m.email,
            team,
            site: displayRosterDepartment(m, leader),
            role: 'Employee',
          });
        }
        return rows;
      }
    }

    const onTeam = users.filter((u) => sameTeamName(u.team, team));
    onTeam.sort((a, b) => {
      if (a.role === 'Team Leader' && b.role !== 'Team Leader') return -1;
      if (b.role === 'Team Leader' && a.role !== 'Team Leader') return 1;
      return a.name.localeCompare(b.name);
    });
    const tl = onTeam.find((u) => u.role === 'Team Leader') ?? null;
    for (const m of onTeam) {
      rows.push({
        id: m.role === 'Team Leader' ? `tl-${m.id}` : m.id,
        name: m.name,
        email: m.email,
        team,
        site: displayRosterDepartment(m, tl),
        role: m.role,
      });
    }
    return rows;
  }, [users, selectedTeam, selectedLeaderId]);

  const teamDepartmentSummary = useMemo(() => {
    if (!selectedTeam) return '—';
    const onTeam = users.filter((u) => sameTeamName(u.team, selectedTeam));
    const tl = onTeam.find((u) => u.role === 'Team Leader') ?? null;
    for (const u of onTeam) {
      const d = displayRosterDepartment(u, tl);
      if (d !== '—') return d;
    }
    return '—';
  }, [users, selectedTeam]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / rowsPerPage) || 1);
  const pageSafe = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (pageSafe - 1) * rowsPerPage;
    return tableRows.slice(start, start + rowsPerPage);
  }, [tableRows, pageSafe, rowsPerPage]);

  useEffect(() => {
    setPage(1);
  }, [selectedLeaderId, teamNameFilter]);

  const otherTeams = useMemo(
    () => teams.filter((t) => t !== selectedTeam),
    [teams, selectedTeam]
  );

  const openAssignModal = () => {
    setMessage(null);
    setLeaderId('');
    setSelectedEmployees(new Set());
    setModalTeamName(selectedTeam || '');
    setDepartmentName(selectedLeader?.workSite?.trim() || '');
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const tn = modalTeamName.trim();
    const site = departmentName.trim();
    const uniqueEmployees = [...new Set([...selectedEmployees])];

    if (!tn) {
      setMessage({ type: 'err', text: 'Enter a team name.' });
      return;
    }
    if (!site) {
      setMessage({ type: 'err', text: 'Enter a department name.' });
      return;
    }
    if (!leaderId || uniqueEmployees.length < 1) {
      setMessage({ type: 'err', text: 'Choose a team leader and at least one employee.' });
      return;
    }
    if (uniqueEmployees.includes(leaderId)) {
      setMessage({ type: 'err', text: 'Team leader cannot be selected as an employee.' });
      return;
    }
    const leader = users.find((u) => u.id === leaderId);
    if (!leader || leader.role !== 'Team Leader') {
      setMessage({ type: 'err', text: 'Choose a user with the Team Leader role.' });
      return;
    }
    if (leader.team && leader.team !== tn) {
      setMessage({
        type: 'err',
        text: `${leader.name} is already a leader on another team. Remove them first or pick another leader.`,
      });
      return;
    }
    for (const id of uniqueEmployees) {
      const u = users.find((x) => x.id === id);
      if (!u || u.role !== 'Employee') {
        setMessage({ type: 'err', text: 'Employees only: pick users with the Employee role.' });
        return;
      }
      if (u.team) {
        setMessage({
          type: 'err',
          text: `${u.name} is already assigned to a team. Remove them from that team first.`,
        });
        return;
      }
    }

    setSavingTeam(true);
    try {
      await createTeamApi({
        name: tn,
        department: site,
        leader_id: Number(leaderId),
        employee_ids: uniqueEmployees.map(Number),
      });
      const fresh = await buildUsersWithResolvedTeams();
      replaceDirectoryUsers(fresh);
      setMessage({ type: 'ok', text: 'Team saved to the database.' });
      const newLeader = fresh.find((u) => u.id === leaderId);
      if (newLeader) setSelectedLeaderId(newLeader.id);
      if (newLeader?.team) setTeamNameFilter(newLeader.team);
      closeModal();
      setSelectedEmployees(new Set());
    } catch (err) {
      setMessage({ type: 'err', text: apiErrorMessage(err) });
    } finally {
      setSavingTeam(false);
    }
  };

  const toggleEmployee = (id: string) => {
    setSelectedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAddToTeam = (id: string) => {
    setAddToTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddEmployeesToTeam = async () => {
    if (!selectedTeam) return;
    setMessage(null);
    setAddingEmployees(true);
    try {
      const match = await findTeamRowByName(selectedTeam);
      if (!match) {
        setMessage({ type: 'err', text: 'Team not found on server. Refresh the page and try again.' });
        return;
      }
      await addEmployeesApi(
        Number(match.id),
        [...addToTeamIds].map((id) => Number(id))
      );
      const fresh = await buildUsersWithResolvedTeams();
      replaceDirectoryUsers(fresh);
      setAddToTeamIds(new Set());
      setMessage({ type: 'ok', text: 'Employee(s) added to this team.' });
    } catch (err) {
      setMessage({ type: 'err', text: apiErrorMessage(err) });
    } finally {
      setAddingEmployees(false);
    }
  };

  const detachMemberFromSelectedTeam = async (memberId: string) => {
    const tn = selectedTeam?.trim();
    if (!tn) {
      setMessage({ type: 'err', text: 'Select a team first.' });
      return;
    }
    setMessage(null);
    setDetachingId(memberId);
    try {
      const match = await findTeamRowByName(tn);
      if (!match) {
        setMessage({ type: 'err', text: 'Team not found on server. Refresh the page and try again.' });
        return;
      }
      await detachMemberApi(Number(match.id), Number(memberId));
      const fresh = await buildUsersWithResolvedTeams();
      replaceDirectoryUsers(fresh);
      setMessage({ type: 'ok', text: 'Employee removed from team.' });
    } catch (err) {
      setMessage({ type: 'err', text: apiErrorMessage(err) });
    } finally {
      setDetachingId(null);
    }
  };

  const handleDeleteFullTeam = async () => {
    if (!selectedTeam || !teams.includes(selectedTeam)) return;
    if (
      !confirm(
        `Delete team “${selectedTeam}” from the server? All members will be unassigned from this team.`
      )
    ) {
      return;
    }
    setMessage(null);
    setDeletingTeam(true);
    try {
      const match = await findTeamRowByName(selectedTeam);
      if (!match) {
        setMessage({ type: 'err', text: 'Team not found on server. Refresh the page and try again.' });
        return;
      }
      await deleteTeamApi(Number(match.id));
      const fresh = await buildUsersWithResolvedTeams();
      replaceDirectoryUsers(fresh);
      setTeamNameFilter(TEAM_ALL);
      setSelectedLeaderId('');
      setAddToTeamIds(new Set());
      setMessage({ type: 'ok', text: 'Team deleted.' });
    } catch (err) {
      setMessage({ type: 'err', text: apiErrorMessage(err) });
    } finally {
      setDeletingTeam(false);
    }
  };

  const handleLeaderSelect = async (id: string) => {
    setMessage(null);
    setAddToTeamIds(new Set());
    if (!id) {
      setSelectedLeaderId('');
      return;
    }
    const person = users.find((u) => u.id === id);
    const scopedTeam = teamNameFilter !== TEAM_ALL ? teamNameFilter.trim() : '';
    if (
      person?.role === 'Team Leader' &&
      scopedTeam &&
      !(person.team?.trim())
    ) {
      setAssigningLeader(true);
      try {
        const teamRow = await findTeamRowByName(scopedTeam);
        if (!teamRow) {
          setMessage({ type: 'err', text: 'Team not found on server. Create the team first (+).' });
          return;
        }
        await moveMemberApi(Number(person.id), Number(teamRow.id));
        const fresh = await buildUsersWithResolvedTeams();
        replaceDirectoryUsers(fresh);
        setSelectedLeaderId(person.id);
        setMessage({ type: 'ok', text: `${person.name} assigned to ${scopedTeam}.` });
      } catch (err) {
        setMessage({ type: 'err', text: apiErrorMessage(err) });
      } finally {
        setAssigningLeader(false);
      }
      return;
    }
    setSelectedLeaderId(id);
  };

  if (!currentUser || (currentUser.role !== 'Admin' && currentUser.role !== 'HR')) {
    return null;
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-100/90 via-slate-50 to-white dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-[1200px] px-4 pb-12 pt-6 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <Menu className="h-7 w-7 shrink-0 text-slate-600 dark:text-slate-300 lg:hidden" aria-hidden />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">Team Assignment</h1>
          </div>
        </div>
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 p-4 shadow-md shadow-slate-200/40 ring-1 ring-slate-200 dark:shadow-black/30 dark:ring-slate-700/60 backdrop-blur-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Team name
              <div className="relative">
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <select
                  value={teamNameFilter}
                  onChange={(e) => {
                    setTeamNameFilter(e.target.value);
                    setSelectedLeaderId('');
                    setMessage(null);
                    setAddToTeamIds(new Set());
                  }}
                  className="w-full appearance-none rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 py-2.5 pl-3 pr-9 text-sm text-slate-800 dark:text-slate-100 outline-none transition hover:border-slate-300 hover:bg-white dark:hover:border-slate-600 dark:hover:bg-slate-800 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                >
                  <option value={TEAM_ALL}>All teams</option>
                  {teamNameOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="flex flex-wrap items-center gap-2">
                Assign to Team Leader
                <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-200">
                  TL
                </span>
              </span>
              <div className="relative">
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <select
                  value={selectedLeaderId}
                  disabled={assigningLeader}
                  onChange={(e) => void handleLeaderSelect(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 py-2.5 pl-3 pr-9 text-sm text-slate-800 dark:text-slate-100 outline-none transition hover:border-slate-300 hover:bg-white dark:hover:border-slate-600 dark:hover:bg-slate-800 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 disabled:opacity-60"
                >
                  <option value="">
                    {teamNameFilter === TEAM_ALL
                      ? 'Select team leader…'
                      : leaderChoices.length === 0
                        ? 'No TL on this team or unassigned — set role in Admin, then refresh'
                        : 'Select team leader…'}
                  </option>
                  {leaderChoices.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} · {u.team?.trim() ? `${u.team} · ` : 'Unassigned · '}TL
                    </option>
                  ))}
                </select>
              </div>
            </label>
          </div>
          <button
            type="button"
            onClick={openAssignModal}
            title="Create new team"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md transition hover:bg-blue-700 dark:hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            aria-label="Create new team"
          >
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </button>
          </div>

        </div>

        {/* Summary when a team is in scope (filter and/or selected leader) */}
        {selectedTeam ? (
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-blue-500/25 dark:from-slate-800 dark:to-slate-800 dark:shadow-black/40">
                <UserCog className="h-4 w-4 opacity-90" aria-hidden />
                <span className="opacity-90">Team</span>
                <strong className="font-semibold tracking-tight">{selectedTeam}</strong>
              </span>
              {teams.includes(selectedTeam) ? (
                <button
                  type="button"
                  disabled={deletingTeam}
                  onClick={() => void handleDeleteFullTeam()}
                  title="Delete entire team (server)"
                  aria-label={`Delete team ${selectedTeam}`}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 shadow-sm transition hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/45 dark:text-rose-200 dark:hover:bg-rose-900/50 disabled:opacity-50"
                >
                  {deletingTeam ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="h-4 w-4" aria-hidden />
                  )}
                </button>
              ) : null}
            </div>
            <span
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm shadow-sm',
                teamDepartmentSummary === '—'
                  ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500'
                  : 'border-emerald-200/80 bg-emerald-50/90 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100'
              )}
            >
              <Building2
                className={cn(
                  'h-4 w-4 shrink-0 opacity-80',
                  teamDepartmentSummary !== '—' && 'text-emerald-600 dark:text-emerald-400'
                )}
                aria-hidden
              />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Department</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{teamDepartmentSummary}</span>
            </span>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700/90 bg-white dark:bg-slate-900 shadow-lg shadow-slate-200/50 ring-1 ring-slate-200 dark:shadow-black/40 dark:ring-slate-700/40">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 text-white dark:from-slate-800 dark:via-slate-800 dark:to-slate-900">
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wide">Sr#</th>
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wide">Email</th>
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wide">Team</th>
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wide">Department</th>
                  <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wide">Role</th>
                  <th className="px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!selectedTeam ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-slate-500 dark:text-slate-400">
                      <Users className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
                      Choose a <strong>Team name</strong> to view that roster, or <strong>All teams</strong> and pick a
                      team leader (Team Leader role is set in Admin).
                    </td>
                  </tr>
                ) : pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                      No members on this team yet. Create a roster with + or assign people in Admin.
                    </td>
                  </tr>
                ) : (
                  pagedRows.map((row, i) => {
                    const globalIndex = (pageSafe - 1) * rowsPerPage + i + 1;
                    const isTl = row.role === 'Team Leader';
                    const rowUserId = row.id.startsWith('tl-') ? row.id.slice(3) : row.id;
                    const memberId = rowUserId;
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          'border-b border-slate-100 dark:border-slate-800 transition-colors hover:bg-blue-50/50 dark:hover:bg-slate-800/90',
                          globalIndex % 2 === 0 ? 'bg-slate-50 dark:bg-slate-900/50' : 'bg-white dark:bg-slate-900'
                        )}
                      >
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{globalIndex}</td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-50">{row.name}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.email}</td>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{row.team}</td>
                        <td className="px-4 py-3">
                          {row.site !== '—' ? (
                            <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                              <Building2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                              <span className="font-medium">{row.site}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
                              isTl
                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-100'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/55 dark:text-emerald-100'
                            )}
                          >
                            {row.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isTl ? (
                            <div className="flex flex-wrap justify-end gap-1">
                              <select
                                className="max-w-[120px] rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-1 py-1 text-[11px] text-slate-800 dark:text-slate-100 outline-none transition hover:border-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800 disabled:opacity-50"
                                defaultValue=""
                                disabled={
                                  detachingId !== null ||
                                  shiftingMemberId !== null ||
                                  assigningLeader
                                }
                                onChange={(e) => {
                                  const targetName = e.target.value;
                                  const el = e.target;
                                  el.value = '';
                                  if (!targetName) return;
                                  void (async () => {
                                    setMessage(null);
                                    setShiftingMemberId(memberId);
                                    try {
                                      const { a: list, b: tgt } = await findTwoTeamRowsByName(
                                        selectedTeam,
                                        targetName
                                      );
                                      if (!list || !tgt) {
                                        setMessage({
                                          type: 'err',
                                          text: 'Team not found on server. Refresh and try again.',
                                        });
                                        return;
                                      }
                                      await moveMemberApi(Number(memberId), Number(tgt.id));
                                      const fresh = await buildUsersWithResolvedTeams();
                                      replaceDirectoryUsers(fresh);
                                      setMessage({ type: 'ok', text: 'Team leader moved.' });
                                    } catch (err) {
                                      setMessage({ type: 'err', text: apiErrorMessage(err) });
                                    } finally {
                                      setShiftingMemberId(null);
                                    }
                                  })();
                                }}
                              >
                                <option value="">Shift…</option>
                                {otherTeams.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div className="flex flex-wrap justify-end gap-1">
                              <select
                                className="max-w-[120px] rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-1 py-1 text-[11px] text-slate-800 dark:text-slate-100 outline-none transition hover:border-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800 disabled:opacity-50"
                                defaultValue=""
                                disabled={
                                  detachingId !== null ||
                                  shiftingMemberId !== null ||
                                  assigningLeader
                                }
                                onChange={(e) => {
                                  const targetName = e.target.value;
                                  const el = e.target;
                                  el.value = '';
                                  if (!targetName) return;
                                  void (async () => {
                                    setMessage(null);
                                    setShiftingMemberId(memberId);
                                    try {
                                      const { a: list, b: tgt } = await findTwoTeamRowsByName(
                                        selectedTeam,
                                        targetName
                                      );
                                      if (!list || !tgt) {
                                        setMessage({
                                          type: 'err',
                                          text: 'Team not found on server. Refresh and try again.',
                                        });
                                        return;
                                      }
                                      await moveMemberApi(Number(memberId), Number(tgt.id));
                                      const fresh = await buildUsersWithResolvedTeams();
                                      replaceDirectoryUsers(fresh);
                                      setMessage({ type: 'ok', text: 'Moved.' });
                                    } catch (err) {
                                      setMessage({ type: 'err', text: apiErrorMessage(err) });
                                    } finally {
                                      setShiftingMemberId(null);
                                    }
                                  })();
                                }}
                              >
                                <option value="">Shift…</option>
                                {otherTeams.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={
                                  detachingId !== null ||
                                  shiftingMemberId !== null ||
                                  assigningLeader
                                }
                                onClick={() => {
                                  if (!confirm(`Remove ${row.name}?`)) return;
                                  void detachMemberFromSelectedTeam(memberId);
                                }}
                                title="Remove from team"
                                aria-label={`Remove ${row.name} from team`}
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800/80 disabled:opacity-50"
                              >
                                {detachingId === memberId ? (
                                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                ) : (
                                  <UserMinus className="h-4 w-4" aria-hidden />
                                )}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {tableRows.length > 0 ? (
            <AttendanceLogPagination
              pageSafe={pageSafe}
              totalPages={totalPages}
              filteredLen={tableRows.length}
              rowsPerPage={rowsPerPage}
              setRowsPerPage={setRowsPerPage}
              setPage={setPage}
            />
          ) : null}
        </div>

        {/* Quick add — under table (team must exist in registry; need a TL in scope) */}
        {selectedTeam &&
        teams.includes(selectedTeam) &&
        selectedLeader?.role === 'Team Leader' ? (
          <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">Add employees to “{selectedTeam}”</h3>
            <div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-2">
              {employeesWithoutTeam.length === 0 ? (
                <span className="text-xs text-slate-500 dark:text-slate-400">No unassigned employees.</span>
              ) : (
                employeesWithoutTeam.map((u) => (
                  <label
                    key={u.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={addToTeamIds.has(u.id)}
                      onChange={() => toggleAddToTeam(u.id)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    {u.name}
                  </label>
                ))
              )}
            </div>
            <button
              type="button"
              disabled={addToTeamIds.size < 1 || addingEmployees}
              onClick={() => void handleAddEmployeesToTeam()}
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 dark:hover:bg-emerald-500 disabled:opacity-50"
            >
              {addingEmployees ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {addingEmployees ? 'Adding…' : 'Add selected'}
            </button>
          </div>
        ) : selectedTeam && selectedLeader && !teams.includes(selectedTeam) ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950 dark:border-amber-800/80 dark:bg-amber-950/35 dark:text-amber-100">
            <p className="font-semibold">Team not registered yet</p>
            <p className="mt-1 text-amber-900/90 dark:text-amber-200/90">
              Use <strong>Create team roster</strong> (+) above to create “{selectedTeam}” first. You can assign a leader
              and add members only after the team exists in the system.
            </p>
          </div>
        ) : null}

        {message && (
          <div
            role="status"
            className={cn(
              'mt-6 rounded-xl border px-4 py-3 text-sm',
              message.type === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
                : 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100'
            )}
          >
            <div className="flex gap-3">
              {message.type === 'ok' ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
              )}
              <span>{message.text}</span>
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-[2px] sm:items-center"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700/90 bg-white dark:bg-slate-900 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-roster-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-indigo-400">New team</p>
                <h2 id="modal-roster-title" className="text-lg font-bold text-slate-900 dark:text-slate-50">
                  Create team roster
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="space-y-5 px-6 py-6">
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Team name</span>
                <input
                  required
                  list="modal-team-options"
                  value={modalTeamName}
                  onChange={(e) => setModalTeamName(e.target.value)}
                  placeholder="e.g. Product Squad"
                  className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 outline-none transition hover:border-slate-300 dark:hover:border-slate-600 placeholder:text-slate-400"
                />
                <datalist id="modal-team-options">
                  {teamNameOptions.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>

              <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-800/80 dark:bg-indigo-950/35">
                <label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Choose leader
                  <select
                    required
                    value={leaderId}
                    onChange={(e) => setLeaderId(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 outline-none transition hover:border-slate-300 dark:hover:border-slate-600"
                  >
                    <option value="">Select…</option>
                    {teamLeadersWithoutTeam.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} · {u.email}
                      </option>
                    ))}
                  </select>
                </label>
                {leaderId ? (
                  <p className="mt-2 text-xs font-medium text-indigo-900 dark:text-indigo-100">
                    <Shield className="mr-1 inline h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden />
                    {users.find((u) => u.id === leaderId)?.name} will be set as <strong>Team Leader</strong> when you
                    create this roster.
                  </p>
                ) : null}
                {teamLeadersWithoutTeam.length === 0 && (
                  <p className="mt-2 text-xs text-amber-900 dark:text-amber-200/90">
                    No team leaders without a team yet—open <strong>Admin</strong> and use Promote / role → Team Leader.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 p-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Employees (min. 1)</span>
                <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                  {employeesWithoutTeam.length === 0 ? (
                    <p className="p-3 text-center text-xs text-slate-500 dark:text-slate-400">
                      No employees without a team. Approve pending users as Employee in Admin, or remove someone from a
                      team first.
                    </p>
                  ) : (
                    employeesWithoutTeam.map((u) => (
                      <label
                        key={u.id}
                        className="flex cursor-pointer items-center gap-3 border-b border-slate-100 dark:border-slate-800 px-3 py-2 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEmployees.has(u.id)}
                          onChange={() => toggleEmployee(u.id)}
                          className="rounded border-slate-300 text-blue-600"
                        />
                        <span className="text-sm text-slate-800 dark:text-slate-100">{u.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 p-4">
                <label htmlFor="modal-dept-name" className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Department
                </label>
                <input
                  id="modal-dept-name"
                  type="text"
                  required
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  placeholder="e.g. MERN Stack, Frontend, SEO"
                  autoComplete="off"
                  className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none transition hover:border-slate-300 dark:hover:border-slate-600"
                />
              </div>

              <button
                type="submit"
                disabled={
                  savingTeam ||
                  teamLeadersWithoutTeam.length === 0 ||
                  !leaderId ||
                  !modalTeamName.trim() ||
                  !departmentName.trim() ||
                  selectedEmployees.size < 1
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 dark:hover:bg-blue-500 disabled:opacity-50"
              >
                {savingTeam ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {savingTeam ? 'Saving…' : 'Create team'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
