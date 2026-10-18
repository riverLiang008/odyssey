from io import BytesIO

import pytest
from botocore.exceptions import ClientError

from odyssey_api.storage.base import ObjectNotFoundError
from odyssey_api.storage.s3 import S3ObjectStorage


class FakeS3Client:
    def __init__(self) -> None:
        self.created_buckets: list[str] = []
        self.objects: dict[str, tuple[str, bytes]] = {}

    def head_bucket(self, *, Bucket: str) -> None:
        if Bucket not in self.created_buckets:
            raise ClientError({"Error": {"Code": "404"}}, "HeadBucket")

    def create_bucket(self, *, Bucket: str) -> None:
        self.created_buckets.append(Bucket)

    def generate_presigned_url(self, operation: str, **kwargs: object) -> str:
        assert operation == "put_object"
        assert kwargs["HttpMethod"] == "PUT"
        return "http://objects.test/upload"

    def head_object(self, *, Bucket: str, Key: str) -> dict[str, object]:
        del Bucket
        if Key not in self.objects:
            raise ClientError({"Error": {"Code": "NoSuchKey"}}, "HeadObject")
        content_type, content = self.objects[Key]
        return {"ContentLength": len(content), "ContentType": content_type}

    def get_object(self, *, Bucket: str, Key: str) -> dict[str, object]:
        del Bucket
        return {"Body": BytesIO(self.objects[Key][1])}


def _storage(client: FakeS3Client) -> S3ObjectStorage:
    storage = object.__new__(S3ObjectStorage)
    storage.bucket = "knowledge"
    storage._client = client  # type: ignore[assignment]
    return storage


async def test_s3_adapter_creates_bucket_presigns_and_inspects_checksum() -> None:
    client = FakeS3Client()
    storage = _storage(client)
    await storage.ensure_bucket()
    assert client.created_buckets == ["knowledge"]
    target = await storage.create_upload_url("documents/notes.md", "text/markdown")
    assert target.url == "http://objects.test/upload"
    assert target.required_headers == {"Content-Type": "text/markdown"}

    client.objects["documents/notes.md"] = ("text/markdown", b"hello knowledge")
    inspected = await storage.inspect("documents/notes.md")
    assert inspected.size_bytes == 15
    assert inspected.content_type == "text/markdown"
    assert (
        inspected.sha256.hex() == "d3a539b57b3fd80ae49c098386559e97238da89cd3b837c2c5a41218307332f6"
    )


async def test_s3_adapter_maps_missing_object_without_leaking_provider_error() -> None:
    with pytest.raises(ObjectNotFoundError):
        await _storage(FakeS3Client()).inspect("missing")
