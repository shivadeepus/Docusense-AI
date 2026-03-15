import { useEffect, useState } from 'react'
import { documentApi } from '../../services/api'
import { useAppStore } from '../../store'
import { FileText, Trash2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const FILE_COLORS = { '.pdf': '#ef4444', '.docx': '#3b82f6', '.txt': '#10b981', '.md': '#f59e0b' }

export default function DocumentList({ workspaceId }) {
  const { documents, setDocuments, removeDocument, updateDocument } = useAppStore()
  const docs = documents[workspaceId] || []
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [polling, setPolling] = useState(false)

  useEffect(() => {
    loadDocuments()
  }, [workspaceId])

  // Poll for processing documents
  useEffect(() => {
    const processing = docs.some(d => d.status === 'processing')
    if (processing && !polling) {
      setPolling(true)
      const interval = setInterval(async () => {
        const { data } = await documentApi.list(workspaceId)
        setDocuments(workspaceId, data)
        if (!data.some(d => d.status === 'processing')) {
          clearInterval(interval)
          setPolling(false)
        }
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [docs])

  const loadDocuments = async () => {
    setLoading(true)
    try {
      const { data } = await documentApi.list(workspaceId)
      setDocuments(workspaceId, data)
    } catch {
      toast.error('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (doc) => {
    if (!confirm(`Delete "${doc.original_name}"? This will remove it from search.`)) return
    try {
      await documentApi.delete(doc.id)
      removeDocument(workspaceId, doc.id)
      toast.success('Document deleted')
    } catch {
      toast.error('Failed to delete document')
    }
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  if (loading) return (
    <div className="space-y-2">
      {[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
    </div>
  )

  if (docs.length === 0) return (
    <div className="flex flex-col items-center py-12 text-center">
      <FileText size={40} className="text-blue-300/20 mb-3" />
      <p className="text-sm text-blue-200/40">No documents yet</p>
      <p className="text-xs text-blue-200/25 mt-1">Upload documents above to start chatting</p>
    </div>
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-blue-300/50">{docs.length} document{docs.length !== 1 ? 's' : ''}</span>
        <button onClick={loadDocuments} className="p-1.5 rounded-lg btn-ghost">
          <RefreshCw size={13} className={polling ? 'animate-spin' : ''} />
        </button>
      </div>

      {docs.map(doc => {
        const ext = doc.file_type
        const color = FILE_COLORS[ext] || '#6690ff'
        const isExpanded = expanded === doc.id

        return (
          <div key={doc.id} className="glass rounded-xl overflow-hidden transition-all">
            <div className="flex items-center gap-3 p-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold font-mono"
                style={{ backgroundColor: color + '20', color }}>
                {ext.replace('.', '').toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm text-blue-100 truncate font-medium">{doc.original_name}</span>
                  <StatusBadge status={doc.status} />
                </div>
                <div className="flex items-center gap-3 text-xs text-blue-200/35">
                  <span>{formatSize(doc.file_size)}</span>
                  {doc.page_count > 0 && <span>{doc.page_count} pages</span>}
                  {doc.chunk_count > 0 && <span>{doc.chunk_count} chunks</span>}
                  <span>{formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {doc.summary && (
                  <button onClick={() => setExpanded(isExpanded ? null : doc.id)}
                    className="p-1.5 rounded-lg btn-ghost text-blue-300/40 hover:text-blue-300">
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                )}
                <button onClick={() => handleDelete(doc)}
                  className="p-1.5 rounded-lg text-red-400/40 hover:text-red-400 hover:bg-red-500/10 transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {isExpanded && doc.summary && (
              <div className="px-4 pb-4 border-t border-white/5 pt-3">
                <p className="text-xs text-blue-200/60 leading-relaxed">{doc.summary}</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    ready: { cls: 'status-ready', dot: 'bg-emerald-400', label: 'Ready' },
    processing: { cls: 'status-processing', dot: 'bg-amber-400 animate-pulse', label: 'Indexing' },
    error: { cls: 'status-error', dot: 'bg-red-400', label: 'Error' },
  }
  const s = map[status] || map.processing
  return (
    <span className={s.cls}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  )
}
