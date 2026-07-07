"""
Run once after the DB is up to create the first admin account:

    docker compose exec backend python -m app.seed
"""

import asyncio

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.user import User

DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_EMAIL = "admin@example.com"
DEFAULT_ADMIN_PASSWORD = "ChangeMe123!"  # change immediately after first login


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(User).where(User.username == DEFAULT_ADMIN_USERNAME))
        if existing.scalar_one_or_none():
            print("Admin user already exists, skipping.")
            return

        admin = User(
            username=DEFAULT_ADMIN_USERNAME,
            email=DEFAULT_ADMIN_EMAIL,
            password_hash=hash_password(DEFAULT_ADMIN_PASSWORD),
            role="admin",
        )
        db.add(admin)
        await db.commit()
        print(f"Created admin user '{DEFAULT_ADMIN_USERNAME}' with password '{DEFAULT_ADMIN_PASSWORD}'")
        print("Log in and change this password immediately.")


if __name__ == "__main__":
    asyncio.run(seed())
