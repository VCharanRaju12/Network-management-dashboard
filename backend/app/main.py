import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.services.poller import poller_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    poller_task = asyncio.create_task(poller_loop(settings.DEFAULT_POLL_INTERVAL_SECONDS))
    yield
    poller_task.cancel()


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
