import os
import secrets
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field, model_validator
from starlette.middleware.sessions import SessionMiddleware

from app.database import get_or_create_board, initialize_database, save_board

USERNAME = "user"
PASSWORD = "password"
COLUMN_IDS = [
    "col-backlog",
    "col-discovery",
    "col-progress",
    "col-review",
    "col-done",
]


class LoginRequest(BaseModel):
    username: str
    password: str


class CardData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    details: str


class ColumnData(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str
    title: str
    card_ids: list[str] = Field(alias="cardIds")


class BoardData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    columns: list[ColumnData]
    cards: dict[str, CardData]

    @model_validator(mode="after")
    def validate_board(self) -> "BoardData":
        column_ids = [column.id for column in self.columns]
        if column_ids != COLUMN_IDS:
            raise ValueError("Board columns must match the fixed column set and order")

        card_ids = [card_id for column in self.columns for card_id in column.card_ids]
        if len(card_ids) != len(set(card_ids)) or set(card_ids) != set(self.cards):
            raise ValueError("Each board card must appear in exactly one column")
        if any(card_id != card.id for card_id, card in self.cards.items()):
            raise ValueError("Card map keys must match card IDs")
        return self


def create_app(
    static_dir: Path | None = None, db_path: Path | None = None
) -> FastAPI:
    application = FastAPI(title="Project Management MVP API")
    default_db_path = Path(__file__).parents[1] / "data" / "kanban.sqlite3"
    database_path = db_path or Path(
        os.environ.get("DB_PATH", default_db_path)
    )
    initialize_database(database_path)
    application.add_middleware(
        SessionMiddleware,
        secret_key=os.environ.get("SESSION_SECRET") or secrets.token_urlsafe(32),
        session_cookie="pm_session",
        max_age=43_200,
        same_site="lax",
        https_only=False,
    )

    @application.post("/api/auth/login")
    def login(credentials: LoginRequest, request: Request) -> dict[str, str]:
        if credentials.username != USERNAME or credentials.password != PASSWORD:
            raise HTTPException(status_code=401, detail="Invalid username or password")
        request.session.clear()
        request.session["username"] = USERNAME
        return {"username": USERNAME}

    @application.get("/api/auth/me")
    def current_session(request: Request) -> dict[str, str]:
        username = request.session.get("username")
        if username != USERNAME:
            raise HTTPException(status_code=401, detail="Not authenticated")
        return {"username": username}

    @application.get("/api/board")
    def read_board(request: Request) -> dict[str, object]:
        username = request.session.get("username")
        if username != USERNAME:
            raise HTTPException(status_code=401, detail="Not authenticated")
        return get_or_create_board(database_path, username)

    @application.put("/api/board")
    def update_board(board: BoardData, request: Request) -> dict[str, object]:
        username = request.session.get("username")
        if username != USERNAME:
            raise HTTPException(status_code=401, detail="Not authenticated")
        board_data = board.model_dump(by_alias=True)
        save_board(database_path, username, board_data)
        return board_data

    @application.post("/api/auth/logout")
    def logout(request: Request) -> dict[str, str]:
        request.session.clear()
        return {"status": "ok"}

    @application.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @application.get("/api/example")
    def example() -> dict[str, str]:
        return {"message": "Hello from the Project Management MVP API"}

    frontend_dir = static_dir or Path(
        os.environ.get("FRONTEND_DIR", Path(__file__).with_name("static"))
    )
    application.mount(
        "/", StaticFiles(directory=frontend_dir, html=True), name="frontend"
    )
    return application


app = create_app()