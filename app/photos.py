import uuid
from functools import cache
from io import BytesIO

import boto3
from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import settings

SIZE = 256
MAX_BYTES = 5 * 1024 * 1024


class NotAnImage(Exception):
    pass


def process(data: bytes) -> bytes:
    try:
        image = Image.open(BytesIO(data))
        image.load()
    except (UnidentifiedImageError, OSError):
        raise NotAnImage from None

    image = ImageOps.exif_transpose(image).convert("RGB")
    image = ImageOps.fit(image, (SIZE, SIZE))
    out = BytesIO()

    image.save(out, "WEBP", quality=85)
    return out.getvalue()


def new_key() -> str:
    return f"photos/{uuid.uuid4().hex}.webp"


def photo_url(key: str | None) -> str | None:
    if key is None:
        return None
    return f"https://{settings.photo_bucket}.s3.{settings.aws_region}.amazonaws.com/{key}"


class Storage:
    def __init__(self):
        self.client = boto3.client(
            "s3",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id or None,
            aws_secret_access_key=settings.aws_secret_access_key or None,
        )

    def put(self, key: str, data: bytes) -> None:
        self.client.put_object(
            Bucket=settings.photo_bucket,
            Key=key,
            Body=data,
            ContentType="image/webp",
            CacheControl="public, max-age=31536000, immutable",
        )

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=settings.photo_bucket, Key=key)


@cache
def get_storage() -> Storage | None:
    return Storage() if settings.photo_bucket else None
