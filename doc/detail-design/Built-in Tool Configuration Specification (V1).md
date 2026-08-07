
# Built-in Tool Configuration Specification (V1)

## Overview

Built-in Tools are executable operations inside a Task Node.

Available Built-in Tools:

```
State
└── Set Variable

Integration
└── API Request

Knowledge
└── Knowledge Retrieval

Computation
└── Script Execution

Intelligence
└── LLM Call
```

Each Tool has:

```
Configuration
Input
Output
```

---

# 1. Set Variable

## Purpose

Modify the value of an existing variable.

## Fields

### Target Variable

Required.

Type:

```
Variable Selector
```

Select writable variable.

Example:

```
agent.review_status
```

---

### Operation

Required.

Type:

```
Dropdown
```

V1 Supported:

```
Assign
Append
Increment
Toggle
```

---

### Value

Required.

Type:

```
Value Input
```

Source:

```
Static Value

Variable Reference
```

Example:

```
Target:
agent.status

Operation:
Assign

Value:
"completed"
```

---

# 2. API Request

## Purpose

Call an external HTTP API.

## Fields

---

### Method

Required.

Type:

```
Dropdown
```

Options:

```
GET
POST
PUT
DELETE
```

---

### URL

Required.

Type:

```
Text Input
```

Example:

```
https://api.example.com/users
```

Supports variable reference:

```
https://api.example.com/users/{{task.user_id}}
```

---

### Headers

Optional.

Type:

```
Key-Value Editor
```

Example:

```
Content-Type: application/json
```

---

### Request Body

Optional.

Type:

```
JSON Editor
```

Used for:

```
POST
PUT
```

---

### Output Variable

Required.

Type:

```
Variable Selector
```

Stores API response.

Example:

```
response.body

↓

task.api_result
```

---

# 3. Knowledge Retrieval

## Purpose

Retrieve information from a Knowledge Space.

## Fields

---

### Knowledge Space

Required.

Type:

```
Dropdown
```

Example:

```
SSTM Research
```

---

### Query

Required.

Type:

```
Text Input / Variable Reference
```

Example:

```
agent.research_question
```

---

### Top K

Optional.

Type:

```
Number Input
```

Default:

```
5
```

---

### Output Variable

Required.

Type:

```
Variable Selector
```

Example:

```
retrieved_documents

↓

task.context
```

---

# 4. Script Execution

## Purpose

Execute deterministic code.

## Fields

---

### Language

Required.

Type:

```
Dropdown
```

Options:

```
Python
JavaScript
```

---

### Input Variables

Optional.

Type:

```
Variable Selector List
```

Example:

```
task.documents

agent.threshold
```

---

### Script

Required.

Type:

```
Code Editor
```

Example:

```python
result = filter_documents(documents)
```

---

### Output Variable

Required.

Type:

```
Variable Selector
```

Example:

```
result

↓

task.filtered_documents
```

---

# 5. LLM Call

## Purpose

Execute a single LLM inference call.

LLM Call is not an Agent.

---

## Fields

### Model

Required.

Type:

```
Dropdown
```

Example:

```
GPT-5
Claude
```

---

### Prompt

Required.

Type:

```
Text Editor
```

Supports:

```
Static Text

Variable Reference
```

Example:

```
Analyze this document:

{{task.document}}
```

---

### Output Variable

Required.

Type:

```
Variable Selector
```

Example:

```
response

↓

task.analysis_result
```

---

# Common Tool Panel Layout

All tools share the same UI structure:

```
Tool Configuration

--------------------

Configuration

(tool specific fields)


--------------------

Input

(variable references)


--------------------

Output

save result to:

[ variable ]

--------------------
```

---

# V1 Design Constraints

The following are intentionally not included:

- Tool-level branching
    
- Tool-level routing
    
- Parallel execution
    
- Retry policy configuration
    
- Authentication management
    
- Advanced model parameters
    
- Complex schema editor
    
- Graph retrieval configuration
    

These belong to future versions.

---

# Design Principle

V1 Tools follow a simple model:

```
Input Variables
        ↓
Tool Execution
        ↓
Output Variable
```

The Task controls execution order.

Variables control data flow.

Workflow controls routing.