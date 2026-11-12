# Prints the API's OpenAPI description, so the frontend can generate its types
# from the code without a running server or database.
import json

from app.main import app

print(json.dumps(app.openapi(), indent=2))
