import asyncio
import hashlib
from datetime import timedelta
from typing import BinaryIO

import boto3
from botocore.client import BaseClient
from botocore.config import Config
from botocore.exceptions import ClientError

from odyssey_api.storage.base import (
    InspectedObject,
    ObjectNotFoundError,
    PresignedUpload,
    StoredObject,
)


class S3ObjectStorage:
    provider = "minio"

    def __init__(
        self,
        *,
        endpoint_url: str,
        access_key: str,
        secret_key: str,
        bucket: str,
    ) -> None:
        self.bucket = bucket
        self._client: BaseClient = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
            region_name="us-east-1",
        )

    async def ensure_bucket(self) -> None:
        await asyncio.to_thread(self._ensure_bucket_sync)

    def _ensure_bucket_sync(self) -> None:
        try:
            self._client.head_bucket(Bucket=self.bucket)
        except ClientError as error:
            code = error.response.get("Error", {}).get("Code")
            if code not in {"404", "NoSuchBucket", "NotFound"}:
                raise
            self._client.create_bucket(Bucket=self.bucket)

    async def create_upload_url(
        self,
        object_key: str,
        content_type: str,
        expires_in: timedelta = timedelta(minutes=15),
    ) -> PresignedUpload:
        url = await asyncio.to_thread(
            self._client.generate_presigned_url,
            "put_object",
            Params={
                "Bucket": self.bucket,
                "Key": object_key,
                "ContentType": content_type,
            },
            ExpiresIn=max(1, int(expires_in.total_seconds())),
            HttpMethod="PUT",
        )
        return PresignedUpload(
            url=url,
            method="PUT",
            required_headers={"Content-Type": content_type},
        )

    async def inspect(self, object_key: str) -> InspectedObject:
        return await asyncio.to_thread(self._inspect_sync, object_key)

    def _inspect_sync(self, object_key: str) -> InspectedObject:
        try:
            head = self._client.head_object(Bucket=self.bucket, Key=object_key)
        except ClientError as error:
            code = error.response.get("Error", {}).get("Code")
            if code in {"404", "NoSuchKey", "NotFound"}:
                raise ObjectNotFoundError(object_key) from error
            raise
        response = self._client.get_object(Bucket=self.bucket, Key=object_key)
        body = response["Body"]
        digest = hashlib.sha256()
        try:
            while chunk := body.read(1024 * 1024):
                digest.update(chunk)
        finally:
            body.close()
        return InspectedObject(
            size_bytes=int(head["ContentLength"]),
            content_type=str(head.get("ContentType") or "application/octet-stream"),
            sha256=digest.digest(),
        )

    async def upload(self, object_key: str, content: BinaryIO, content_type: str) -> StoredObject:
        await asyncio.to_thread(
            self._client.upload_fileobj,
            content,
            self.bucket,
            object_key,
            ExtraArgs={"ContentType": content_type},
        )
        inspected = await self.inspect(object_key)
        return StoredObject(
            bucket=self.bucket,
            object_key=object_key,
            size_bytes=inspected.size_bytes,
            content_type=inspected.content_type,
        )

    async def delete(self, object_key: str) -> None:
        await asyncio.to_thread(
            self._client.delete_object,
            Bucket=self.bucket,
            Key=object_key,
        )

    async def create_download_url(
        self, object_key: str, expires_in: timedelta = timedelta(minutes=15)
    ) -> str:
        return await asyncio.to_thread(
            self._client.generate_presigned_url,
            "get_object",
            Params={"Bucket": self.bucket, "Key": object_key},
            ExpiresIn=max(1, int(expires_in.total_seconds())),
            HttpMethod="GET",
        )
