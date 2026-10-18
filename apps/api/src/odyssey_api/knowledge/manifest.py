from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Annotated, Literal, Protocol
from uuid import UUID, uuid5

from pydantic import Field, field_validator

from odyssey_api.knowledge.dto import ApiModel

ManifestKey = Annotated[
    str,
    Field(min_length=1, max_length=128, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$"),
]


def knowledge_graph_manifest_checksum(manifest: KnowledgeGraphManifest) -> str:
    canonical = manifest.model_dump(by_alias=True, mode="json")
    payload = json.dumps(
        canonical,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def canonicalize_manifest_path(value: str) -> str:
    normalized = value.strip().replace("\\", "/")
    if not normalized or normalized.startswith("/") or re.match(r"^[A-Za-z]:", normalized):
        raise ValueError("INVALID_DOCUMENT_PATH")
    segments = normalized.split("/")
    if any(segment in {"", ".", ".."} for segment in segments):
        raise ValueError("INVALID_DOCUMENT_PATH")
    return "/".join(segments)


class KnowledgeGraphManifestTag(ApiModel):
    key: ManifestKey
    name: Annotated[str, Field(min_length=1, max_length=255)]
    color_token: Annotated[str, Field(min_length=1, max_length=64)] | None = None


class KnowledgeGraphManifestDocument(ApiModel):
    key: ManifestKey
    path: Annotated[str, Field(min_length=1, max_length=1024)]
    summary: Annotated[str, Field(max_length=10_000)] | None = None
    guide: Annotated[str, Field(max_length=10_000)] | None = None
    tags: Annotated[list[ManifestKey], Field(max_length=100)] = Field(default_factory=list)
    status: Literal["indexed", "needs_review"] = "indexed"

    @field_validator("path", mode="before")
    @classmethod
    def normalize_path(cls, value: object) -> object:
        return canonicalize_manifest_path(value) if isinstance(value, str) else value


class KnowledgeGraphManifestRelation(ApiModel):
    key: ManifestKey
    source: ManifestKey
    target: ManifestKey
    kind: Literal[
        "references",
        "builds_on",
        "explains",
        "supports",
        "contradicts",
        "supersedes",
        "related_to",
    ]
    status: Literal["active", "needs_review"] = "active"
    confidence: Annotated[float, Field(ge=0, le=1)] | None = None
    description: Annotated[str, Field(max_length=4000)] | None = None


class KnowledgeGraphManifestIssue(ApiModel):
    key: ManifestKey
    kind: Literal[
        "unlinked_document",
        "broken_reference",
        "possible_duplicate",
        "possible_conflict",
        "missing_metadata",
        "stale_document",
        "family_assignment_review",
    ]
    severity: Literal["info", "warning", "error"]
    resolution_status: Literal["open", "accepted", "resolved", "dismissed"] = "open"
    title: Annotated[str, Field(min_length=1, max_length=255)]
    message: Annotated[str, Field(max_length=10_000)] | None = None
    resource_keys: Annotated[list[ManifestKey], Field(max_length=100)] = Field(default_factory=list)
    relation_keys: Annotated[list[ManifestKey], Field(max_length=100)] = Field(default_factory=list)


class KnowledgeGraphManifestGraph(ApiModel):
    status: Literal["healthy", "needs_review"]


class KnowledgeGraphManifest(ApiModel):
    schema_version: Literal[1]
    key: ManifestKey
    documents: Annotated[list[KnowledgeGraphManifestDocument], Field(min_length=1, max_length=500)]
    tags: Annotated[list[KnowledgeGraphManifestTag], Field(max_length=200)] = Field(
        default_factory=list
    )
    relations: Annotated[list[KnowledgeGraphManifestRelation], Field(max_length=2000)] = Field(
        default_factory=list
    )
    issues: Annotated[list[KnowledgeGraphManifestIssue], Field(max_length=1000)] = Field(
        default_factory=list
    )
    graph: KnowledgeGraphManifestGraph


@dataclass(frozen=True, slots=True)
class ManifestValidationIssue:
    path: tuple[str | int, ...]
    code: str


@dataclass(frozen=True, slots=True)
class ManifestDocumentMatch:
    document_key: str
    resource_id: UUID
    canonical_path: str


@dataclass(frozen=True, slots=True)
class ManifestValidationCandidate:
    matches: tuple[ManifestDocumentMatch, ...]
    issues: tuple[ManifestValidationIssue, ...]


@dataclass(frozen=True, slots=True)
class ProducedDocumentAnnotation:
    resource_id: UUID
    source_key: str
    summary: str | None
    guide: str | None
    status: str


@dataclass(frozen=True, slots=True)
class ProducedTag:
    id: UUID
    source_key: str
    name: str
    normalized_name: str
    color_token: str | None


@dataclass(frozen=True, slots=True)
class ProducedResourceTag:
    resource_id: UUID
    tag_id: UUID
    source_key: str


@dataclass(frozen=True, slots=True)
class ProducedRelation:
    id: UUID
    source_key: str
    source_resource_id: UUID
    target_resource_id: UUID
    kind: str
    status: str
    confidence: float | None
    description: str | None


@dataclass(frozen=True, slots=True)
class ProducedIssue:
    id: UUID
    source_key: str
    kind: str
    severity: str
    resolution_status: str
    title: str
    message: str | None
    resource_ids: tuple[UUID, ...]
    relation_ids: tuple[UUID, ...]


@dataclass(frozen=True, slots=True)
class ManifestGraphProjection:
    manifest_key: str
    graph_status: str
    documents: tuple[ProducedDocumentAnnotation, ...]
    tags: tuple[ProducedTag, ...]
    resource_tags: tuple[ProducedResourceTag, ...]
    relations: tuple[ProducedRelation, ...]
    issues: tuple[ProducedIssue, ...]


class _ManifestKeyed(Protocol):
    key: str


ManifestValidationCode = Literal[
    "MANIFEST_INVALID",
    "DUPLICATE_KEY",
    "INVALID_DOCUMENT_PATH",
    "DUPLICATE_DOCUMENT_PATH",
    "DOCUMENT_FILE_NOT_FOUND",
    "DOCUMENT_PATH_AMBIGUOUS",
    "DOCUMENT_NOT_FOUND",
    "TAG_NOT_FOUND",
    "DUPLICATE_TAG_NAME",
    "RELATION_NOT_FOUND",
    "SELF_RELATION",
    "GRAPH_STATUS_INCONSISTENT",
]


class ManifestValidationIssueDto(ApiModel):
    path: list[str | Annotated[int, Field(ge=0)]]
    code: ManifestValidationCode
    message: Annotated[str, Field(max_length=1000)] | None = None


class ValidateKnowledgeGraphManifestRequest(ApiModel):
    expected_revision: Annotated[int, Field(ge=1)]
    manifest: KnowledgeGraphManifest


class ValidateKnowledgeGraphManifestResult(ApiModel):
    validation_token: Annotated[str, Field(min_length=1)] | None
    manifest_checksum: Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
    knowledge_space_revision: Annotated[int, Field(ge=1)]
    status: Literal["valid", "invalid"]
    matched_document_count: Annotated[int, Field(ge=0)]
    unmatched_document_count: Annotated[int, Field(ge=0)]
    summary_update_count: Annotated[int, Field(ge=0)]
    guide_update_count: Annotated[int, Field(ge=0)]
    tag_count: Annotated[int, Field(ge=0)]
    relation_count: Annotated[int, Field(ge=0)]
    issue_count: Annotated[int, Field(ge=0)]
    resulting_graph_status: Literal["healthy", "needs_review"] | None
    issues: list[ManifestValidationIssueDto]


class ApplyKnowledgeGraphManifestRequest(ApiModel):
    expected_revision: Annotated[int, Field(ge=1)]
    validation_token: Annotated[str, Field(min_length=1)]
    manifest_checksum: Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
    manifest: KnowledgeGraphManifest


class ApplyKnowledgeGraphManifestResult(ApiModel):
    status: Literal["applied", "already_up_to_date"]
    manifest_checksum: Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
    knowledge_space_revision: Annotated[int, Field(ge=1)]


def validate_manifest_references(
    manifest: KnowledgeGraphManifest,
) -> tuple[ManifestValidationIssue, ...]:
    issues: list[ManifestValidationIssue] = []

    def duplicates(values: Sequence[_ManifestKeyed], collection: str) -> None:
        seen: set[str] = set()
        for index, value in enumerate(values):
            key = value.key
            if key in seen:
                issues.append(ManifestValidationIssue((collection, index, "key"), "DUPLICATE_KEY"))
            seen.add(key)

    duplicates(manifest.documents, "documents")
    duplicates(manifest.tags, "tags")
    duplicates(manifest.relations, "relations")
    duplicates(manifest.issues, "issues")

    document_keys = {document.key for document in manifest.documents}
    tag_keys = {tag.key for tag in manifest.tags}
    relation_keys = {relation.key for relation in manifest.relations}
    document_paths: set[str] = set()
    for document_index, document in enumerate(manifest.documents):
        if document.path in document_paths:
            issues.append(
                ManifestValidationIssue(
                    ("documents", document_index, "path"), "DUPLICATE_DOCUMENT_PATH"
                )
            )
        document_paths.add(document.path)
        for tag_index, tag_key in enumerate(document.tags):
            if tag_key not in tag_keys:
                issues.append(
                    ManifestValidationIssue(
                        ("documents", document_index, "tags", tag_index), "TAG_NOT_FOUND"
                    )
                )

    for relation_index, relation in enumerate(manifest.relations):
        if relation.source not in document_keys:
            issues.append(
                ManifestValidationIssue(
                    ("relations", relation_index, "source"), "DOCUMENT_NOT_FOUND"
                )
            )
        if relation.target not in document_keys:
            issues.append(
                ManifestValidationIssue(
                    ("relations", relation_index, "target"), "DOCUMENT_NOT_FOUND"
                )
            )
        if relation.source == relation.target:
            issues.append(
                ManifestValidationIssue(("relations", relation_index, "target"), "SELF_RELATION")
            )

    for issue_index, issue in enumerate(manifest.issues):
        for resource_index, resource_key in enumerate(issue.resource_keys):
            if resource_key not in document_keys:
                issues.append(
                    ManifestValidationIssue(
                        ("issues", issue_index, "resourceKeys", resource_index),
                        "DOCUMENT_NOT_FOUND",
                    )
                )
        for relation_index, relation_key in enumerate(issue.relation_keys):
            if relation_key not in relation_keys:
                issues.append(
                    ManifestValidationIssue(
                        ("issues", issue_index, "relationKeys", relation_index),
                        "RELATION_NOT_FOUND",
                    )
                )

    has_open_warning = any(
        issue.resolution_status == "open" and issue.severity in {"warning", "error"}
        for issue in manifest.issues
    )
    has_review_relation = any(relation.status == "needs_review" for relation in manifest.relations)
    if manifest.graph.status == "healthy" and (has_open_warning or has_review_relation):
        issues.append(ManifestValidationIssue(("graph", "status"), "GRAPH_STATUS_INCONSISTENT"))
    if manifest.graph.status == "needs_review" and not has_open_warning and not has_review_relation:
        issues.append(ManifestValidationIssue(("graph", "status"), "GRAPH_STATUS_INCONSISTENT"))

    return tuple(issues)


def match_manifest_documents(
    manifest: KnowledgeGraphManifest,
    resource_ids_by_path: dict[str, tuple[UUID, ...]],
) -> ManifestValidationCandidate:
    issues = list(validate_manifest_references(manifest))
    matches: list[ManifestDocumentMatch] = []
    for document_index, document in enumerate(manifest.documents):
        resource_ids = resource_ids_by_path.get(document.path, ())
        if not resource_ids:
            issues.append(
                ManifestValidationIssue(
                    ("documents", document_index, "path"),
                    "DOCUMENT_FILE_NOT_FOUND",
                )
            )
            continue
        if len(resource_ids) > 1:
            issues.append(
                ManifestValidationIssue(
                    ("documents", document_index, "path"),
                    "DOCUMENT_PATH_AMBIGUOUS",
                )
            )
            continue
        matches.append(
            ManifestDocumentMatch(
                document_key=document.key,
                resource_id=resource_ids[0],
                canonical_path=document.path,
            )
        )
    return ManifestValidationCandidate(matches=tuple(matches), issues=tuple(issues))


def produce_manifest_graph(
    knowledge_space_id: UUID,
    manifest: KnowledgeGraphManifest,
    candidate: ManifestValidationCandidate,
    existing_tag_ids_by_key: dict[str, UUID],
    normalized_tag_names_by_key: dict[str, str],
) -> ManifestGraphProjection:
    if candidate.issues:
        raise ValueError("MANIFEST_CANDIDATE_INVALID")
    resource_ids = {match.document_key: match.resource_id for match in candidate.matches}
    tag_ids = {
        tag.key: existing_tag_ids_by_key.get(
            tag.key,
            uuid5(knowledge_space_id, f"manifest:{manifest.key}:tag:{tag.key}"),
        )
        for tag in manifest.tags
    }
    relation_ids = {
        relation.key: uuid5(
            knowledge_space_id,
            f"manifest:{manifest.key}:relation:{relation.key}",
        )
        for relation in manifest.relations
    }
    return ManifestGraphProjection(
        manifest_key=manifest.key,
        graph_status=manifest.graph.status,
        documents=tuple(
            ProducedDocumentAnnotation(
                resource_id=resource_ids[document.key],
                source_key=document.key,
                summary=document.summary,
                guide=document.guide,
                status=document.status,
            )
            for document in manifest.documents
        ),
        tags=tuple(
            ProducedTag(
                id=tag_ids[tag.key],
                source_key=tag.key,
                name=tag.name,
                normalized_name=normalized_tag_names_by_key[tag.key],
                color_token=tag.color_token,
            )
            for tag in manifest.tags
        ),
        resource_tags=tuple(
            ProducedResourceTag(
                resource_id=resource_ids[document.key],
                tag_id=tag_ids[tag_key],
                source_key=f"{document.key}:{tag_key}",
            )
            for document in manifest.documents
            for tag_key in document.tags
        ),
        relations=tuple(
            ProducedRelation(
                id=relation_ids[relation.key],
                source_key=relation.key,
                source_resource_id=resource_ids[relation.source],
                target_resource_id=resource_ids[relation.target],
                kind=relation.kind,
                status=relation.status,
                confidence=relation.confidence,
                description=relation.description,
            )
            for relation in manifest.relations
        ),
        issues=tuple(
            ProducedIssue(
                id=uuid5(
                    knowledge_space_id,
                    f"manifest:{manifest.key}:issue:{issue.key}",
                ),
                source_key=issue.key,
                kind=issue.kind,
                severity=issue.severity,
                resolution_status=issue.resolution_status,
                title=issue.title,
                message=issue.message,
                resource_ids=tuple(resource_ids[key] for key in issue.resource_keys),
                relation_ids=tuple(relation_ids[key] for key in issue.relation_keys),
            )
            for issue in manifest.issues
        ),
    )
