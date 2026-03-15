import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { documentApi } from '../../services/api'
import { useAppStore } from '../../store'
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const FILE_TYPES = {
  '.pdf': { label: 'PDF', color: '#ef4444' },
  '.docx': { label: 'DOCX', color: '#3b82f6' },
  '.txt': { label: 'TXT', color: '#10b981' },
  '.md': { label: 'MD', color: '#f59e0b' },
}

export default function DocumentUploader({ workspaceId, onUploaded }) {
  const addDocument = useAppStore(s => s.addDocument)
  const [uploads, setUploads] = useState([])  // { file, progress, status, doc }

  const onDrop = useCallback(async (acceptedFiles) => {
    const newUploads = acceptedFiles.map(file => ({ file, progress: 0, status: 'uploading', id: Math.random() }))
    setUploads(prev => [...prev, ...newUploads])

    for (const upload of newUploads) {
      try {
        const { data } = await documentApi.upload(workspaceId, upload.file, (progress) => {
          setUploads(prev => prev.map(u => u.id === upload.id ? { ...u, progress } : u))
        })
        addDocument(workspaceId, data)
        setUploads(prev => prev.map(u => u.id === upload.id ? { ...u, status: 'done', doc: data } : u))
        toast.success(`"${data.original_name}" uploaded — processing...`)
        onUploaded?.()
      } catch (err) {
        setUploads(prev => prev.map(u => u.id === upload.id ? { ...u, status: 'error' } : u))
        toast.error(`Failed to upload ${upload.file.name}`)
      }
    }
  }, [workspaceId])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
    },
    maxSize: 50 * 1024 * 1024
  })

  const clearDone = () => setUploads(prev => prev.filter(u => u.status === 'uploading'))

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div {...getRootProps()} className={clsx(
        'relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
        isDragActive
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-blue-500/20 hover:border-blue-500/40 hover:bg-white/2'
      )}>
        <input {...getInputProps()} />
        <div className={clsx(
          'flex flex-col items-center gap-3 transition-all',
          isDragActive ? 'scale-105' : ''
        )}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: isDragActive ? 'rgba(61,110,255,0.2)' : 'rgba(255,255,255,0.04)' }}>
            <Upload size={24} className={isDragActive ? 'text-blue-400' : 'text-blue-300/40'} />
          </div>
          <div>
            <p className="text-sm font-medium text-blue-100/80">
              {isDragActive ? 'Drop files here' : 'Drag files or click to upload'}
            </p>
            <p className="text-xs text-blue-200/40 mt-1">PDF, DOCX, TXT, MD — up to 50MB each</p>
          </div>
          <div className="flex gap-2">
            {Object.entries(FILE_TYPES).map(([ext, { label, color }]) => (
              <span key={ext} className="text-xs px-2 py-0.5 rounded font-mono"
                style={{ backgroundColor: color + '20', color, border: `1px solid ${color}40` }}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Upload list */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-blue-300/50">Uploads</span>
            <button onClick={clearDone} className="text-xs text-blue-300/40 hover:text-blue-300/70 transition-colors">
              Clear done
            </button>
          </div>
          {uploads.map(upload => (
            <UploadItem key={upload.id} upload={upload} onRemove={() =>
              setUploads(prev => prev.filter(u => u.id !== upload.id))
            } />
          ))}
        </div>
      )}
    </div>
  )
}

function UploadItem({ upload, onRemove }) {
  const ext = '.' + upload.file.name.split('.').pop()
  const type = FILE_TYPES[ext] || { label: 'FILE', color: '#6690ff' }

  return (
    <div className="glass rounded-lg px-4 py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-xs font-bold font-mono"
        style={{ backgroundColor: type.color + '20', color: type.color }}>
        {type.label}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-blue-100 truncate mb-1">{upload.file.name}</div>
        {upload.status === 'uploading' && (
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${upload.progress}%`, background: 'linear-gradient(90deg, #3d6eff, #6690ff)' }} />
          </div>
        )}
        {upload.status === 'done' && (
          <span className="text-xs text-emerald-400">Uploaded — indexing in background</span>
        )}
        {upload.status === 'error' && (
          <span className="text-xs text-red-400">Upload failed</span>
        )}
      </div>
      <div className="shrink-0">
        {upload.status === 'uploading' && <Loader size={14} className="text-blue-400 animate-spin" />}
        {upload.status === 'done' && <CheckCircle size={14} className="text-emerald-400" />}
        {upload.status === 'error' && <AlertCircle size={14} className="text-red-400" />}
      </div>
      {upload.status !== 'uploading' && (
        <button onClick={onRemove} className="text-blue-300/30 hover:text-blue-300/70 transition-colors ml-1">
          <X size={14} />
        </button>
      )}
    </div>
  )
}
