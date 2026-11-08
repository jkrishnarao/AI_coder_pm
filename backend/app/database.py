import json
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Any

DEFAULT_BOARD_FILE = Path(__file__).with_name("default_board.json")


def initialize_database(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(db_path)) as connection:
        connection.execute("PRAGMA foreign_keys = ON")
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT NOT NULL UNIQUE
            );
            CREATE TABLE IF NOT EXISTS boards (
                user_id INTEGER PRIMARY KEY REFERENCES users(id),
                board_json TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        connection.execute(
            "INSERT OR IGNORE INTO users (username) VALUES (?)", ("user",)
        )
        connection.commit()


def get_or_create_board(db_path: Path, username: str) -> dict[str, Any]:
    with closing(sqlite3.connect(db_path)) as connection:
        connection.row_factory = sqlite3.Row
        user = connection.execute(
            "SELECT id FROM users WHERE username = ?", (username,)
        ).fetchone()
        if user is None:
            raise LookupError("User does not exist")

        row = connection.execute(
            "SELECT board_json FROM boards WHERE user_id = ?", (user["id"],)
        ).fetchone()
        if row is not None:
            return json.loads(row["board_json"])

        board = json.loads(DEFAULT_BOARD_FILE.read_text(encoding="utf-8"))
        connection.execute(
            "INSERT INTO boards (user_id, board_json) VALUES (?, ?)",
            (user["id"], json.dumps(board)),
        )
        connection.commit()
        return board


def save_board(db_path: Path, username: str, board: dict[str, Any]) -> None:
    with closing(sqlite3.connect(db_path)) as connection:
        user = connection.execute(
            "SELECT id FROM users WHERE username = ?", (username,)
        ).fetchone()
        if user is None:
            raise LookupError("User does not exist")
        connection.execute(
            """
            INSERT INTO boards (user_id, board_json)
            VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                board_json = excluded.board_json,
                updated_at = CURRENT_TIMESTAMP
            """,
            (user[0], json.dumps(board)),
        )
        connection.commit()