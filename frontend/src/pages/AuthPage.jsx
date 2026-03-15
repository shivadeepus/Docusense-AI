import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../services/api'
import { useAppStore } from '../store'
import toast from 'react-hot-toast'
import { FileText, Layers, Shield, Zap } from 'lucide-react'

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    email: '', password: '', full_name: '', role: 'analyst', department: ''
  })
  const setAuth = useAppStore(s => s.setAuth)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        const { data } = await authApi.login({ email: form.email, password: form.password })
        setAuth(data.user, data.access_token)
        toast.success(`Welcome back, ${data.user.full_name}!`)
        navigate('/dashboard')
      } else {
        await authApi.register(form)
        toast.success('Account created! Please sign in.')
        setMode('login')
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="min-h-screen flex" style={{ background: '#0a0f1e' }}>
      {/* Left panel - branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-16 relative overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `linear-gradient(rgba(61,110,255,0.5) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(61,110,255,0.5) 1px, transparent 1px)`,
            backgroundSize: '48px 48px'
          }} />
        {/* Glow */}
        <div className="absolute top-1/3 left-1/3 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #3d6eff, transparent 70%)' }} />

        <div className="relative">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #3d6eff, #1a4fff)' }}>
              <FileText size={20} className="text-white" />
            </div>
            <span className="font-display text-xl text-white">DocuSense <span className="gradient-text">AI</span></span>
          </div>

          <h1 className="font-display text-5xl text-white leading-tight mb-6">
            Enterprise<br />Document<br /><span className="gradient-text">Intelligence</span>
          </h1>
          <p className="text-blue-200/60 text-lg leading-relaxed max-w-sm">
            Chat with your documents. Extract insights. Collaborate across teams — all powered by open-source AI running on your infrastructure.
          </p>
        </div>

        <div className="relative space-y-4">
          {[
            { icon: Layers, text: 'RAG-powered semantic search across all documents' },
            { icon: Shield, text: '100% private — runs entirely on your own servers' },
            { icon: Zap, text: 'Lightweight open-source LLMs, no API costs' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-blue-200/70">
              <div className="w-8 h-8 rounded-lg glass flex items-center justify-center shrink-0">
                <Icon size={15} className="text-blue-400" />
              </div>
              <span className="text-sm">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="glass rounded-2xl p-8">
            <div className="flex mb-8 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.3)' }}>
              {['login', 'register'].map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all"
                  style={mode === m
                    ? { background: 'linear-gradient(135deg, #3d6eff, #1a4fff)', color: 'white' }
                    : { color: '#6690ff' }}>
                  {m === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs text-blue-300/60 mb-1.5 font-medium">Full Name</label>
                  <input className="input-field" placeholder="Jane Smith"
                    value={form.full_name} onChange={e => set('full_name', e.target.value)} required />
                </div>
              )}
              <div>
                <label className="block text-xs text-blue-300/60 mb-1.5 font-medium">Work Email</label>
                <input className="input-field" type="email" placeholder="jane@company.com"
                  value={form.email} onChange={e => set('email', e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs text-blue-300/60 mb-1.5 font-medium">Password</label>
                <input className="input-field" type="password" placeholder="••••••••"
                  value={form.password} onChange={e => set('password', e.target.value)} required />
              </div>
              {mode === 'register' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-blue-300/60 mb-1.5 font-medium">Role</label>
                    <select className="input-field" value={form.role} onChange={e => set('role', e.target.value)}>
                      <option value="analyst">Analyst</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-blue-300/60 mb-1.5 font-medium">Department</label>
                    <input className="input-field" placeholder="Legal, Finance..."
                      value={form.department} onChange={e => set('department', e.target.value)} />
                  </div>
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
                {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            {mode === 'login' && (
              <div className="mt-4 p-3 rounded-lg text-xs" style={{ background: 'rgba(61,110,255,0.08)', border: '1px solid rgba(61,110,255,0.15)' }}>
                <p className="text-blue-300/60 text-center">
                  Demo: <span className="text-blue-300 font-mono">admin@docusense.ai</span> / <span className="text-blue-300 font-mono">password123</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
