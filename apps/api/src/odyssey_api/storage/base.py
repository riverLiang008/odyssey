from dataclasses import dataclass
from datetime import timedelta
from typing import BinaryIO, Protocol


@dataclass(frozen=True, slots=True)
class StoredObject:
    bucket: str
    object_key: str
    size_bytes: int
    content_type: str


class ObjectStorage(Protocol):
    async def upload(
        self, object_key: str, content: BinaryIO, content_type: str
    ) -> StoredObject: ...

    async def delete(self, object_key: str) -> None: ...

    async def create_download_url(
        self, object_key: str, expires_in: timedelta = timedelta(minutes=15)
    ) -> str: ...
