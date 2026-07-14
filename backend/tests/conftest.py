"""
Shared pytest fixtures.

These tests run against a REAL Postgres database (not mocks/sqlite) — the
models use Postgres-specific types (UUID, JSONB), so a real Postgres
instance is what gives us confidence the actual SQL being generated works.

Simplification worth being upfront about: tests run against a persistent
'netdash_test' database that's truncated between tests (see the autouse
`clean_db` fixture below), rather than a fresh throwaway database per test
run. That's a reasonable trade-off for a project at this scale — full
per-run database provisioning would be the next step for a production CI
setup, but isn't necessary to prove the application logic works correctly.

Set TEST_DATABASE_URL to point at your test database before running:
    export TEST_DATABASE_URL=postgresql+asyncpg://netdash:netdash@localhost:5432/netdash_test
    pytest
"""

import asyncio
import os
import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

os.environ.setdefault(
    "DATABASE_URL",
    os.environ.get(
        "TEST_DATABASE_URL",
        "postgresql+asyncpg://netdash:netdash@localhost:5432/netdash_test",
    ),
)

from app.core.security import hash_password  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import User  # noqa: E402

TEST_DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_async_engine(TEST_DATABASE_URL)
TestSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)


async def _override_get_db():
    async with TestSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = _override_get_db


@pytest.fixture(scope="session")
def event_loop():
    """
    Session-scoped event loop, intentionally overriding pytest-asyncio's
    default (which is per-test). This IS deprecated by pytest-asyncio and
    prints a warning — but it's necessary here: the async engine/session
    factory above is created once at import time, and asyncpg connections
    are bound to the event loop they were created on. Switching to a fresh
    event loop per test (the new default) breaks those connections. This
    is a known, accepted trade-off for this test setup, not an oversight.
    """
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(autouse=True)
async def clean_db():
    """Truncate all tables before every test, so each test starts from a
    known-empty state regardless of what earlier tests left behind."""
    async with engine.begin() as conn:
        await conn.execute(
            __import__("sqlalchemy").text(
                "TRUNCATE TABLE audit_log, metrics, interfaces, devices, users RESTART IDENTITY CASCADE"
            )
        )
    yield


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def admin_user():
    async with TestSessionLocal() as session:
        user = User(
            id=uuid.uuid4(),
            username="test_admin",
            email="admin@example.com",
            password_hash=hash_password("adminpass123"),
            role="admin",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


@pytest_asyncio.fixture
async def viewer_user():
    async with TestSessionLocal() as session:
        user = User(
            id=uuid.uuid4(),
            username="test_viewer",
            email="viewer@example.com",
            password_hash=hash_password("viewerpass123"),
            role="viewer",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


@pytest_asyncio.fixture
async def admin_token(client, admin_user):
    response = await client.post(
        "/api/auth/login", json={"username": "test_admin", "password": "adminpass123"}
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest_asyncio.fixture
async def viewer_token(client, viewer_user):
    response = await client.post(
        "/api/auth/login", json={"username": "test_viewer", "password": "viewerpass123"}
    )
    assert response.status_code == 200
    return response.json()["access_token"]
