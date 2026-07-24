# Docs Folder Guide

Purpose

- Product and implementation documentation for major features and operations.

Read Order

1. ../AGENT.md
2. app-review.md (known bugs)
3. roadmap.md (planned phases)
4. Feature doc matching your task (csv-import.md, local-ocr.md, race-data.md, etc.)

What Lives Here

- Requirements, architecture notes, known issues, migration notes.
- Cloud sync docs under cloud/.

When To Update

- Any behavior change that affects product flow.
- Any bug fix that closes or modifies a known issue.
- Any workflow that an agent repeatedly rediscovers from code.

Do Not

- Put source-of-truth runtime logic here; code in src/ remains authoritative.
