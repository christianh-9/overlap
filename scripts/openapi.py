import json
import os

os.environ.setdefault("DEV_MODE", "true")

from app.main import app

print(json.dumps(app.openapi(), indent=2))
