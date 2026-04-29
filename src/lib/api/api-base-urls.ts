/**
 * Paths relative to `NEXT_PUBLIC_API_URL` (Express API).
 */
export const API_PATHS = {
  auth: {
    register: '/api/auth/register',
    login: '/api/auth/login',
    verifyEmail: '/api/auth/verify-email',
    forgotPassword: '/api/auth/forgot-password',
    verifyResetEmail: '/api/auth/verify-reset-email',
    verifyOtp: '/api/auth/verify-otp',
    resetPassword: '/api/auth/reset-password',
    resendOtp: '/api/auth/resend-otp',
    logout: '/api/auth/logout',
    departments: '/api/auth/departments',
    deleteUser: (hashId: string) => `/api/auth/delete-user/${encodeURIComponent(hashId)}`,
  },
  profile: {
    get: '/api/profile/getProfile',
    update: '/api/profile/updateProfile',
  },
  admin: {
    pendingUsers: '/api/admin/pending-users',
    approveUser: '/api/admin/approve-user',
    rejectUser: '/api/admin/reject-user',
    allUsers: '/api/admin/Allusers',
    updateRole: (id: string | number) => `/api/admin/update-role/${id}`,
    departments: '/api/admin/departments',
    deleteDepartment: (name: string) => `/api/admin/departments/${encodeURIComponent(name)}`,
  },
  teams: {
    create: '/api/teams/createTeam',
    list: '/api/teams/getTeams',
    myTeamRoster: '/api/teams/my-team-roster',
    delete: (id: string | number) => `/api/teams/deleteTeam/${id}`,
    detachMember: '/api/teams/detach-member',
    addEmployees: '/api/teams/add-employees',
    moveMember: '/api/teams/move-member',
  },
  /**
   * Task microservice paths (relative to `NEXT_PUBLIC_TASK_API_URL`).
   * Use with `taskApiClient` / `task-request-handler`.
   */
  task: {
    dailyUpdates: {
      employeeList: '/api/daily-updates/employee',
      employeeUpsert: '/api/daily-updates/employee',
      teamLeaderBundle: '/api/daily-updates/team-leader',
      teamLeaderUpsertSummary: '/api/daily-updates/team-leader/summary',
      leadershipOverview: '/api/daily-updates/leadership',
      hrUpsertSummary: '/api/daily-updates/hr/summary',
    },
  },
  /**
   * Chat microservice paths (relative to `NEXT_PUBLIC_CHAT_API_URL`).
   * Used by in-app messages (/messages).
   */
  chat: {
    threads: '/api/chats',
    openDm: '/api/chats/dm',
    createGroup: '/api/chats/group',
    updateGroup: (chatId: string) => `/api/chats/${encodeURIComponent(chatId)}`,
    deleteGroup: (chatId: string) => `/api/chats/${encodeURIComponent(chatId)}`,
    addMembers: (chatId: string) => `/api/chats/${encodeURIComponent(chatId)}/members:add`,
    removeMembers: (chatId: string) => `/api/chats/${encodeURIComponent(chatId)}/members:remove`,
    leaveGroup: (chatId: string) => `/api/chats/${encodeURIComponent(chatId)}/leave`,
    messages: (chatId: string) => `/api/chats/${encodeURIComponent(chatId)}/messages`,
    searchMessages: (chatId: string) => `/api/chats/${encodeURIComponent(chatId)}/messages/search`,
    message: (chatId: string, messageId: string) =>
      `/api/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`,
    markRead: (chatId: string) => `/api/chats/${encodeURIComponent(chatId)}/read`,
  },
} as const;
