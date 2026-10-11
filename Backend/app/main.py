from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi_pagination import add_pagination

from app.domain.error.exception_handlers import register_all_exception_handlers
from app.infra.core.add_middlewares import add_middlewares
from app.infra.core.logging import register_logger
from app.infra.core.seed import seed as seed_data
from app.interface.controller import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await seed_data()
    yield


app = FastAPI(title="FastAPI Server", version="1.0.0", lifespan=lifespan)

register_logger(app)

# Add middlewares
add_middlewares(app)

# Register all exception handlers (both domain and generic)
register_all_exception_handlers(app)

add_pagination(app)

# Include the routers
app.include_router(api_router)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8004)
