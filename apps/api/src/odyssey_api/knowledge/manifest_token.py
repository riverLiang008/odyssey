from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID


@dataclass(frozen=True, slots=True)
class ManifestValidationTokenClaims:
    workspace_id: UUID
    knowledge_space_id: UUID
    expected_revision: int
    manifest_checksum: str
    expires_at: datetime


class ManifestValidationTokenError(ValueError):
    pass


def create_manifest_validation_token(
    claims: ManifestValidationTokenClaims,
    secret: str,
) -> str:
    payload = json.dumps(
        {
            "workspaceId": str(claims.workspace_id),
            "knowledgeSpaceId": str(claims.knowledge_space_id),
            "expectedRevision": claims.expected_revision,
            "manifestChecksum": claims.manifest_checksum,
            "expiresAt": int(claims.expires_at.timestamp()),
        },
        separators=(",", ":"),
        sort_keys=True,
    ).encode()
    encoded_payload = base64.urlsafe_b64encode(payload).rstrip(b"=")
    signature = hmac.new(secret.encode(), encoded_payload, hashlib.sha256).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).rstrip(b"=")
    return f"{encoded_payload.decode()}.{encoded_signature.decode()}"


def verify_manifest_validation_token(
    token: str,
    secret: str,
) -> ManifestValidationTokenClaims:
    try:
        encoded_payload, encoded_signature = token.split(".", maxsplit=1)
        expected_signature = hmac.new(
            secret.encode(), encoded_payload.encode(), hashlib.sha256
        ).digest()
        signature = base64.urlsafe_b64decode(
            encoded_signature + "=" * (-len(encoded_signature) % 4)
        )
        if not hmac.compare_digest(signature, expected_signature):
            raise ManifestValidationTokenError("MANIFEST_TOKEN_INVALID")
        payload_bytes = base64.urlsafe_b64decode(
            encoded_payload + "=" * (-len(encoded_payload) % 4)
        )
        payload = json.loads(payload_bytes)
        if set(payload) != {
            "workspaceId",
            "knowledgeSpaceId",
            "expectedRevision",
            "manifestChecksum",
            "expiresAt",
        }:
            raise ManifestValidationTokenError("MANIFEST_TOKEN_INVALID")
        expected_revision = payload["expectedRevision"]
        expires_at = payload["expiresAt"]
        manifest_checksum = payload["manifestChecksum"]
        if (
            not isinstance(expected_revision, int)
            or expected_revision < 1
            or not isinstance(expires_at, int)
            or not isinstance(manifest_checksum, str)
            or len(manifest_checksum) != 64
        ):
            raise ManifestValidationTokenError("MANIFEST_TOKEN_INVALID")
        return ManifestValidationTokenClaims(
            workspace_id=UUID(payload["workspaceId"]),
            knowledge_space_id=UUID(payload["knowledgeSpaceId"]),
            expected_revision=expected_revision,
            manifest_checksum=manifest_checksum,
            expires_at=datetime.fromtimestamp(expires_at, tz=UTC),
        )
    except ManifestValidationTokenError:
        raise
    except (ValueError, TypeError, KeyError, json.JSONDecodeError, binascii.Error) as error:
        raise ManifestValidationTokenError("MANIFEST_TOKEN_INVALID") from error
