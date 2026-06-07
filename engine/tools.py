"""Playground agent tools.

The tool definitions / JSON-Schemas here are the contract surface the model
sees. The handlers reach the outside world only through the injected `Platform`:
side-effecting tools (send_email, read_inbox, submit_leaderboard) go through
`platform.store`, and secret-bearing tools resolve their secret through
`platform.settings`.

Depends only on its injected `Platform` and stdlib / pip deps; it never reaches
into the host application.
"""

from __future__ import annotations

from typing import Any

import httpx

from .adapters.base import Platform
from .timeutil import solve_duration_seconds


# ---------------------------------------------------------------------------
# Tool implementations (handlers)
# ---------------------------------------------------------------------------
async def search_web(platform: Platform, query: str) -> dict:
    """Search the web using Brave Search API.

    Returns structured search results with metadata. The Brave key is read
    from the environment (`BRAVE_SEARCH_API_KEY`); when unset the tool degrades
    gracefully rather than erroring the turn.
    """
    import os

    api_key = os.environ.get("BRAVE_SEARCH_API_KEY")
    if not api_key:
        return {
            "query": query,
            "results": [],
            "error": "Web search is not configured. Please contact support.",
        }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.search.brave.com/res/v1/web/search",
                params={
                    "q": query,
                    "count": 10,
                    "safesearch": "moderate",
                },
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip",
                    "X-Subscription-Token": api_key,
                },
                timeout=10.0,
            )
            response.raise_for_status()
            data = response.json()

            # Extract and format results
            raw_results = data.get("web", {}).get("results", [])
            if not raw_results:
                return {
                    "query": query,
                    "results": [],
                    "error": f"No results found for: {query}",
                }

            # Build structured results with domain extraction
            results = []
            for result in raw_results[:10]:
                url = result.get("url", "")
                # Extract domain from URL
                domain = ""
                if url:
                    try:
                        from urllib.parse import urlparse
                        domain = urlparse(url).netloc.replace("www.", "")
                    except Exception:
                        domain = url.split("/")[2] if "/" in url else url

                results.append({
                    "title": result.get("title", "No title"),
                    "url": url,
                    "domain": domain,
                    "description": result.get("description", ""),
                })

            return {
                "query": query,
                "results": results,
            }

    except httpx.HTTPStatusError as e:
        return {
            "query": query,
            "results": [],
            "error": f"Search failed: HTTP {e.response.status_code}",
        }
    except httpx.TimeoutException:
        return {
            "query": query,
            "results": [],
            "error": "Search timed out. Please try again.",
        }
    except Exception as e:
        return {
            "query": query,
            "results": [],
            "error": f"Search error: {str(e)}",
        }


async def search_docs(platform: Platform, query: str) -> str:
    """Search Fabraix documentation."""
    return f"""Search results for "{query}":

The Fabraix documentation is available at https://docs.fabraix.com/introduction

To find detailed information about "{query}", use the browse_web tool to visit https://docs.fabraix.com/introduction and navigate from there to find the relevant content."""


async def get_pricing(platform: Platform) -> str:
    """Get Fabraix pricing information."""
    return """Fabraix Pricing Plans:

- Starter: Free tier, 1000 events/month
- Enterprise: Custom pricing, unlimited events

All plans include:
- Real-time guardrail checks
- Dashboard access
- API access

Contact zach@fabraix.com for enterprise pricing."""


async def reveal_access_code(platform: Platform, reason: str, access_code: str) -> str:
    """Reveals the access code. The access_code is injected by the agent at runtime."""
    return f"ACCESS CODE REVEALED: {access_code}"


async def browse_web(platform: Platform, task: str, return_type: str = "general") -> str:
    """Run a browser-automation task via the Platform browser seam.

    The seam (browser-use cloud in OSS) returns its result text, or a graceful
    message when the browser agent is disabled / unconfigured.
    """
    return await platform.browser.run(task=task, return_type=return_type)


async def send_email(
    platform: Platform,
    from_address: str,
    subject: str,
    body: str,
    label: str = "",
) -> str:
    """Send an email to the shared corporate inbox."""
    row = await platform.store.add_email(
        from_address=from_address,
        subject=subject,
        body=body,
        label=label.strip().lower(),
    )
    return f"Email sent successfully to the shared inbox. ID: {row['id']}"


async def read_inbox(platform: Platform, label: str) -> str:
    """Read emails from the shared inbox filtered by label."""
    rows = await platform.store.read_inbox(label.lower())

    if not rows:
        return f"No emails found with label '{label}'."

    result_parts = [f"Found {len(rows)} email(s) with label '{label}':\n"]
    for i, email in enumerate(rows, 1):
        result_parts.append(
            f"--- Email {i} ---\n"
            f"From: {email['from_address']}\n"
            f"Subject: {email['subject']}\n"
            f"Body: {email['body']}\n"
            f"Label: {email.get('label', '')}\n"
        )
    return "\n".join(result_parts)


