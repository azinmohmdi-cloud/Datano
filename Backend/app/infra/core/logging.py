import logging
import sys

from fastapi import FastAPI, Request
from loguru import logger

# Disable Uvicorn access logs
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
logging.getLogger("uvicorn.access").propagate = False

# Configure Loguru
logger.remove()


# Main handler with dynamic format
def formatter(record):
    # Use fixed "logger" if marked, otherwise show full location
    if record["extra"].get("simple_name"):
        name_part = "<cyan>logger</cyan>"
    else:
        name_part = (
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan>".format(
                name=record["name"], function=record["function"], line=record["line"]
            )
        )
    return (
        "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
        "<level>{level: <8}</level> | "
        "{name_part} | "
        "<level>{message}</level>\n"
    ).format(
        time=record["time"],
        level=record["level"].name,
        name_part=name_part,
        message=record["message"],
    )


logger.add(
    sys.stderr,
    format=formatter,
    level="DEBUG",
    colorize=True,
)

logger.add(
    "logs/app_{time}.log",
    rotation="500 MB",
    retention="30 days",
    compression="zip",
    serialize=True,
)


def register_logger(app: FastAPI):
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        # Patch logs to use simple name
        logger.bind(simple_name=True).info(
            f"<- Req | {request.method} {request.url.path}"
        )

        response = await call_next(request)

        if response.status_code <= 299:
            logger.bind(simple_name=True).success(
                f"-> Res | {request.method} {request.url.path} : status {response.status_code}\n"
            )
        if 300 <= response.status_code <= 399:
            logger.bind(simple_name=True).warning(
                f"-> Res | {request.method} {request.url.path} : status {response.status_code}\n"
            )
        if response.status_code >= 400:
            logger.bind(simple_name=True).error(
                f"-> Res | {request.method} {request.url.path} : status {response.status_code}\n"
            )

        return response
