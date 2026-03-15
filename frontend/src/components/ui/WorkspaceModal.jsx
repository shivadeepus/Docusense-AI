import { useState } from 'react'
import { useAppStore } from '../../store'
import { workspaceApi } from '../../services/api'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'

const COLORS = ['#3d6eff','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16']

export default function WorkspaceModal({ onClose, onCreated }) {
  const addWorkspace = useAppStore(s => s.addWorkspace)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', color: COLORS[0] })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setLoading(true)
    try {
      const { data } = await workspaceApi.create(form)
      addWorkspace(data)
      toast.success(`Workspace "${data.name}" created!`)
      onCreated?.()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create workspace')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="glass rounded-2xl w-full max-w-md p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl text-white">New Workspace</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg btn-ghost">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-blue-300/60 mb-1.5 font-medium">Name *</label>
            <input className="input-field" placeholder="Legal Documents, Q4 Reports..."
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-xs text-blue-300/60 mb-1.5 font-medium">Description</label>
            <textarea className="input-field resize-none h-20" placeholder="What documents will this workspace contain?"
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-blue-300/60 mb-2 font-medium">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                  className="w-8 h-8 rounded-lg transition-all"
                  style={{
                    backgroundColor: c,
                    outline: form.color === c ? `2px solid ${c}` : 'none',
                    outlineOffset: '2px',
                    transform: form.color === c ? 'scale(1.15)' : 'scale(1)'
                  }} />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 border border-white/10">Cancel</button>
            <button type="submit" disabled={loading || !form.name.trim()} className="btn-primary flex-1">
              {loading ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
