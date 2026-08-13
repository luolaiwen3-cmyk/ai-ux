import hashlib
import json


def digest(records):
    return hashlib.sha256(json.dumps(records, separators=(",", ":"), sort_keys=True).encode()).hexdigest()


def recorded_session(client, authenticated_client):
    task = authenticated_client.post("/api/tasks", json={"name": "回放测试", "scenario": "checkout-coupon"}).json()
    session = client.post(f"/api/public/tasks/{task['public_token']}/sessions").json()
    headers = {"X-Upload-Token": session["upload_token"]}
    for stream, records in [("rrweb", [{"type": 0, "timestamp": 10}]), ("face", [{"t": 10, "faceDetected": True}])]:
        client.post(f"/api/public/sessions/{session['id']}/batches", headers=headers, json={"stream": stream, "sequence": 0, "records": records, "checksum": digest(records)})
    client.post(f"/api/public/sessions/{session['id']}/complete", headers=headers, json={"duration_ms": 12000, "stop_reason": "manual"})
    return session


def test_list_detail_streams_and_delete(client, authenticated_client):
    session = recorded_session(client, authenticated_client)
    listed = authenticated_client.get("/api/sessions").json()
    assert listed[0]["id"] == session["id"]
    assert listed[0]["task_name"] == "回放测试"
    assert authenticated_client.get(f"/api/sessions/{session['id']}").status_code == 200
    assert authenticated_client.get(f"/api/sessions/{session['id']}/rrweb").json()[0]["type"] == 0
    assert authenticated_client.get(f"/api/sessions/{session['id']}/face-frames").json()[0]["faceDetected"] is True
    assert authenticated_client.delete(f"/api/sessions/{session['id']}").status_code == 204
    assert authenticated_client.get(f"/api/sessions/{session['id']}").status_code == 404


def test_analyst_sessions_require_authentication(client):
    assert client.get("/api/sessions").status_code == 401
