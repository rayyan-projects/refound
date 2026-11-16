"""
Parser for ChatGPT shared conversation pages (chatgpt.com/share/<id>, /s/<id>).

Tries the vendored ChatPeek parser first (React Router stream, post shares,
legacy __NEXT_DATA__; follows `linear_conversation` so turns come out in order
with no duplicate branches). If that finds nothing, falls back to the
"octane" format ChatGPT started shipping in Nov 2026, which ChatPeek doesn't
know yet: a `<script id="__WEB_MOBILE_DATA__" type="application/json">` whose
`conversation.messages` is the shared branch, in order, as
`{"role": "user"|"assistant", "content": "<markdown>"}`.

Fails loudly instead of indexing page chrome.
"""

from __future__ import annotations

import json
from typing import Any

from app.parsers.base import ParsedDocument
from app.parsers.conversation import chat_to_document
from app.vendor.chatpeek import (
    Chat,
    Reply,
    ReplyType,
    _extract_scripts,
    author_name_for_role,
    parse_share_html,
    strip_citation_tokens,
    strip_private_use,
)

OCTANE_DATA_SCRIPT_ID = "__WEB_MOBILE_DATA__"


class ChatGPTShareParser:
    source_type = "chatgpt_share"

    def parse(self, html: str, url: str = "") -> ParsedDocument:
        try:
            chat = parse_share_html(html)
        except (ValueError, KeyError, TypeError, AttributeError):
            chat = parse_octane_share(html)
            if chat is None:
                raise ValueError(
                    "No conversation found in the ChatGPT share page. The link may be "
                    "invalid, or ChatGPT changed its page format again (see "
                    "app/parsers/chatgpt_share_parser.py and app/vendor/chatpeek.py)."
                ) from None
        return chat_to_document(chat, self.source_type, url, "ChatGPT Conversation")


def parse_octane_share(html: str) -> Chat | None:
    """Build a Chat from the Nov 2026 share-page format, or None if absent."""

    data = _octane_data(html)
    conversation = data.get("conversation") if isinstance(data, dict) else None
    if not isinstance(conversation, dict) or not isinstance(conversation.get("messages"), list):
        return None

    replies: list[Reply] = []
    for message in conversation["messages"]:
        if not isinstance(message, dict):
            continue
        role = message.get("role")
        content = message.get("content")
        if role not in ("user", "assistant") or not isinstance(content, str):
            continue
        text = strip_citation_tokens(strip_private_use(content)).strip()
        if text:
            replies.append(Reply(author_name=author_name_for_role(role), type=ReplyType(role), statement=text))

    shared = conversation.get("sharedContent") if isinstance(conversation.get("sharedContent"), dict) else {}
    source = conversation.get("sharedSource") if isinstance(conversation.get("sharedSource"), dict) else {}
    created_ms = shared.get("originalCreatedAt")
    title = conversation.get("title") or shared.get("title")
    return Chat(
        share_id=source.get("id") if isinstance(source.get("id"), str) else "shared",
        ai_model="",
        title=title if isinstance(title, str) else "",
        updated_at=created_ms / 1000 if isinstance(created_ms, (int, float)) else None,
        replies=replies,
    )


def _octane_data(html: str) -> Any:
    for attrs, text in _extract_scripts(html):
        if attrs.get("id") == OCTANE_DATA_SCRIPT_ID:
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return None
    return None
