import hashlib
import json


def checksum(records):
    encoded = json.dumps(records, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()
    return hashlib.sha256(encoded).hexdigest()


def create_task_and_session(client, authenticated_client):
    task = authenticated_client.post("/api/tasks", json={"name": "测试", "scenario": "checkout-coupon"}).json()
    session = client.post(f"/api/public/tasks/{task['public_token']}/sessions").json()
    return task, session


def test_create_upload_and_complete(client, authenticated_client, tmp_path):
    _, session = create_task_and_session(client, authenticated_client)
    records = [{"type": 2, "timestamp": 123}, {"type": 3, "data": {"x": 1}}]
    payload = {"stream": "rrweb", "sequence": 0, "records": records, "checksum": checksum(records)}
    headers = {"X-Upload-Token": session["upload_token"]}
    uploaded = client.post(f"/api/public/sessions/{session['id']}/batches", json=payload, headers=headers)
    assert uploaded.status_code == 200
    assert uploaded.json()["duplicate"] is False
    duplicate = client.post(f"/api/public/sessions/{session['id']}/batches", json=payload, headers=headers)
    assert duplicate.json()["duplicate"] is True
    assert (tmp_path / "data" / "sessions" / session["id"] / "rrweb" / "000000.json.gz").exists()
    completed = client.post(f"/api/public/sessions/{session['id']}/complete", json={"duration_ms": 15000, "stop_reason": "manual"}, headers=headers)
    assert completed.json()["event_count"] == 2
    assert completed.json()["status"] == "completed"


def test_upload_rejects_invalid_token_and_checksum(client, authenticated_client):
    _, session = create_task_and_session(client, authenticated_client)
    records = [{"value": 1}]
    url = f"/api/public/sessions/{session['id']}/batches"
    payload = {"stream": "face", "sequence": 0, "records": records, "checksum": "0" * 64}
    assert client.post(url, json=payload, headers={"X-Upload-Token": "wrong"}).status_code == 404
    assert client.post(url, json=payload, headers={"X-Upload-Token": session["upload_token"]}).status_code == 422


def test_invalid_task_token_cannot_create_session(client):
    assert client.post("/api/public/tasks/not-real/sessions").status_code == 404
