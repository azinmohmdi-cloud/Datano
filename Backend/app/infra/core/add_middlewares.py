from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def add_middlewares(app: FastAPI):
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",  # React dev server
            "http://localhost:5173",  # Vite dev server
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
            # Add your production domain later
        ],
        allow_credentials=True,  # Required for cookies/auth
        allow_methods=["*"],  # Or specify: ["GET", "POST", "PUT", "DELETE"]
        allow_headers=["*"],  # Or specify headers you need
        expose_headers=["*"],  # Expose custom headers to browser
        max_age=600,  # Cache preflight requests for 10 minutes
    )
