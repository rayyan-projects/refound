"""
DISABLED: Claude share-link import (claude.ai/share/<uuid>).

Why: tested from a home connection in Nov 2026 and it didn't work (the cloud
attempt hit Claude's bot protection, HTTP 403). url_fetcher now rejects Claude
share links with a clear message. Claude JSON *export* uploads still work
(claude_parser.ClaudeJsonParser).

To re-enable (see KEY_INFO.md "Claude share links: disabled"):
  1. Find a fetch route claude.ai allows (the snapshot API below was blocked).
  2. Uncomment this class, re-add it to PARSER_MAP in parsers/__init__.py and the
     claude branch in url_fetcher.import_url / resolve_share_url.
  3. Restore its tests (git history: tests/test_share_parsers.py TestClaudeShareParser).
  4. Remove the TODO notes in KEY_INFO.md / EXPLAINER.md and re-add Claude link
     wording to the UI.

How it worked: the share page is an empty client-rendered shell, so we fetched
https://claude.ai/api/chat_snapshots/<uuid> (vendored ChatPeek
fetch_claude_snapshot) and parsed it with ChatPeek's parse_claude_snapshot.
"""

# from __future__ import annotations
#
# from app.parsers.base import ParsedDocument
# from app.parsers.conversation import chat_to_document
# from app.vendor.chatpeek import parse_claude_snapshot
#
#
# class ClaudeShareParser:
#     """Parses the chat_snapshots JSON behind a claude.ai/share/<uuid> link."""
#
#     source_type = "claude_share"
#
#     def parse(self, snapshot_json: str, url: str = "") -> ParsedDocument:
#         chat = parse_claude_snapshot(snapshot_json)
#         return chat_to_document(chat, self.source_type, url, "Claude Conversation")
