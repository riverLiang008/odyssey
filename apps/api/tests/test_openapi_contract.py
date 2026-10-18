from fastapi.testclient import TestClient

from odyssey_api.main import create_app
from odyssey_api.settings import Settings


def test_openapi_documents_all_existing_operations(monkeypatch) -> None:
    monkeypatch.setattr(
        "odyssey_api.main.get_settings",
        lambda: Settings(environment="development"),
    )
    app = create_app()

    response = TestClient(app).get("/openapi.json")

    assert response.status_code == 200
    schema = response.json()
    assert schema["info"]["title"] == "Odyssey API"
    assert schema["info"]["summary"] == "Workspace-scoped Journey configuration API"
    assert [tag["name"] for tag in schema["tags"]] == [
        "tool-definitions",
        "system",
        "journeys",
        "agent-templates",
        "knowledge-spaces",
        "knowledge-space-categories",
    ]

    expected_operations = {
        ("/api/v1/tool-definitions", "get"): "listToolDefinitions",
        ("/api/v1/health", "get"): "getHealth",
        ("/api/v1/journeys", "post"): "createJourney",
        ("/api/v1/journeys", "get"): "listJourneys",
        ("/api/v1/journeys/{journey_id}", "get"): "loadJourney",
        ("/api/v1/journeys/{journey_id}", "put"): "saveJourneyPattern",
        ("/api/v1/journeys/{journey_id}", "delete"): "deleteJourney",
        (
            "/api/v1/journeys/{journey_id}/agents/{agent_id}",
            "get",
        ): "loadAgentWorkflow",
        (
            "/api/v1/journeys/{journey_id}/agents/{agent_id}",
            "put",
        ): "saveAgentWorkflow",
        (
            "/api/v1/journeys/{journey_id}/agents/{agent_id}/commands/save-as-template",
            "post",
        ): "saveAgentAsTemplate",
        (
            "/api/v1/journeys/{journey_id}/slots/{slot_id}/agent",
            "post",
        ): "createMinimumAgent",
        (
            "/api/v1/journeys/{journey_id}/slots/{slot_id}/agent-template/{template_id}",
            "post",
        ): "instantiateAgentTemplate",
        (
            "/api/v1/journeys/{journey_id}/slots/{slot_id}/commands/remove",
            "post",
        ): "removeOccupiedSlot",
        (
            "/api/v1/journeys/{journey_id}/guardrails/{side}/commands/add",
            "post",
        ): "addGuardrail",
        (
            "/api/v1/journeys/{journey_id}/guardrails/{side}/commands/remove",
            "post",
        ): "removeGuardrail",
        ("/api/v1/agent-templates", "get"): "listAgentTemplates",
        ("/api/v1/agent-templates/{template_id}", "get"): "loadAgentTemplate",
        ("/api/v1/knowledge-spaces", "get"): "listKnowledgeSpaces",
        ("/api/v1/knowledge-spaces", "post"): "createKnowledgeSpace",
        (
            "/api/v1/knowledge-spaces/{knowledge_space_id}",
            "get",
        ): "loadKnowledgeSpace",
        (
            "/api/v1/knowledge-spaces/{knowledge_space_id}",
            "put",
        ): "updateKnowledgeSpace",
        (
            "/api/v1/knowledge-spaces/{knowledge_space_id}",
            "delete",
        ): "deleteKnowledgeSpace",
        (
            "/api/v1/knowledge-spaces/{knowledge_space_id}/commands/archive",
            "post",
        ): "archiveKnowledgeSpace",
        (
            "/api/v1/knowledge-spaces/{knowledge_space_id}/commands/unarchive",
            "post",
        ): "unarchiveKnowledgeSpace",
        (
            "/api/v1/knowledge-space-categories",
            "get",
        ): "listKnowledgeSpaceCategories",
        (
            "/api/v1/knowledge-space-categories",
            "post",
        ): "createKnowledgeSpaceCategory",
        (
            "/api/v1/knowledge-spaces/{knowledge_space_id}/file-tree",
            "get",
        ): "loadKnowledgeFileTree",
        (
            "/api/v1/knowledge-spaces/{knowledge_space_id}/graph",
            "get",
        ): "loadKnowledgeGraph",
        (
            "/api/v1/knowledge-spaces/{knowledge_space_id}/graph-manifest/validate",
            "post",
        ): "validateKnowledgeGraphManifest",
        (
            "/api/v1/knowledge-spaces/{knowledge_space_id}/graph-manifest/apply",
            "post",
        ): "applyKnowledgeGraphManifest",
        (
            "/api/v1/knowledge-spaces/{knowledge_space_id}/folders",
            "post",
        ): "createKnowledgeFolder",
        (
            "/api/v1/knowledge-spaces/{knowledge_space_id}/uploads/prepare",
            "post",
        ): "prepareKnowledgeUpload",
        (
            "/api/v1/knowledge-spaces/{knowledge_space_id}/uploads/complete",
            "post",
        ): "completeKnowledgeUpload",
        (
            "/api/v1/knowledge-spaces/{knowledge_space_id}/resources/{resource_id}/commands/move",
            "post",
        ): "moveKnowledgeResource",
        (
            "/api/v1/knowledge-spaces/{knowledge_space_id}/resources/{resource_id}",
            "get",
        ): "loadKnowledgeResource",
        (
            "/api/v1/knowledge-spaces/{knowledge_space_id}/resources/{resource_id}",
            "delete",
        ): "deleteKnowledgeResource",
        (
            "/api/v1/knowledge-spaces/{knowledge_space_id}/resources/{resource_id}/content",
            "put",
        ): "updateKnowledgeResourceContent",
    }
    actual_operations = {
        (path, method): operation["operationId"]
        for path, path_item in schema["paths"].items()
        for method, operation in path_item.items()
    }
    assert actual_operations == expected_operations


