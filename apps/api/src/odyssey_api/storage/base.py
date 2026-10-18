from dataclasses import dataclass
from datetime import timedelta
from typing import BinaryIO, Protocol


@dataclass(frozen=True, slots=True)
class StoredObject:
    bucket: str
    object_key: str
    size_bytes: int
    content_type: str


@dataclass(frozen=True, slots=True)
class PresignedUpload:
    url: str
    method: str
    required_headers: dict[str, str]


@dataclass(frozen=True, slots=True)
class InspectedObject:
    size_bytes: int
    content_type: str
    sha256: bytes


class ObjectNotFoundError(Exception):
    pass


class ObjectStorage(Protocol):
    provider: str
    bucket: str

    async def ensure_bucket(self) -> None: ...

    async def create_upload_url(
        self,
        object_key: str,
        content_type: str,
        expires_in: timedelta = timedelta(minutes=15),
    ) -> PresignedUpload: ...

    async def inspect(self, object_key: str) -> InspectedObject: ...

    async def upload(
        self, object_key: str, content: BinaryIO, content_type: str
    ) -> StoredObject: ...

    async def delete(self, object_key: str) -> None: ...

    async def create_download_url(
        self, object_key: str, expires_in: timedelta = timedelta(minutes=15)
    ) -> str: ...
