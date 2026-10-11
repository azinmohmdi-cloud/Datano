from typing import Optional

from fastapi_pagination import Params

from app.infra.core.config import config


def extract_limit_skip_from_params(params: Optional[Params]) -> tuple[int, int]:
    limit = params.size if params else config.default_pagination_limit
    skip = (params.page if params else 1) * limit

    return (limit, skip)
