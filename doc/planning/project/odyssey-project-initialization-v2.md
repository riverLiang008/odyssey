# Odyssey v1 Project Initialization

## Goal

Initialize the Odyssey repository as a production-quality foundation.

The initial milestone is **NOT** to build the execution engine.

The goal is to build a usable product skeleton that demonstrates the
Odyssey design through a real application.

The repository should already support:

-   Vue 3 + TypeScript frontend
-   FastAPI backend
-   PostgreSQL
-   Docker Compose
-   Static landing page
-   User documentation
-   CI-ready structure

------------------------------------------------------------------------

# Tech Stack

## Frontend

-   Vue 3
-   TypeScript
-   Vite
-   Vue Router
-   Pinia
-   Vue Flow
-   Element Plus (or Naive UI)

## Backend

-   Python
-   FastAPI
-   SQLAlchemy 2.0
-   Alembic
-   PostgreSQL

## Infrastructure

-   Docker Compose
-   MinIO (development object storage)

------------------------------------------------------------------------

# Repository Structure

``` text
odyssey/
├── apps/
│   ├── web/
│   ├── api/
│   └── docs/
├── packages/
│   ├── schemas/
│   └── design-tokens/
├── infrastructure/
│   ├── docker/
│   └── compose.yaml
├── seed/
├── .github/
└── README.md
```

------------------------------------------------------------------------

# Frontend Architecture

Do NOT couple business logic with Vue Flow.

Architecture:

``` text
Domain Model
      ↓
Canvas View Model
      ↓
Vue Flow
```

Recommended structure:

``` text
features/
└── canvas/
    ├── core/
    ├── adapters/
    │   └── vue-flow/
    ├── system-canvas/
    ├── agent-canvas/
    └── shared/
```

------------------------------------------------------------------------

# Backend

Provide only generic CRUD APIs.

Example:

-   Workspace
-   Knowledge Space
-   OdyJourney
-   Agent
-   Workflow
-   Variable
-   Tool

No special APIs for demo cases.

------------------------------------------------------------------------

# First OdyJourney

IMPORTANT:

The first OdyJourney MUST NOT be hardcoded in backend code.

It must be created using the normal frontend workflow:

Create Journey → Configure Pattern → Configure Agents → Build Canvas →
Save

The resulting data can later be exported as deployment seed.

Example:

``` text
seed/
└── first-odyjourney/
    ├── manifest.json
    ├── journey.json
    ├── knowledge-space.json
    └── files/
```

Seed data exists only for deployment initialization.

The backend must treat it exactly like user-created data.

------------------------------------------------------------------------

# Knowledge Space Storage

Knowledge Space consists of two layers.

Metadata:

-   PostgreSQL

Stores:

-   folders
-   hierarchy
-   file metadata
-   object key
-   status

Binary files:

Object Storage

Never use Git as runtime storage.

Architecture:

``` text
PostgreSQL
        +
Object Storage
```

------------------------------------------------------------------------

# Demo Assets

Small demo assets MAY live inside the repository.

Examples:

-   Markdown
-   Small PDFs
-   Images
-   JSON seed files

Example:

``` text
seed/
public/demo-assets/
```

These files are immutable demo content.

------------------------------------------------------------------------

# Runtime Uploads

Runtime uploads MUST NOT be committed into Git.

Use ObjectStorage abstraction.

``` python
class ObjectStorage:

    async def upload(...):
        ...

    async def delete(...):
        ...

    async def create_download_url(...):
        ...
```

Development:

-   MinIO

Public Demo:

-   Supabase Storage (free tier)

Future:

-   Cloudflare R2
-   AWS S3

Switching providers should not change business logic.

------------------------------------------------------------------------

# Public Demo

Single-user mode.

No authentication.

No user management.

No collaboration.

Support:

-   Create OdyJourney
-   Edit OdyJourney
-   Save
-   Reload
-   Demo examples

------------------------------------------------------------------------

# Initial Milestone

The first successful milestone is:

A user can create an OdyJourney entirely through the frontend UI, save
it into PostgreSQL, reload it, and continue editing it.

No execution engine is required for v1.
