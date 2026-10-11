"""
Seed script for in-memory repositories.

Usage:
    python scripts/seed_in_memory.py
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath("."))

from app.infra.core.seed import seed as seed_data


async def main():
    print("Starting in-memory seeding...")
    await seed_data()
    print("In-memory seeding completed successfully!")


if __name__ == "__main__":
    asyncio.run(main())
