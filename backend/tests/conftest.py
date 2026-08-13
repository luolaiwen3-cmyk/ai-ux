import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, create_database_engine, get_db
from app.main import app
from app.api.sessions import get_data_dir


@pytest.fixture
def client(tmp_path):
    engine = create_database_engine(f"sqlite:///{tmp_path / 'test.sqlite3'}")
    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_db():
        with testing_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_data_dir] = lambda: tmp_path / "data"
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()


@pytest.fixture
def authenticated_client(client):
    response = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert response.status_code == 200
    return client
