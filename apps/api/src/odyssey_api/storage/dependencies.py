from functools import lru_cache

from odyssey_api.settings import get_settings
from odyssey_api.storage.base import ObjectStorage
from odyssey_api.storage.s3 import S3ObjectStorage


@lru_cache
def get_object_storage() -> ObjectStorage:
    settings = get_settings()
    return S3ObjectStorage(
        endpoint_url=settings.s3_endpoint_url,
        access_key=settings.s3_access_key,
        secret_key=settings.s3_secret_key,
        bucket=settings.s3_bucket,
    )
