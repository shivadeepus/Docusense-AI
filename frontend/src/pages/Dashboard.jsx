import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store";
import { workspaceApi, analyticsApi } from "../services/api";
import {
  Plus,
  Folder,
  MessageSquare,
  FileText,
  Cpu,
  Wifi,
  WifiOff,
} from "lucide-react";
import toast from "react-hot-toast";
import WorkspaceModal from "../components/ui/WorkspaceModal";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard() {
  const { workspaces, setWorkspaces, user } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [systemStatus, setSystemStatus] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [wsRes, sysRes] = await Promise.all([
        workspaceApi.list(),
        analyticsApi.system(),
      ]);
      setWorkspaces(wsRes.data);
      setSystemStatus(sysRes.data);
    } catch (err) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const totalDocs = workspaces.reduce((s, w) => s + w.document_count, 0);

  return (
    <div className="flex-1 overflow-auto p-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="font-display text-4xl text-white mb-2">
            Good {getGreeting()},{" "}
            <span className="gradient-text">
              {user?.full_name?.split(" ")[0]}
            </span>
          </h1>
          <p className="text-blue-200/50">Your document intelligence hub</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> New Workspace
        </button>
      </div>

      {/* System status bar */}

      {systemStatus && (
        <div className="flex items-center gap-6 mb-8 p-4 glass rounded-xl">
          <div className="flex items-center gap-2">
            {systemStatus.ollama_status === "connected" ? (
              <Wifi size={14} className="text-emerald-400" />
            ) : (
              <WifiOff size={14} className="text-amber-400" />
            )}
            <span className="text-xs text-blue-200/60">
              Groq API:{" "}
              <span
                className={
                  systemStatus.ollama_status === "connected"
                    ? "text-emerald-400"
                    : "text-amber-400"
                }
              >
                {systemStatus.ollama_status === "connected"
                  ? "Connected"
                  : "Offline"}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Cpu size={14} className="text-blue-400" />
            <span className="text-xs text-blue-200/60">
              LLM:{" "}
              <span className="text-blue-300 font-mono">
                {systemStatus.model}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-blue-400" />
            <span className="text-xs text-blue-200/60">
              Embeddings:{" "}
              <span className="text-blue-300 font-mono">
                all-MiniLM-L6-v2 (local)
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          {
            label: "Workspaces",
            value: workspaces.length,
            icon: Folder,
            color: "#3d6eff",
          },
          {
            label: "Documents",
            value: totalDocs,
            icon: FileText,
            color: "#10b981",
          },
          {
            label: "Role",
            value: user?.role,
            icon: MessageSquare,
            color: "#f59e0b",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-blue-200/50 font-medium uppercase tracking-wider">
                {label}
              </span>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: color + "20" }}
              >
                <Icon size={15} style={{ color }} />
              </div>
            </div>
            <div className="font-display text-3xl text-white capitalize">
              {value ?? "—"}
            </div>
          </div>
        ))}
      </div>

      {/* Workspaces grid */}
      <div>
        <h2 className="font-display text-xl text-white mb-4">
          Your Workspaces
        </h2>
        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-40 rounded-xl" />
            ))}
          </div>
        ) : workspaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 glass rounded-xl">
            <Folder size={48} className="text-blue-300/20 mb-4" />
            <p className="text-blue-200/50 mb-4">No workspaces yet</p>
            <button onClick={() => setShowModal(true)} className="btn-primary">
              Create your first workspace
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((ws) => (
              <WorkspaceCard
                key={ws.id}
                workspace={ws}
                onClick={() => navigate(`/workspace/${ws.id}`)}
              />
            ))}
            <button
              onClick={() => setShowModal(true)}
              className="glass rounded-xl p-6 border-2 border-dashed border-blue-500/20 hover:border-blue-500/40 transition-all flex flex-col items-center justify-center gap-3 text-blue-300/40 hover:text-blue-300/70"
            >
              <Plus size={24} />
              <span className="text-sm font-medium">New Workspace</span>
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <WorkspaceModal
          onClose={() => setShowModal(false)}
          onCreated={loadData}
        />
      )}
    </div>
  );
}

function WorkspaceCard({ workspace: ws, onClick }) {
  return (
    <button
      onClick={onClick}
      className="glass-hover rounded-xl p-6 text-left transition-all group animate-slide-up"
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{
            backgroundColor: ws.color + "25",
            border: `1px solid ${ws.color}35`,
          }}
        >
          <Folder size={20} style={{ color: ws.color }} />
        </div>
        <div className="text-xs text-blue-200/30 group-hover:text-blue-200/50 transition-colors">
          {formatDistanceToNow(new Date(ws.created_at), { addSuffix: true })}
        </div>
      </div>
      <h3 className="font-display text-lg text-white mb-1 group-hover:text-blue-100 transition-colors">
        {ws.name}
      </h3>
      {ws.description && (
        <p className="text-sm text-blue-200/40 mb-4 line-clamp-2">
          {ws.description}
        </p>
      )}
      <div className="flex items-center gap-4">
        <span className="text-xs text-blue-200/40 flex items-center gap-1.5">
          <FileText size={12} /> {ws.document_count} docs
        </span>
        <span className="text-xs text-blue-200/40 flex items-center gap-1.5">
          <MessageSquare size={12} /> {ws.member_count} members
        </span>
      </div>
    </button>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}
