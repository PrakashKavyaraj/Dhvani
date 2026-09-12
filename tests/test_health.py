def test_health_returns_component_versions(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["versions"]["model"] == "baseline-v1"
