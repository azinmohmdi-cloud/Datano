from io import StringIO
from pathlib import Path

from alembic import command
from alembic.config import Config as AlembicConfig
from sqlalchemy.engine import make_url

from app.infra.database.base import Base


def test_offline_upgrade_renders_revision_without_a_database_connection() -> None:
    output = StringIO()
    config = AlembicConfig(
        str(Path(__file__).resolve().parents[2] / "alembic.ini"), output_buffer=output
    )
    config.attributes["database_url"] = make_url(
        "postgresql+psycopg://datano:offline-only@127.0.0.1:1/datano"
    )
    command.upgrade(config, "head", sql=True)
    assert "0001_database_baseline" in output.getvalue()
    assert "CREATE TABLE alembic_version" in output.getvalue()
    assert "offline-only" not in output.getvalue()
    assert not Base.metadata.tables
