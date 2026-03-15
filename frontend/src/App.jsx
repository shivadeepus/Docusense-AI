import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAppStore } from './store'
import { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import WorkspacePage from './pages/WorkspacePage'
import Sidebar from './components/layout/Sidebar'
import WorkspaceModal from './components/ui/WorkspaceModal'
import { workspaceApi } from './services/api'

function ProtectedLayout() {
  const { user, setWorkspaces, workspaces } = useAppStore()
  const [showModal, setShowModal] = useState(false)
  const navigate = useNavigate()

  if (!user) return <Navigate to="/login" replace />

  const handleCreated = async () => {
    const { data } = await workspaceApi.list()
    setWorkspaces(data)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar onNewWorkspace={() => setShowModal(true)} />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/workspace/:id" element={<WorkspacePage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
      {showModal && (
        <WorkspaceModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}

export default function App() {
  const { user } = useAppStore()

  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{
        style: {
          background: '#0e1628',
          color: '#c2d4ff',
          border: '1px solid rgba(61,110,255,0.2)',
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '14px',
        },
        success: { iconTheme: { primary: '#10b981', secondary: '#0e1628' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#0e1628' } },
      }} />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage />} />
        <Route path="/*" element={<ProtectedLayout />} />
      </Routes>
    </BrowserRouter>
  )
}
