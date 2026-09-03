import os
from pathlib import Path

KB_DIR = Path("./data/kb")

def init_kb_dir():
    KB_DIR.mkdir(parents=True, exist_ok=True)

def chunk_text(text, chunk_size=300, overlap=50):
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk.strip():
            chunks.append(chunk)
    return chunks

def extract_text_from_file(file_path):
    ext = file_path.suffix.lower()
    text = ""
    try:
        if ext == ".txt" or ext == ".csv":
            with open(file_path, "r", encoding="utf-8") as f:
                text = f.read()
        elif ext == ".pdf":
            import PyPDF2
            with open(file_path, "rb") as f:
                pdf = PyPDF2.PdfReader(f)
                text = "\n".join(page.extract_text() for page in pdf.pages if page.extract_text())
        elif ext == ".docx":
            from docx import Document
            doc = Document(file_path)
            text = "\n".join(paragraph.text for paragraph in doc.paragraphs)
    except Exception as e:
        print(f"Error reading {file_path.name}: {e}")
    return text

def retrieve_from_kb(query, top_k=3):
    init_kb_dir()
    
    # Fast path if no files
    if not list(KB_DIR.iterdir()):
        return ""
        
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
    except ImportError:
        return ""
        
    all_chunks = []
    chunk_sources = []
    
    # 1. Read and chunk all documents in KB
    for file_path in KB_DIR.iterdir():
        if file_path.is_file() and not file_path.name.startswith("."):
            text = extract_text_from_file(file_path)
            if text:
                chunks = chunk_text(text)
                for chunk in chunks:
                    all_chunks.append(chunk)
                    chunk_sources.append(file_path.name)
                    
    if not all_chunks:
        return ""
        
    # 2. Vectorize using TF-IDF
    vectorizer = TfidfVectorizer(stop_words='english')
    try:
        tfidf_matrix = vectorizer.fit_transform(all_chunks)
        query_vec = vectorizer.transform([query])
        
        # 3. Calculate cosine similarity
        cosine_sim = cosine_similarity(query_vec, tfidf_matrix).flatten()
        
        # 4. Get top_k indices
        top_indices = cosine_sim.argsort()[-top_k:][::-1]
        
        results = []
        for idx in top_indices:
            if cosine_sim[idx] > 0.05: # Minimum threshold
                results.append(f"--- Document: {chunk_sources[idx]} ---\n{all_chunks[idx]}")
                
        if results:
            return "[RELEVANT KNOWLEDGE BASE CONTEXT]\nThe following context was retrieved from the user's permanent Knowledge Base. Use it to answer the prompt if relevant:\n\n" + "\n\n".join(results)
    except Exception as e:
        print(f"RAG retrieval error: {e}")
        
    return ""
