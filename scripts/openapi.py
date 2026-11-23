import json
import os

from app.main import app

os.environ.setdefault("DEV_MODE", "true")

print(json.dumps(app.openapi(), indent=2))
