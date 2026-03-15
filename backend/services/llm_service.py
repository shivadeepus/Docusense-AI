import httpx
import json
from typing import List, AsyncGenerator
from config import settings

SYSTEM_PROMPT = """You are DocuSense AI, an expert enterprise document intelligence assistant.
Your job is to answer questions accurately using ONLY the provided document context.

Rules:
- Base answers strictly on the provided context chunks
- If the context does not contain enough information, say so clearly
- Always cite which document your information comes from
- Be concise yet thorough
- Use bullet points for lists, bold for key terms
- Never hallucinate or invent facts not in the context"""

class LLMService:
    def __init__(self):
        self.base_url = settings.GROQ_BASE_URL
        self.model = settings.GROQ_MODEL
        self.api_key = settings.GROQ_API_KEY

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    async def is_available(self) -> bool:
        if not self.api_key:
            return False
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get(
                    f"{self.base_url}/models",
                    headers=self._headers()
                )
                return r.status_code == 200
        except:
            return False

    def _build_rag_prompt(self, question: str, context_chunks: List[dict]) -> str:
        context_parts = []
        for i, chunk in enumerate(context_chunks, 1):
            context_parts.append(
                f"[Source {i}: {chunk['doc_name']}]\n{chunk['content']}"
            )
        context_str = "\n\n---\n\n".join(context_parts)

        return f"""CONTEXT FROM DOCUMENTS:
{context_str}

---

QUESTION: {question}

Please answer the question based on the context above. Cite the source document names when referencing specific information."""

    async def answer(self, question: str, context_chunks: List[dict]) -> dict:
        """Generate a RAG answer using Groq API."""
        if not self.api_key:
            return self._fallback(context_chunks)

        prompt = self._build_rag_prompt(question, context_chunks)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self._headers(),
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.1,
                        "max_tokens": 1024,
                        "top_p": 0.9,
                    }
                )
                if resp.status_code == 200:
                    data = resp.json()
                    answer = data["choices"][0]["message"]["content"].strip()
                    tokens = data.get("usage", {}).get("total_tokens", 0)
                    return {"answer": answer, "tokens": tokens, "ai_powered": True}
                else:
                    print(f"Groq error: {resp.status_code} — {resp.text}")
        except Exception as e:
            print(f"LLM error: {e}")

        return self._fallback(context_chunks)

    async def answer_stream(self, question: str, context_chunks: List[dict]) -> AsyncGenerator[str, None]:
        """Streaming RAG answer via Groq SSE."""
        if not self.api_key:
            yield "Groq API key not configured. Please add GROQ_API_KEY to your .env file."
            return

        prompt = self._build_rag_prompt(question, context_chunks)

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/chat/completions",
                    headers=self._headers(),
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.1,
                        "max_tokens": 1024,
                        "stream": True,
                    }
                ) as resp:
                    async for line in resp.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:]
                            if data_str.strip() == "[DONE]":
                                break
                            try:
                                data = json.loads(data_str)
                                token = data["choices"][0]["delta"].get("content", "")
                                if token:
                                    yield token
                            except:
                                continue
        except Exception as e:
            print(f"Stream error: {e}")
            yield "Error generating response."

    async def summarize(self, text: str, doc_name: str) -> str:
        """Generate a short document summary."""
        if not self.api_key:
            return " ".join(text.split()[:50]) + "..."

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self._headers(),
                    json={
                        "model": self.model,
                        "messages": [
                            {
                                "role": "user",
                                "content": f"Summarize this document in 2-3 sentences. Be concise.\n\nDocument: {doc_name}\nContent: {text[:1500]}\n\nSummary:"
                            }
                        ],
                        "temperature": 0.3,
                        "max_tokens": 150,
                    }
                )
                if resp.status_code == 200:
                    return resp.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            print(f"Summarize error: {e}")

        return " ".join(text.split()[:50]) + "..."

    async def generate_chat_title(self, first_question: str) -> str:
        """Auto-generate a short chat session title."""
        if not self.api_key:
            return " ".join(first_question.split()[:5]) + "..."

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self._headers(),
                    json={
                        "model": self.model,
                        "messages": [
                            {
                                "role": "user",
                                "content": f"Generate a short 4-6 word title for a chat that starts with this question. Return ONLY the title, nothing else.\n\nQuestion: {first_question}\nTitle:"
                            }
                        ],
                        "temperature": 0.5,
                        "max_tokens": 20,
                    }
                )
                if resp.status_code == 200:
                    title = resp.json()["choices"][0]["message"]["content"].strip().strip('"')
                    return title[:60] if title else "New Chat"
        except Exception as e:
            print(f"Title gen error: {e}")

        return " ".join(first_question.split()[:5]) + "..."

    def _fallback(self, context_chunks: List[dict]) -> dict:
        """Return best matching chunk when API is unavailable."""
        if context_chunks:
            best = context_chunks[0]
            answer = (
                f"**Based on '{best['doc_name']}':**\n\n"
                f"{best['content'][:600]}...\n\n"
                f"*Note: Add GROQ_API_KEY to .env to enable full AI answers.*"
            )
        else:
            answer = "No relevant information found in the workspace documents for this query."
        return {"answer": answer, "tokens": 0, "ai_powered": False}


llm_service = LLMService()
