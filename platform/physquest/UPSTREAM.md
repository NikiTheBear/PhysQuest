# PhysQuest source provenance

Upstream: https://github.com/NikiTheBear/PhysQuest
Commit: d1e6abd934ec0d43b90bfccad145f2778056f8b1
License: MIT (see LICENSE)

This directory contains a source snapshot of apps/web and shared/knowledge-data with the free-build integration. App.tsx and KnowledgeMap navigation replace the guided challenge flow with an embedded same-origin Fieldlab workbench. Knowledge content, original solver and its tests remain included. The root build packages both applications and all experiment files in one Worker.

Update the installed sibling PhysQuest checkout, then run `npm run sync:physquest`; review changes before building. No upstream pushes are performed. `shared/physquest-lens.js` is a TypeScript-free transcription produced by esbuild from the unchanged original engine.ts; compare its behavior with the original tests when changing it.
