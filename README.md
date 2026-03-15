# DocuSense AI 🧠
### Enterprise Document Intelligence Platform

> Chat with your documents. Extract insights. Collaborate across teams.  
> 100% open-source, runs on your own infrastructure — no API costs, no data leaves your servers.

![Stack](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi)
![Stack](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![Stack](https://img.shields.io/badge/Ollama-mistral-black?style=flat-square)
![Stack](https://img.shields.io/badge/ChromaDB-vector_store-orange?style=flat-square)

---

## What It Does

DocuSense AI is a **Retrieval-Augmented Generation (RAG)** platform for enterprises. Upload your PDFs, Word docs, and text files — then have a natural language conversation with them.

### Key Features

| Feature | Details |
|---|---|
| **RAG Q&A** | Semantic search + LLM answer generation over your documents |
| **Multi-workspace** | Organize documents into isolated workspaces (Legal, Finance, HR, etc.) |
| **JWT Auth + RBAC** | Role-based access (Admin, Manager, Analyst) |
| **Real-time streaming** | SSE-based token streaming for live AI responses |
| **Auto-summarization** | Documents are summarized on upload |
| **Source citations** | Every answer shows which document it came from + confidence score |
| **Analytics dashboard** | Track documents, chats, indexed chunks per workspace |
| **Fully private** | All AI runs locally via Ollama — zero cloud dependency |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   React Frontend                     │
│   Auth │ Workspaces │ Document Upload │ AI Chat      │
└────────────────────┬────────────────────────────────┘
                     │ HTTP / SSE
┌────────────────────▼────────────────────────────────┐
│              FastAPI Backend (Python)                │
│  /auth  /workspaces  /documents  /chat  /analytics  │
│                                                      │
│   SQLite (metadata) │ ChromaDB (vectors)             │
└──────┬─────────────────────────┬───────────────────┘
       │                         │
┌──────▼──────┐         ┌────────▼──────────┐
│   Ollama    │         │    ChromaDB        │
│  mistral    │         │  nomic-embed-text  │
│  (4.1 GB)   │         │    (274 MB)        │
└─────────────┘         └───────────────────┘
```

### RAG Pipeline

```
Document Upload
      │
      ▼
Text Extraction (PyMuPDF / python-docx)
      │
      ▼
Chunking (512 tokens, 64 overlap)
      │
      ▼
Embedding (nomic-embed-text via Ollama)
      │
      ▼
Vector Store (ChromaDB, per-workspace collection)
      │
    [Query]
      │
      ▼
Semantic Search → Top-K chunks retrieved
      │
      ▼
Context + Question → mistral LLM
      │
      ▼
Answer + Source Citations → User
```

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- 8GB+ RAM (for mistral model)

### 1. Clone & Setup

```bash
git clone https://github.com/yourorg/docusense-ai
cd docusense-ai
chmod +x setup.sh start.sh
./setup.sh       # installs everything, pulls models, seeds demo user
```

### 2. Run

```bash
./start.sh
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |

### 3. Login

```
Email:    admin@docusense.ai
Password: password123
```

---

## Docker Deployment

```bash
# Production deploy
docker-compose up -d

# Pull models into Ollama container
docker exec docusense-ollama ollama pull mistral
docker exec docusense-ollama ollama pull nomic-embed-text
```

---

## API Reference

### Authentication
```
POST /api/v1/auth/register    Register user
POST /api/v1/auth/login       Login → JWT token
GET  /api/v1/auth/me          Current user
```

### Workspaces
```
GET    /api/v1/workspaces           List user workspaces
POST   /api/v1/workspaces           Create workspace
GET    /api/v1/workspaces/{id}      Get workspace
DELETE /api/v1/workspaces/{id}      Delete workspace
```

### Documents
```
POST   /api/v1/documents/upload/{workspace_id}   Upload & index document
GET    /api/v1/documents/{workspace_id}           List documents
DELETE /api/v1/documents/{doc_id}                 Delete document
```

### Chat (RAG)
```
POST /api/v1/chat/sessions            Create chat session
GET  /api/v1/chat/sessions/{ws_id}    List sessions
GET  /api/v1/chat/messages/{sess_id}  Get chat history
POST /api/v1/chat/ask                 Ask a question (RAG)
POST /api/v1/chat/ask/stream          Ask with SSE streaming
```

---

## LLM Models

| Model | Size | Purpose |
|---|---|---|
| `mistral` | 4.1 GB | Q&A, summarization, title generation |
| `nomic-embed-text` | 274 MB | Document & query embeddings |

Both models run 100% locally via Ollama. No internet required after setup.

**Alternative lightweight models:**
- `phi3:mini` (2.3 GB) — faster, less accurate
- `llama3.2:3b` (2.0 GB) — fast for simple tasks
- `gemma2:2b` (1.6 GB) — Google's smallest

Change model in `backend/config.py`.

---

## Project Structure

```
docusense/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── config.py                # Settings (env vars)
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── models/
│   │   ├── database.py          # SQLAlchemy models + SQLite
│   │   └── schemas.py           # Pydantic request/response schemas
│   ├── routers/
│   │   ├── auth.py              # JWT authentication
│   │   ├── workspaces.py        # Workspace CRUD
│   │   ├── documents.py         # Upload, index, delete
│   │   ├── chat.py              # RAG Q&A + streaming
│   │   └── analytics.py        # Stats
│   └── services/
│       ├── auth_service.py      # JWT + bcrypt
│       ├── llm_service.py       # Ollama integration
│       ├── vector_store.py      # ChromaDB operations
│       └── document_processor.py # Extract → chunk → embed
│
└── frontend/
    ├── src/
    │   ├── App.jsx              # Router + layout
    │   ├── pages/
    │   │   ├── AuthPage.jsx     # Login / register
    │   │   ├── Dashboard.jsx    # Workspace overview
    │   │   └── WorkspacePage.jsx # Chat + docs + analytics
    │   ├── components/
    │   │   ├── layout/Sidebar.jsx
    │   │   ├── chat/ChatInterface.jsx
    │   │   ├── documents/DocumentUploader.jsx
    │   │   ├── documents/DocumentList.jsx
    │   │   └── ui/WorkspaceModal.jsx
    │   ├── services/api.js      # Axios API client
    │   └── store/index.js       # Zustand global state
    ├── Dockerfile
    └── nginx.conf
```

---

## Configuration

Edit `backend/.env` or `backend/config.py`:

```env
SECRET_KEY=your-production-secret-key
OLLAMA_MODEL=mistral
OLLAMA_EMBED_MODEL=nomic-embed-text
MAX_FILE_SIZE_MB=50
CHUNK_SIZE=512
CHUNK_OVERLAP=64
TOP_K_RESULTS=5
```

---

## License

MIT — use freely in commercial and private projects.
