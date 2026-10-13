"""Static reference and demo data, kept as JSON files next to this module rather than in code."""
import json
from functools import lru_cache
from pathlib import Path

DIR = Path(__file__).parent


@lru_cache(maxsize=None)
def load(name: str):
    """Parsed contents of data/<name>.json (cached; treat as read-only)."""
    with open(DIR / f"{name}.json", encoding="utf-8") as f:
        return json.load(f)
