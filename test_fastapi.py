from fastapi.testclient import TestClient
import server

client = TestClient(server.app)
res = client.post("/api/projects/start", json={"requirement":"test", "model":"gemini-1.5-flash", "thread_id":"123", "messages":[]})
print(res.status_code, res.text)
