import { create } from 'zustand'

export const useAppStore = create((set, get) => ({
  // ── Auth ──────────────────────────────────────────────────
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token') || null,

  setAuth: (user, token) => {
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('token', token)
    set({ user, token })
  },
  logout: () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    set({ user: null, token: null, currentWorkspace: null })
  },

  // ── Workspaces ────────────────────────────────────────────
  workspaces: [],
  currentWorkspace: null,

  setWorkspaces: (workspaces) => set({ workspaces }),
  setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
  addWorkspace: (ws) => set((s) => ({ workspaces: [ws, ...s.workspaces] })),
  removeWorkspace: (id) => set((s) => ({
    workspaces: s.workspaces.filter(w => w.id !== id),
    currentWorkspace: s.currentWorkspace?.id === id ? null : s.currentWorkspace
  })),

  // ── Documents ─────────────────────────────────────────────
  documents: {},  // { [workspaceId]: Document[] }

  setDocuments: (workspaceId, docs) => set((s) => ({
    documents: { ...s.documents, [workspaceId]: docs }
  })),
  addDocument: (workspaceId, doc) => set((s) => ({
    documents: {
      ...s.documents,
      [workspaceId]: [doc, ...(s.documents[workspaceId] || [])]
    }
  })),
  updateDocument: (workspaceId, docId, updates) => set((s) => ({
    documents: {
      ...s.documents,
      [workspaceId]: (s.documents[workspaceId] || []).map(d =>
        d.id === docId ? { ...d, ...updates } : d
      )
    }
  })),
  removeDocument: (workspaceId, docId) => set((s) => ({
    documents: {
      ...s.documents,
      [workspaceId]: (s.documents[workspaceId] || []).filter(d => d.id !== docId)
    }
  })),

  // ── Chat ──────────────────────────────────────────────────
  chatSessions: {},   // { [workspaceId]: Session[] }
  currentSession: null,
  messages: {},       // { [sessionId]: Message[] }
  isStreaming: false,

  setChatSessions: (workspaceId, sessions) => set((s) => ({
    chatSessions: { ...s.chatSessions, [workspaceId]: sessions }
  })),
  setCurrentSession: (session) => set({ currentSession: session }),
  addSession: (workspaceId, session) => set((s) => ({
    chatSessions: {
      ...s.chatSessions,
      [workspaceId]: [session, ...(s.chatSessions[workspaceId] || [])]
    }
  })),
  removeSession: (workspaceId, sessionId) => set((s) => ({
    chatSessions: {
      ...s.chatSessions,
      [workspaceId]: (s.chatSessions[workspaceId] || []).filter(s => s.id !== sessionId)
    },
    currentSession: s.currentSession?.id === sessionId ? null : s.currentSession
  })),
  updateSessionTitle: (workspaceId, sessionId, title) => set((s) => ({
    chatSessions: {
      ...s.chatSessions,
      [workspaceId]: (s.chatSessions[workspaceId] || []).map(s =>
        s.id === sessionId ? { ...s, title } : s
      )
    }
  })),

  setMessages: (sessionId, messages) => set((s) => ({
    messages: { ...s.messages, [sessionId]: messages }
  })),
  addMessage: (sessionId, message) => set((s) => ({
    messages: {
      ...s.messages,
      [sessionId]: [...(s.messages[sessionId] || []), message]
    }
  })),
  updateLastMessage: (sessionId, updates) => set((s) => {
    const msgs = s.messages[sessionId] || []
    if (!msgs.length) return s
    const updated = [...msgs]
    updated[updated.length - 1] = { ...updated[updated.length - 1], ...updates }
    return { messages: { ...s.messages, [sessionId]: updated } }
  }),
  setStreaming: (v) => set({ isStreaming: v }),

  // ── UI ────────────────────────────────────────────────────
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}))
