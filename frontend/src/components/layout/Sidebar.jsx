import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppStore } from '../../store'
import {
  LayoutDashboard, MessageSquare, FileText, Settings,
  ChevronLeft, ChevronRight, LogOut, Plus, Folder, Zap
} from 'lucide-react'
import clsx from 'clsx'

export default function Sidebar({ onNewWorkspace }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, workspaces, currentWorkspace, setCurrentWorkspace, logout, sidebarOpen, toggleSidebar } = useAppStore()

  const handleWorkspaceClick = (ws) => {
    setCurrentWorkspace(ws)
    navigate(`/workspace/${ws.id}`)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  ]

  return (
    <div className={clsx(
      'flex flex-col h-full transition-all duration-300 glass border-r border-white/5',
      sidebarOpen ? 'w-64' : 'w-16'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        {sidebarOpen && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #3d6eff, #1a4fff)' }}>
              <FileText size={15} className="text-white" />
            </div>
            <span className="font-display text-white text-sm">DocuSense <span className="gradient-text">AI</span></span>
          </div>
        )}
        <button onClick={toggleSidebar} className="p-1.5 rounded-lg btn-ghost ml-auto">
          {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="p-3 space-y-1">
        {navItems.map(({ icon: Icon, label, path }) => (
          <button key={path}
            onClick={() => navigate(path)}
            className={clsx(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
              location.pathname === path
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/20'
                : 'text-blue-200/50 hover:text-blue-200 hover:bg-white/4'
            )}>
            <Icon size={17} className="shrink-0" />
            {sidebarOpen && <span className="font-medium">{label}</span>}
          </button>
        ))}
      </nav>

      {/* Workspaces */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {sidebarOpen && (
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs text-blue-300/40 font-medium uppercase tracking-wider">Workspaces</span>
            <button onClick={onNewWorkspace} className="p-1 rounded hover:bg-white/5 text-blue-300/40 hover:text-blue-300 transition-colors">
              <Plus size={14} />
            </button>
          </div>
        )}
        <div className="space-y-1">
          {workspaces.map(ws => (
            <button key={ws.id}
              onClick={() => handleWorkspaceClick(ws)}
              className={clsx(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left',
                currentWorkspace?.id === ws.id
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/20'
                  : 'text-blue-200/50 hover:text-blue-200 hover:bg-white/4'
              )}>
              <div className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center"
                style={{ backgroundColor: ws.color + '30', border: `1px solid ${ws.color}40` }}>
                <Folder size={12} style={{ color: ws.color }} />
              </div>
              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium text-xs">{ws.name}</div>
                  <div className="text-blue-300/30 text-xs">{ws.document_count} docs</div>
                </div>
              )}
            </button>
          ))}
        </div>

        {sidebarOpen && workspaces.length === 0 && (
          <button onClick={onNewWorkspace}
            className="w-full mt-2 px-3 py-4 rounded-lg border border-dashed border-blue-500/20 text-xs text-blue-300/40 hover:border-blue-500/40 hover:text-blue-300/60 transition-all">
            + Create first workspace
          </button>
        )}
      </div>

      {/* User footer */}
      <div className="p-3 border-t border-white/5">
        <div className={clsx('flex items-center gap-3 px-3 py-2.5 rounded-lg', sidebarOpen && 'mb-1')}>
          <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #3d6eff, #1a4fff)' }}>
            {user?.full_name?.[0] || 'U'}
          </div>
          {sidebarOpen && (
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-blue-100 truncate">{user?.full_name}</div>
              <div className="text-xs text-blue-300/40 capitalize">{user?.role}</div>
            </div>
          )}
        </div>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all">
          <LogOut size={15} className="shrink-0" />
          {sidebarOpen && 'Sign Out'}
        </button>
      </div>
    </div>
  )
}