def test_openapi_uses_canonical_error_envelope() -> None:
    schema = create_app().openapi()
    save_responses = schema["paths"]["/api/v1/journeys/{journey_id}"]["put"]["responses"]

    assert set(save_responses) == {"200", "404", "409", "422", "503"}
    for status_code in ("404", "409", "422", "503"):
        response_schema = save_responses[status_code]["content"]["application/json"]["schema"]
        assert response_schema == {"$ref": "#/components/schemas/ErrorResponse"}


def test_production_disables_swagger_and_openapi(monkeypatch) -> None:
    monkeypatch.setattr(
        "odyssey_api.main.get_settings",
        lambda: Settings(environment="production"),
    )
    client = TestClient(create_app())

    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404


def test_openapi_never_exposes_settings_or_secrets() -> None:
    schema = create_app().openapi()
    serialized = str(schema).lower()
    assert "settings" not in schema["components"]["schemas"]
    assert "database_url" not in serialized
    assert "s3_secret_key" not in serialized
    assert "s3_access_key" not in serialized
    for path_item in schema["paths"].values():
        for operation in path_item.values():
            request_body = operation.get("requestBody")
            if request_body is None:
                continue
            body_schema = request_body["content"]["application/json"]["schema"]
            assert body_schema.get("$ref") != "#/components/schemas/Settings"


def test_openapi_exposes_strict_guardrail_projection_and_commands() -> None:
    schema = create_app().openapi()
    document = schema["components"]["schemas"]["JourneyEditorDocument"]
    assert {"inputGuardrail", "outputGuardrail"} <= set(document["required"])
    add = schema["paths"]["/api/v1/journeys/{journey_id}/guardrails/{side}/commands/add"]["post"]
    remove = schema["paths"]["/api/v1/journeys/{journey_id}/guardrails/{side}/commands/remove"][
        "post"
    ]
    assert add["responses"]["201"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/AddGuardrailResponse"
    }
    assert remove["responses"]["200"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/JourneyEditorDocument"
    }


def test_openapi_script_execution_inputs_is_optional_non_nullable_array() -> None:
    schema = create_app().openapi()["components"]["schemas"]["ScriptExecutionConfiguration"]
    assert "inputs" not in schema["required"]
    assert schema["properties"]["inputs"] == {
        "items": {"$ref": "#/components/schemas/ScriptInput"},
        "type": "array",
        "title": "Inputs",
    }
