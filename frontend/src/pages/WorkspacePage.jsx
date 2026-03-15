import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { workspaceApi, analyticsApi } from '../services/api'
import { FileText, MessageSquare, BarChart2, ArrowLeft, Folder, Loader } from 'lucide-react'
import DocumentUploader from '../components/documents/DocumentUploader'
import DocumentList from '../components/documents/DocumentList'
import ChatInterface from '../components/chat/ChatInterface'
import clsx from 'clsx'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'chat', label: 'AI Chat', icon: MessageSquare },
  { id: 'docs', label: 'Documents', icon: FileText },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
]

export default function WorkspacePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentWorkspace, setCurrentWorkspace, workspaces } = useAppStore()
  const [activeTab, setActiveTab] = useState('chat')
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadWorkspace()
  }, [id])

  useEffect(() => {
    if (activeTab === 'analytics' && !analytics) loadAnalytics()
  }, [activeTab])

  const loadWorkspace = async () => {
    setLoading(true)
    try {
      const { data } = await workspaceApi.get(id)
      setCurrentWorkspace(data)
    } catch {
      toast.error('Workspace not found')
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const loadAnalytics = async () => {
    try {
      const { data } = await analyticsApi.workspace(id)
      setAnalytics(data)
    } catch { }
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader size={32} className="text-blue-400 animate-spin" />
    </div>
  )

  const ws = currentWorkspace

  return (
    <div className="flex-1 flex flex-col min-h-0 animate-fade-in">
      {/* Workspace header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-white/5">
        <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg btn-ghost">
          <ArrowLeft size={16} />
        </button>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: ws?.color + '25', border: `1px solid ${ws?.color}40` }}>
          <Folder size={17} style={{ color: ws?.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-xl text-white truncate">{ws?.name}</h1>
          {ws?.description && <p className="text-xs text-blue-200/40 truncate">{ws.description}</p>}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.3)' }}>
          {TABS.map(({ id: tabId, label, icon: Icon }) => (
            <button key={tabId} onClick={() => setActiveTab(tabId)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeTab === tabId
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-blue-200/50 hover:text-blue-200'
              )}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' && (
          <div className="h-full">
            <ChatInterface workspaceId={id} />
          </div>
        )}

        {activeTab === 'docs' && (
          <div className="h-full overflow-auto p-6">
            <div className="max-w-3xl mx-auto space-y-6">
              <div>
                <h2 className="font-display text-xl text-white mb-1">Upload Documents</h2>
                <p className="text-sm text-blue-200/40 mb-4">
                  Documents are automatically chunked, embedded, and indexed for semantic search
                </p>
                <DocumentUploader workspaceId={id} onUploaded={() => {}} />
              </div>
              <div>
                <h2 className="font-display text-xl text-white mb-4">Indexed Documents</h2>
                <DocumentList workspaceId={id} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="h-full overflow-auto p-6">
            <AnalyticsView analytics={analytics} />
          </div>
        )}
      </div>
    </div>
  )
}

function AnalyticsView({ analytics: a }) {
  if (!a) return (
    <div className="flex items-center justify-center h-40">
      <Loader size={24} className="text-blue-400 animate-spin" />
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <h2 className="font-display text-2xl text-white">Workspace Analytics</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Docs', value: a.total_documents, color: '#3d6eff' },
          { label: 'Ready', value: a.ready_documents, color: '#10b981' },
          { label: 'Chats', value: a.total_chats, color: '#f59e0b' },
          { label: 'Chunks Indexed', value: a.total_chunks_indexed, color: '#8b5cf6' },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass rounded-xl p-5">
            <div className="text-xs text-blue-200/50 mb-2 font-medium uppercase tracking-wider">{label}</div>
            <div className="font-display text-3xl" style={{ color }}>{value ?? 0}</div>
          </div>
        ))}
      </div>

      {a.recent_documents?.length > 0 && (
        <div className="glass rounded-xl p-5">
          <h3 className="font-display text-lg text-white mb-4">Recent Documents</h3>
          <div className="space-y-2">
            {a.recent_documents.map(doc => (
              <div key={doc.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <span className="text-sm text-blue-100">{doc.name}</span>
                <span className={doc.status === 'ready' ? 'status-ready' : 'status-processing'}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {doc.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
