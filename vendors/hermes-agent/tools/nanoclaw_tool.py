"""NanoClaw bridge tool for dispatching tasks to container-isolated execution.

Registers the ``nanoclaw_execute`` tool which sends prompts to NanoClaw's
HTTP API (``POST /api/execute``).  NanoClaw runs each task inside an
isolated container with its own filesystem and Claude Agent SDK instance.

Configuration:
    NANOCLAW_URL        -- Base URL of the NanoClaw HTTP API
                           (default: http://localhost:7777)
    DURANDAL_API_TOKEN  -- Bearer token for NanoClaw API authentication
                           (required for /api/* endpoints; /health is open)
"""

import json
import logging
import os
import urllib.request
import urllib.error

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

_DEFAULT_NANOCLAW_URL = "http://localhost:7777"


def _get_nanoclaw_url() -> str:
    """Return the NanoClaw base URL (no trailing slash)."""
    return (os.getenv("NANOCLAW_URL") or _DEFAULT_NANOCLAW_URL).rstrip("/")


def _get_api_token() -> str:
    """Return the DURANDAL_API_TOKEN for Bearer auth."""
    return os.getenv("DURANDAL_API_TOKEN", "")


# ---------------------------------------------------------------------------
# HTTP helpers (stdlib only -- no extra deps)
# ---------------------------------------------------------------------------

def _http_get(url: str, timeout: int = 5) -> dict:
    """Perform a GET request and return parsed JSON."""
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _http_post(url: str, payload: dict, token: str = "", timeout: int = 120) -> dict:
    """Perform a POST request with JSON body and optional Bearer token."""
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/json",
        },
    )
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


# ---------------------------------------------------------------------------
# Availability check
# ---------------------------------------------------------------------------

def _check_nanoclaw_available() -> bool:
    """Return True if NanoClaw's /health endpoint is reachable.

    Also requires DURANDAL_API_TOKEN to be set, since the /api/execute
    endpoint enforces Bearer auth.
    """
    if not _get_api_token():
        logger.debug("nanoclaw_execute unavailable: DURANDAL_API_TOKEN not set")
        return False
    try:
        result = _http_get(f"{_get_nanoclaw_url()}/health", timeout=3)
        return result.get("status") == "healthy"
    except Exception as e:
        logger.debug("nanoclaw_execute unavailable: health check failed: %s", e)
        return False


# ---------------------------------------------------------------------------
# Handler
# ---------------------------------------------------------------------------

def _handle_nanoclaw_execute(args: dict, **kw) -> str:
    """Handler for nanoclaw_execute tool.

    Sends a prompt to NanoClaw's container execution engine and returns
    the result.  Container execution may take a while (up to ~2 minutes),
    so the timeout is generous.
    """
    prompt = args.get("prompt", "")
    if not prompt:
        return json.dumps({"error": "Missing required parameter: prompt"})

    session_id = args.get("session_id")

    base_url = _get_nanoclaw_url()
    token = _get_api_token()

    payload: dict = {"prompt": prompt}
    if session_id:
        payload["sessionId"] = session_id

    try:
        result = _http_post(
            f"{base_url}/api/execute",
            payload,
            token=token,
            timeout=180,
        )
        return json.dumps({
            "status": result.get("status", "unknown"),
            "result": result.get("result"),
            "sessionId": result.get("sessionId"),
            "error": result.get("error"),
        })
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8", errors="replace")
        except Exception:
            pass
        logger.error("nanoclaw_execute HTTP error %s: %s", e.code, body)
        return json.dumps({
            "error": f"NanoClaw API returned HTTP {e.code}: {body or e.reason}",
        })
    except urllib.error.URLError as e:
        logger.error("nanoclaw_execute connection error: %s", e.reason)
        return json.dumps({
            "error": f"Could not connect to NanoClaw at {base_url}: {e.reason}",
        })
    except Exception as e:
        logger.error("nanoclaw_execute error: %s", e)
        return json.dumps({
            "error": f"NanoClaw execution failed: {type(e).__name__}: {e}",
        })


# ---------------------------------------------------------------------------
# Tool schema
# ---------------------------------------------------------------------------

NANOCLAW_EXECUTE_SCHEMA = {
    "name": "nanoclaw_execute",
    "description": (
        "Execute a task in an isolated container via NanoClaw. "
        "The prompt is sent to a fresh Claude Agent SDK instance running "
        "inside a sandboxed container with its own filesystem, terminal, "
        "and browser. Use this for tasks that need code execution, file "
        "manipulation, or web browsing in a safe, disposable environment. "
        "Optionally pass a session_id to resume a previous container session."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "description": (
                    "The task or instruction to execute in the container. "
                    "Be specific and self-contained -- the container agent "
                    "has no access to your current conversation context."
                ),
            },
            "session_id": {
                "type": "string",
                "description": (
                    "Optional session ID to resume a previous container session. "
                    "When provided, the container agent continues from where "
                    "the previous session left off (same filesystem state). "
                    "Omit to start a fresh session."
                ),
            },
        },
        "required": ["prompt"],
    },
}


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

from tools.registry import registry

registry.register(
    name="nanoclaw_execute",
    toolset="nanoclaw",
    schema=NANOCLAW_EXECUTE_SCHEMA,
    handler=_handle_nanoclaw_execute,
    check_fn=_check_nanoclaw_available,
    requires_env=["DURANDAL_API_TOKEN"],
    emoji="\U0001f4e6",  # package emoji
    description="Execute a task in an isolated NanoClaw container",
)
