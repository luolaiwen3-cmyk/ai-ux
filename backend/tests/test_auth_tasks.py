def test_authentication_lifecycle(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/auth/login", json={"username": "admin", "password": "wrong"}).status_code == 401
    response = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert response.status_code == 200
    assert client.get("/api/auth/me").json() == {"username": "admin"}
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401


def test_task_crud_and_public_token(authenticated_client):
    created = authenticated_client.post("/api/tasks", json={"name": "结算测试", "scenario": "checkout-coupon"})
    assert created.status_code == 201
    task = created.json()
    assert task["session_count"] == 0
    assert authenticated_client.get(f"/api/public/tasks/{task['public_token']}").json()["name"] == "结算测试"
    listed = authenticated_client.get("/api/tasks").json()
    assert [item["id"] for item in listed] == [task["id"]]
    updated = authenticated_client.patch(f"/api/tasks/{task['id']}", json={"status": "closed"})
    assert updated.status_code == 200
    assert authenticated_client.get(f"/api/public/tasks/{task['public_token']}").status_code == 404


def test_tasks_require_authentication(client):
    assert client.get("/api/tasks").status_code == 401
    assert client.post("/api/tasks", json={"name": "x", "scenario": "checkout-coupon"}).status_code == 401
