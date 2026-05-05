/**
 * Role-based directory visibility (must match gdc-backend `teamModel` rules).
 */
export type UserVisibilityShape = {
  id: string;
  role: string;
  team?: string;
};

export function sameTeamName(userTeam: string | undefined, otherTeam: string | undefined): boolean {
  const a = userTeam?.trim() ?? '';
  const b = otherTeam?.trim() ?? '';
  return a !== '' && a === b;
}

export function isUserVisibleToViewer(viewer: UserVisibilityShape, candidate: UserVisibilityShape): boolean {
  if (!viewer?.id || !candidate?.id) return false;
  if (viewer.id === candidate.id) return true;

  switch (viewer.role) {
    case 'Admin':
    case 'HR':
      return true;
    case 'Team Leader':
      if (candidate.role === 'Admin' || candidate.role === 'HR') return true;
      if (candidate.role === 'Team Leader') return true;
      if (candidate.role === 'Employee') return sameTeamName(viewer.team, candidate.team);
      return false;
    case 'Employee':
      if (candidate.role === 'Admin' || candidate.role === 'HR') return true;
      if (candidate.role === 'Team Leader') return sameTeamName(viewer.team, candidate.team);
      return false;
    case 'Pending User':
      return candidate.role === 'Admin' || candidate.role === 'HR';
    default:
      return false;
  }
}

export function filterUsersForViewer<V extends UserVisibilityShape>(
  viewer: V | null | undefined,
  directory: UserVisibilityShape[],
): UserVisibilityShape[] {
  if (!viewer) return directory;
  if (viewer.role === 'Admin' || viewer.role === 'HR') return directory;
  return directory.filter((u) => isUserVisibleToViewer(viewer, u));
}
