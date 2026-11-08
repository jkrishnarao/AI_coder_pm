import json
from pathlib import Path

from fastapi.testclient import TestClient
import pytest

from app.database import DEFAULT_BOARD_FILE, get_or_create_board, initialize_database, save_board
from app.main import app, create_app

client = TestClient(app)


def test_root_serves_static_html() -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "Hello, Project Management MVP" in response.text
    assert "/api/example" in response.text


def test_health_endpoint() -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_example_endpoint() -> None:
    response = client.get("/api/example")

    assert response.status_code == 200
    assert response.json() == {
        "message": "Hello from the Project Management MVP API"
    }


def test_static_app_serves_exported_files(tmp_path: Path) -> None:
    (tmp_path / "index.html").write_text("<h1>Exported board</h1>")
    (tmp_path / "board.js").write_text("window.boardLoaded = true;")
    static_client = TestClient(create_app(tmp_path))

    page_response = static_client.get("/")
    asset_response = static_client.get("/board.js")
    api_response = static_client.get("/api/health")

    assert page_response.status_code == 200
    assert "Exported board" in page_response.text
    assert asset_response.text == "window.boardLoaded = true;"
    assert api_response.json() == {"status": "ok"}


def test_login_rejects_invalid_credentials() -> None:
    auth_client = TestClient(app)

    response = auth_client.post(
        "/api/auth/login", json={"username": "user", "password": "wrong"}
    )

    assert response.status_code == 401
    assert "pm_session" not in response.cookies
    assert auth_client.get("/api/auth/me").status_code == 401


def test_login_sets_http_only_session_and_survives_requests() -> None:
    auth_client = TestClient(app)

    response = auth_client.post(
        "/api/auth/login", json={"username": "user", "password": "password"}
    )

    assert response.status_code == 200
    assert response.json() == {"username": "user"}
    cookie = response.headers["set-cookie"].lower()
    assert "pm_session=" in cookie
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert auth_client.get("/api/auth/me").json() == {"username": "user"}


def test_logout_invalidates_session() -> None:
    auth_client = TestClient(app)
    auth_client.post(
        "/api/auth/login", json={"username": "user", "password": "password"}
    )

    response = auth_client.post("/api/auth/logout")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert auth_client.get("/api/auth/me").status_code == 401


def test_board_endpoint_requires_authentication(tmp_path: Path) -> None:
    board_client = TestClient(create_app(db_path=tmp_path / "board.db"))

    response = board_client.get("/api/board")

    assert response.status_code == 401


def test_board_is_seeded_updated_and_restored_after_relogin(tmp_path: Path) -> None:
    board_client = TestClient(create_app(db_path=tmp_path / "board.db"))
    login_response = board_client.post(
        "/api/auth/login", json={"username": "user", "password": "password"}
    )
    assert login_response.status_code == 200

    initial_board = board_client.get("/api/board").json()
    expected_default = json.loads(DEFAULT_BOARD_FILE.read_text(encoding="utf-8"))
    assert initial_board == expected_default

    initial_board["columns"][0]["title"] = "Prioritized"
    initial_board["cards"]["card-1"]["title"] = "Reviewed roadmap"
    updated = board_client.put("/api/board", json=initial_board)
    assert updated.status_code == 200
    assert updated.json() == initial_board

    board_client.post("/api/auth/logout")
    board_client.post(
        "/api/auth/login", json={"username": "user", "password": "password"}
    )
    restored = board_client.get("/api/board")
    assert restored.status_code == 200
    assert restored.json() == initial_board


def test_board_rejects_invalid_fixed_columns(tmp_path: Path) -> None:
    board_client = TestClient(create_app(db_path=tmp_path / "board.db"))
    board_client.post(
        "/api/auth/login", json={"username": "user", "password": "password"}
    )

    response = board_client.put("/api/board", json={"columns": [], "cards": {}})

    assert response.status_code == 422


def test_board_rejects_card_not_assigned_to_column(tmp_path: Path) -> None:
    board_client = TestClient(create_app(db_path=tmp_path / "board.db"))
    board_client.post(
        "/api/auth/login", json={"username": "user", "password": "password"}
    )
    board = board_client.get("/api/board").json()
    board["columns"][0]["cardIds"].append("card-missing")

    response = board_client.put("/api/board", json=board)

    assert response.status_code == 422


def test_database_rejects_board_for_missing_user(tmp_path: Path) -> None:
    db_path = tmp_path / "board.db"
    initialize_database(db_path)
    default_board = json.loads(DEFAULT_BOARD_FILE.read_text(encoding="utf-8"))

    with pytest.raises(LookupError, match="User does not exist"):
        get_or_create_board(db_path, "missing-user")
    with pytest.raises(LookupError, match="User does not exist"):
        save_board(db_path, "missing-user", default_board)