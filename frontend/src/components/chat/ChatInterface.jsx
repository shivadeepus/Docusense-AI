import { useState, useEffect, useRef } from 'react'
import { chatApi } from '../../services/api'
import { useAppStore } from '../../store'
import { Send, Plus, Trash2, MessageSquare, Bot, User, ExternalLink, Loader } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function ChatInterface({ workspaceId }) {
  const {
    chatSessions, setChatSessions, currentSession, setCurrentSession,
    addSession, removeSession, messages, setMessages, addMessage, isStreaming, setStreaming
  } = useAppStore()

  const sessions = chatSessions[workspaceId] || []
  const currentMessages = currentSession ? (messages[currentSession.id] || []) : []

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    loadSessions()
  }, [workspaceId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentMessages])

  const loadSessions = async () => {
    try {
      const { data } = await chatApi.listSessions(workspaceId)
      setChatSessions(workspaceId, data)
    } catch { }
  }

  const loadMessages = async (session) => {
    setCurrentSession(session)
    if (!messages[session.id]) {
      try {
        const { data } = await chatApi.getMessages(session.id)
        setMessages(session.id, data)
      } catch { }
    }
  }

  const newSession = async () => {
    try {
      const { data } = await chatApi.createSession({ workspace_id: workspaceId, title: 'New Chat' })
      addSession(workspaceId, data)
      setCurrentSession(data)
      setMessages(data.id, [])
    } catch {
      toast.error('Failed to create chat session')
    }
  }

  const deleteSession = async (sessionId, e) => {
    e.stopPropagation()
    try {
      await chatApi.deleteSession(sessionId)
      removeSession(workspaceId, sessionId)
      toast.success('Chat deleted')
    } catch { }
  }

  const sendMessage = async () => {
    if (!input.trim() || !currentSession || loading) return
    const question = input.trim()
    setInput('')
    setLoading(true)

    // Optimistic user message
    const userMsg = { id: Date.now(), role: 'user', content: question, created_at: new Date().toISOString() }
    addMessage(currentSession.id, userMsg)

    // Placeholder assistant message
    const placeholderId = Date.now() + 1
    addMessage(currentSession.id, {
      id: placeholderId, role: 'assistant', content: '', created_at: new Date().toISOString(),
      isLoading: true, sources: null
    })

    try {
      const { data } = await chatApi.ask({
        session_id: currentSession.id,
        workspace_id: workspaceId,
        question
      })

      // Replace placeholder with real response
      const sessionMsgs = messages[currentSession.id] || []
      const updated = sessionMsgs.filter(m => m.id !== placeholderId)
      updated.push({
        id: data.message_id,
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
        tokens_used: data.tokens_used,
        created_at: new Date().toISOString()
      })
      setMessages(currentSession.id, updated)

      // Reload sessions to get updated title
      loadSessions()
    } catch (err) {
      // Remove placeholder
      const sessionMsgs = messages[currentSession.id] || []
      setMessages(currentSession.id, sessionMsgs.filter(m => m.id !== placeholderId))
      toast.error(err.response?.data?.detail || 'Failed to get answer')
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="flex h-full">
      {/* Sessions sidebar */}
      <div className="w-56 flex flex-col border-r border-white/5 p-3 gap-2">
        <button onClick={newSession}
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all w-full"
          style={{ background: 'linear-gradient(135deg, rgba(61,110,255,0.2), rgba(26,79,255,0.1))', border: '1px solid rgba(61,110,255,0.25)', color: '#93b3ff' }}>
          <Plus size={15} /> New Chat
        </button>

        <div className="flex-1 overflow-y-auto space-y-1">
          {sessions.length === 0 && (
            <p className="text-xs text-blue-200/30 text-center py-6">No chats yet</p>
          )}
          {sessions.map(s => (
            <button key={s.id}
              onClick={() => loadMessages(s)}
              className={clsx(
                'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-xs transition-all group',
                currentSession?.id === s.id
                  ? 'bg-blue-600/20 text-blue-200 border border-blue-500/20'
                  : 'text-blue-200/50 hover:text-blue-200 hover:bg-white/4'
              )}>
              <MessageSquare size={12} className="shrink-0" />
              <span className="flex-1 truncate">{s.title}</span>
              <span onClick={(e) => deleteSession(s.id, e)}
                className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400 p-0.5 rounded">
                <Trash2 size={11} />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Chat main */}
      <div className="flex-1 flex flex-col min-w-0">
        {!currentSession ? (
          <EmptyState onNew={newSession} />
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {currentMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center mb-4">
                    <Bot size={28} className="text-blue-400" />
                  </div>
                  <h3 className="font-display text-lg text-white mb-2">Ask your documents</h3>
                  <p className="text-sm text-blue-200/40 max-w-xs">
                    Ask any question — DocuSense AI will search through all indexed documents to find the answer.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2 justify-center">
                    {SUGGESTIONS.map(s => (
                      <button key={s} onClick={() => setInput(s)}
                        className="text-xs px-3 py-1.5 rounded-full glass-hover text-blue-300/60">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {currentMessages.map((msg, i) => (
                <MessageBubble key={msg.id || i} message={msg} />
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-white/5">
              <div className="flex gap-3 glass rounded-xl p-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder="Ask a question about your documents..."
                  className="flex-1 bg-transparent text-sm text-blue-100 placeholder-blue-300/30 outline-none resize-none py-2 px-2 min-h-[44px] max-h-32"
                  rows={1}
                  disabled={loading}
                />
                <button onClick={sendMessage} disabled={!input.trim() || loading}
                  className="btn-primary self-end px-3 py-2.5 rounded-lg">
                  {loading ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
              <p className="text-xs text-blue-200/25 mt-2 text-center">
                AI answers are based on your uploaded documents. Always verify critical information.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function MessageBubble({ message: msg }) {
  const isUser = msg.role === 'user'
  const sources = typeof msg.sources === 'string' ? JSON.parse(msg.sources || '[]') : msg.sources || []

  return (
    <div className={clsx('flex gap-3 animate-slide-up', isUser ? 'flex-row-reverse' : '')}>
      <div className={clsx(
        'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-1',
        isUser ? 'bg-blue-600/30' : 'bg-indigo-900/50 border border-blue-500/20'
      )}>
        {isUser ? <User size={15} className="text-blue-300" /> : <Bot size={15} className="text-blue-400" />}
      </div>

      <div className={clsx('max-w-[80%] space-y-2', isUser ? 'items-end' : '')}>
        <div className={clsx(
          'rounded-2xl px-4 py-3',
          isUser
            ? 'bg-blue-600/25 border border-blue-500/20 text-blue-100 text-sm'
            : 'glass text-sm'
        )}>
          {msg.isLoading ? (
            <div className="dot-pulse py-1"><span/><span/><span/></div>
          ) : isUser ? (
            <p>{msg.content}</p>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose-ai">
              {msg.content}
            </ReactMarkdown>
          )}
        </div>

        {/* Sources */}
        {!isUser && sources.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {sources.map((src, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs"
                style={{ background: 'rgba(61,110,255,0.1)', border: '1px solid rgba(61,110,255,0.2)' }}>
                <ExternalLink size={10} className="text-blue-400" />
                <span className="text-blue-300/70 truncate max-w-[120px]">{src.doc_name}</span>
                <span className="text-blue-400/50">{Math.round(src.score * 100)}%</span>
              </div>
            ))}
          </div>
        )}

        {msg.tokens_used > 0 && (
          <span className="text-xs text-blue-200/25">{msg.tokens_used} tokens</span>
        )}
      </div>
    </div>
  )
}

function EmptyState({ onNew }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-20 h-20 rounded-3xl glass flex items-center justify-center mb-6"
        style={{ border: '1px solid rgba(61,110,255,0.2)' }}>
        <MessageSquare size={36} className="text-blue-400/60" />
      </div>
      <h2 className="font-display text-2xl text-white mb-3">Start a conversation</h2>
      <p className="text-blue-200/50 mb-6 max-w-sm">
        Create a new chat to ask questions about your documents. DocuSense AI uses RAG to find accurate answers.
      </p>
      <button onClick={onNew} className="btn-primary flex items-center gap-2">
        <Plus size={16} /> New Chat
      </button>
    </div>
  )
}

const SUGGESTIONS = [
  'Summarize the key findings',
  'What are the main risks mentioned?',
  'List all action items',
  'Compare the different sections',
]
