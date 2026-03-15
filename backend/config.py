from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # App
    APP_NAME: str = "DocuSense AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Security
    SECRET_KEY: str = "docusense-super-secret-key-change-in-production-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./docusense.db"

    # ChromaDB
    CHROMA_PERSIST_DIR: str = "./chroma_data"

    # Groq
    GROQ_API_KEY: str = ""                        # Get free key at groq.com
    GROQ_MODEL: str = "llama-3.1-8b-instant"      # Fast, free, actively supported
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"

    # Embeddings (local, lightweight — no Ollama needed)
    EMBED_MODEL: str = "all-MiniLM-L6-v2"        # Only 90MB, runs locally

    # File uploads
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE_MB: int = 50
    ALLOWED_EXTENSIONS: list = [".pdf", ".docx", ".txt", ".md"]

    # RAG settings
    CHUNK_SIZE: int = 512
    CHUNK_OVERLAP: int = 64
    TOP_K_RESULTS: int = 5

    class Config:
        env_file = ".env"

settings = Settings()
