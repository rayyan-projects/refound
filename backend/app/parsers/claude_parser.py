"""
Parser for Claude JSON exports (Settings → Privacy → Export data → conversations.json).

Claude share links are DISABLED; see claude_share_parser.py and KEY_INFO.md.

Exports and share snapshots carry the same message shape:
  {"chat_messages": [{"sender": "human"|"assistant", "text": str|null,
                      "content": [{"type": "text", "text": ...}, ...]}], "name": ...}
so both go through ChatPeek's `parse_claude_snapshot`, which prefers
`content[]` (text, artifacts, voice notes) and falls back to `text`.
"""

from __future__ import annotations

import json

from app.parsers.base import BaseParser, ParsedDocument
from app.parsers.conversation import chat_sections, sections_to_text
from app.vendor.chatpeek import parse_claude_snapshot


class ClaudeJsonParser(BaseParser):
    """Parses a Claude JSON export (one conversation, or a list of them)."""

    source_type = "claude"

    def parse(self, file_bytes: bytes, filename: str) -> ParsedDocument:
        try:
            data = json.loads(file_bytes.decode("utf-8", errors="replace"))
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON: {exc}") from exc

        conversations = data if isinstance(data, list) else [data]
        conversations = [
            c for c in conversations
            if isinstance(c, dict) and isinstance(c.get("chat_messages"), list)
        ]
        if not conversations:
            raise ValueError("No Claude conversations found in file")

        multi = len(conversations) > 1
        all_sections: list[dict] = []
        all_text: list[str] = []
        titles: list[str] = []

        for conv in conversations:
            chat = parse_claude_snapshot(json.dumps(conv))
            name = chat.title or "Claude Conversation"
            sections = chat_sections(chat, heading_prefix=f"[{name}] " if multi else "")
            if not sections:
                continue
            titles.append(name)
            all_sections.extend(sections)
            all_text.append(sections_to_text(name, sections))

        if not all_sections:
            raise ValueError("Claude export contains no readable messages")

        return ParsedDocument(
            title=titles[0] if len(titles) == 1 else filename,
            raw_text="\n\n".join(all_text),
            source_type=self.source_type,
            sections=all_sections,
            metadata={"conversation_count": len(titles)},
        )

