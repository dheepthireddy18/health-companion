import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, SessionLocal, engine
from .routers import auth, clinician, messages, notifications, patient
from .seed import seed_demo_data


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    if os.getenv("SEED_DEMO", "1") == "1":
        with SessionLocal() as db:
            seed_demo_data(db)  # no-op once users exist
    yield


app = FastAPI(title="Health Companion API", version="2.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
                   allow_methods=["*"], allow_headers=["*"])

for r in (auth.router, patient.router, messages.router, notifications.router, clinician.router):
    app.include_router(r)


@app.get("/api/health")
def health():
    return {"status": "ok"}
