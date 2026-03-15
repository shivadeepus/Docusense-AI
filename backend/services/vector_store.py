import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer
from typing import List, Optional
from config import settings

# Loaded once at startup — only 90MB, runs fully local, no API needed
_embed_model = SentenceTransformer("all-MiniLM-L6-v2")

class VectorStoreService:
    def __init__(self):
        self.client = chromadb.PersistentClient(
            path=settings.CHROMA_PERSIST_DIR,
            settings=ChromaSettings(anonymized_telemetry=False)
        )

    def _get_collection(self, workspace_id: str):
        """Get or create a ChromaDB collection per workspace."""
        collection_name = f"workspace_{workspace_id.replace('-', '_')}"
        return self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )

    def get_embedding(self, text: str) -> List[float]:
        """Get embedding using local sentence-transformers model (all-MiniLM-L6-v2).
        - Size: ~90MB (downloaded once automatically)
        - Speed: Very fast, runs on CPU
        - No API key or internet needed after first download
        """
        embedding = _embed_model.encode(text, normalize_embeddings=True)
        return embedding.tolist()

    async def add_chunks(
        self,
        workspace_id: str,
        doc_id: str,
        doc_name: str,
        chunks: List[str],
        metadatas: Optional[List[dict]] = None
    ) -> int:
        collection = self._get_collection(workspace_id)
        if not chunks:
            return 0

        # Batch embed all chunks at once — much faster than one by one
        embeddings = _embed_model.encode(chunks, normalize_embeddings=True).tolist()

        ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
        metas = metadatas or [{}] * len(chunks)
        for i, m in enumerate(metas):
            m.update({"doc_id": doc_id, "doc_name": doc_name})
            # ChromaDB does not accept None values — replace with empty string
            for k, v in m.items():
                if v is None:
                    m[k] = ""

        collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=chunks,
            metadatas=metas
        )
        return len(chunks)

    async def search(
        self,
        workspace_id: str,
        query: str,
        top_k: int = None,
        doc_ids: Optional[List[str]] = None
    ) -> List[dict]:
        top_k = top_k or settings.TOP_K_RESULTS
        collection = self._get_collection(workspace_id)

        query_embedding = self.get_embedding(query)

        where = None
        if doc_ids:
            where = {"doc_id": {"$in": doc_ids}}

        try:
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=min(top_k, collection.count() or 1),
                where=where,
                include=["documents", "metadatas", "distances"]
            )
        except Exception as e:
            print(f"Search error: {e}")
            return []

        chunks = []
        if results["documents"]:
            for doc, meta, dist in zip(
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0]
            ):
                chunks.append({
                    "content": doc,
                    "doc_id": meta.get("doc_id", ""),
                    "doc_name": meta.get("doc_name", ""),
                    "page": meta.get("page"),
                    "score": round(1 - dist, 4)
                })
        return chunks

    async def delete_document(self, workspace_id: str, doc_id: str):
        collection = self._get_collection(workspace_id)
        existing = collection.get(where={"doc_id": doc_id})
        if existing["ids"]:
            collection.delete(ids=existing["ids"])

    def get_collection_count(self, workspace_id: str) -> int:
        try:
            return self._get_collection(workspace_id).count()
        except:
            return 0

vector_store = VectorStoreService()
