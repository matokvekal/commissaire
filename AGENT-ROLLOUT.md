# AGENT.md Rollout Tracker

Last updated: 2026-07-24
Mode: One-by-one

## Process Rules

1. Create only one new AGENT.md per step.
2. After each creation, mark it DONE in this file.
3. Keep remaining queue ordered; always work from top to bottom.
4. If session ends, continue from the first item marked TODO.
5. Quality gate for each AGENT.md:
   - Must include parent navigation reference (Read Order with ../AGENT.md chain).
   - Must summarize immediate child folders/files for that directory.
   - If no child folders exist, explicitly state "No child folders".

## Quality Audit Snapshot

- Source: AGENT-AUDIT.md
- Parent reference pass: 21/25
- Full child-summary pass: 18/25
- Status: Partial compliance, retrofit needed for existing files.

## Retrofit Progress (One-by-One)

1. DONE - src/app/components/AGENT.md (added immediate children summary)
2. DONE - src/app/AGENT.md (expanded immediate children summary)
3. TODO - src/app/main/AGENT.md (expand children summary coverage)

## Completed

1. AGENT.md
2. docs/AGENT.md
3. tests/AGENT.md
4. public/AGENT.md
5. src/AGENT.md
6. src/app/AGENT.md
7. src/app/stores/AGENT.md
8. src/app/race/AGENT.md
9. src/app/components/AGENT.md
10. src/app/types/AGENT.md
11. src/app/utils/AGENT.md
12. src/app/services/AGENT.md
13. src/app/hooks/AGENT.md
14. src/app/main/AGENT.md
15. src/app/login/AGENT.md
16. src/app/otp/AGENT.md
17. src/app/contact/AGENT.md
18. src/app/legal/AGENT.md
19. src/app/terms/AGENT.md
20. src/app/workers/AGENT.md
21. src/app/constants/AGENT.md
22. src/app/config/AGENT.md
23. src/app/styles/AGENT.md

## Queue (One-by-One)

1. DONE - src/app/race/[id]/AGENT.md
2. DONE - src/app/race/[id]/heat/AGENT.md
3. TODO - src/app/race/[id]/raceMode/AGENT.md
4. TODO - src/app/race/[id]/schedule/AGENT.md
5. TODO - src/app/race/[id]/results/AGENT.md
6. TODO - src/app/race/[id]/standing/AGENT.md
7. TODO - src/app/race/[id]/riders/AGENT.md
8. TODO - src/app/race/[id]/categories/AGENT.md
9. TODO - src/app/race/[id]/info/AGENT.md
10. TODO - src/app/race/[id]/map/AGENT.md
11. TODO - src/app/race/[id]/editRiders/AGENT.md
12. TODO - src/app/components/csv/AGENT.md
13. TODO - src/app/components/importImage/AGENT.md
14. TODO - src/app/components/cloud/AGENT.md
15. TODO - src/app/components/auth/AGENT.md
16. TODO - src/app/components/header/AGENT.md
17. TODO - src/app/components/admin/AGENT.md
18. TODO - src/app/components/legal/AGENT.md
19. TODO - src/app/components/pwa/AGENT.md
20. TODO - src/app/components/ui/AGENT.md
21. TODO - src/app/assets/AGENT.md
22. TODO - src/app/landingV2/AGENT.md
23. TODO - src/app/hooks/\* high-traffic subfolders if added later
24. TODO - docs/cloud/AGENT.md
25. TODO - public/data/AGENT.md
26. TODO - public/ocr/AGENT.md

## Current Pointer

- Next file to create: src/app/race/[id]/raceMode/AGENT.md