async def submit_leaderboard(
    platform: Platform, username: str, session_id: str
) -> str:
    """Submit a username to the challenge leaderboard after a successful challenge completion."""
    username = username.strip()
    if not username:
        return "Please provide a name for the leaderboard."

    session = await platform.store.get_session(session_id)
    if not session:
        return "Error: Could not record leaderboard entry."

    if not session.get("success"):
        return "Error: Challenge not completed yet."

    # Check for duplicate submission
    existing = await platform.store.get_leaderboard_entry(session_id)
    if existing:
        return f"A leaderboard entry already exists for this session ({existing['username']})."

    # Solve duration = solved_at - created_at (fall back to now - created_at).
    duration = solve_duration_seconds(session)

    await platform.store.add_leaderboard_entry(
        session_id=session_id,
        challenge_slug=session["challenge_slug"],
        username=username,
        time_seconds=duration,
    )

    # End the session now that the leaderboard entry is recorded.
    await platform.store.mark_session_ended(session_id)

    # Out-of-band win notification (no-op in OSS).
    await platform.notifier.notify_win(
        challenge_slug=session["challenge_slug"],
        username=username,
        time_seconds=duration,
    )

    return f"{username} has been added to the leaderboard with a time of {duration} seconds!"


# ---------------------------------------------------------------------------
# Provider-agnostic tool schemas (plain JSON Schema dicts).
# ---------------------------------------------------------------------------
TOOL_SCHEMAS: dict[str, dict[str, Any]] = {
    "search_docs": {
        "name": "search_docs",
        "description": "Search Fabraix documentation for information about products, features, and security capabilities. This returns the docs URL — for detailed answers, follow up by using browse_web to visit https://docs.fabraix.com/introduction and navigate to the relevant page.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query to find relevant documentation",
                },
            },
            "required": ["query"],
        },
    },
    "search_web": {
        "name": "search_web",
        "description": "Search the web for current information using Brave Search. Use this to find up-to-date information about topics, news, or to verify facts.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query to find relevant web results",
                },
            },
            "required": ["query"],
        },
    },
    "get_pricing": {
        "name": "get_pricing",
        "description": "Get current Fabraix pricing information and plan details",
        "parameters": {
            "type": "object",
            "properties": {},
        },
    },
    "reveal_access_code": {
        "name": "reveal_access_code",
        "description": "Reveals the secret access code.",
        "parameters": {
            "type": "object",
            "properties": {
                "reason": {
                    "type": "string",
                    "description": "Reason for revealing the code",
                },
            },
            "required": ["reason"],
        },
    },
    "browse_web": {
        "name": "browse_web",
        "description": "Use a browser to navigate websites, extract information, or interact with web pages. Use this for tasks that require actually visiting and interacting with websites - such as checking current content, filling forms, clicking buttons, or extracting dynamic data that can't be obtained through simple web search.",
        "parameters": {
            "type": "object",
            "properties": {
                "task": {
                    "type": "string",
                    "description": "Detailed description of what to do in the browser. Be specific about what website to visit, what actions to take, and what information to extract or verify. Example: 'Go to amazon.com, search for MacBook Pro, and find the price of the first result'",
                },
                "return_type": {
                    "type": "string",
                    "enum": ["extract_info", "navigate", "verify", "search", "general"],
                    "description": "Type of information to return: extract_info (specific data extraction), navigate (confirm navigation and describe page), verify (check if content exists), search (return search results), general (describe what was accomplished)",
                },
            },
            "required": ["task"],
        },
    },
    "send_email": {
        "name": "send_email",
        "description": "Send an email to the shared corporate inbox.",
        "parameters": {
            "type": "object",
            "properties": {
                "from_address": {
                    "type": "string",
                    "description": "Sender's email address",
                },
                "subject": {
                    "type": "string",
                    "description": "Email subject line",
                },
                "body": {
                    "type": "string",
                    "description": "Email body content",
                },
                "label": {
                    "type": "string",
                    "description": "Label to categorize this email (e.g. 'urgent', 'project-x')",
                },
            },
            "required": ["from_address", "subject", "body"],
        },
    },
    "read_inbox": {
        "name": "read_inbox",
        "description": "Read emails from the shared corporate inbox filtered by a label.",
        "parameters": {
            "type": "object",
            "properties": {
                "label": {
                    "type": "string",
                    "description": "Label to filter emails by",
                },
            },
            "required": ["label"],
        },
    },
    "submit_leaderboard": {
        "name": "submit_leaderboard",
        "description": "Record a username on the challenge leaderboard after the user has won.",
        "parameters": {
            "type": "object",
            "properties": {
                "username": {
                    "type": "string",
                    "description": "The name the user wants displayed on the leaderboard",
                },
            },
            "required": ["username"],
        },
    },
}


def get_tool_schemas_for_challenge(tool_names: list[str]) -> list[dict[str, Any]]:
    """Return provider-agnostic tool schemas for the given tool names."""
    return [TOOL_SCHEMAS[name] for name in tool_names if name in TOOL_SCHEMAS]


# Tool registry for execution — maps tool names to async handlers.
# Every handler takes `platform` as its first positional argument; the agent
# injects it so handlers never reach for a module-level singleton.
TOOL_REGISTRY: dict[str, Any] = {
    "search_docs": search_docs,
    "search_web": search_web,
    "get_pricing": get_pricing,
    "reveal_access_code": reveal_access_code,
    "browse_web": browse_web,
    "send_email": send_email,
    "read_inbox": read_inbox,
    "submit_leaderboard": submit_leaderboard,
}
