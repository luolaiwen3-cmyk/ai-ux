def create_completed_session(client, authenticated_client):
    task = authenticated_client.post("/api/tasks", json={"name": "报告测试", "scenario": "checkout-coupon"}).json()
    session = client.post(f"/api/public/tasks/{task['public_token']}/sessions").json()
    headers = {"X-Upload-Token": session["upload_token"]}
    client.post(f"/api/public/sessions/{session['id']}/complete", headers=headers, json={"duration_ms": 20000, "stop_reason": "manual"})
    return session


def test_generate_read_and_version_report(client, authenticated_client):
    session = create_completed_session(client, authenticated_client)
    url = f"/api/sessions/{session['id']}/report"
    generated = authenticated_client.post(url)
    assert generated.status_code == 200
    assert generated.json()["version"] == 1
    assert generated.json()["content"]["severity"] == "P0"
    assert authenticated_client.get(url).json()["content"]["title"]
    assert authenticated_client.post(url).json()["version"] == 2
    detail = authenticated_client.get(f"/api/sessions/{session['id']}").json()
    assert detail["has_report"] is True
    assert detail["severity"] == "P0"


def test_missing_report_and_session(authenticated_client):
    assert authenticated_client.get("/api/sessions/missing/report").status_code == 404
    assert authenticated_client.post("/api/sessions/missing/report").status_code == 404
