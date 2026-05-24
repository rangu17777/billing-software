---
skill: skill-creator
version: 1.0.0
project: AAN Billing Software
applies-to: [".agent/skills/**"]
trigger: "when asked to create a new skill for this project"
---

# Skill Creator — AAN Billing Software

## Purpose

Documents the standard for creating new skills in `.agent/skills/`. All skills must be
AAN-specific — no generic templates. Every skill encodes business rules that would
otherwise be re-explained in every prompt.

## Skill Anatomy

Every skill requires:
1. A directory under `.agent/skills/<skill-name>/`
2. A `SKILL.md` with YAML frontmatter + body (under 300 lines)
3. Optional `resources/` or `references/` subdirectory for extended content

## SKILL.md Frontmatter Schema

```yaml
---
skill: <kebab-case-name>           # required — matches directory name
version: 1.0.0                     # required — semver
project: AAN Billing Software      # required — always this value
applies-to: ["glob", "patterns"]   # required — file patterns this skill governs
trigger: "when to invoke"          # required — plain-English activation condition
resources:                         # optional — list of resource files
  - resources/file.json
---
```

## Body Structure (in order)

1. **Purpose** — One paragraph: what problem this skill solves in AAN context
2. **When to Apply** — Bullet list of trigger conditions
3. **Resource Routing** — Table mapping tasks to resource files (if resources exist)
4. **Non-Negotiable Rules** — Numbered list of hard constraints
5. **Code Patterns** — Inline JS/CSS code blocks showing the standard approach
6. **Anti-patterns** — What NOT to do (with concrete examples)

## Naming Conventions

- Directory: `kebab-case` (e.g., `pdf-layout`, `gst-calculations`)
- Resource files: `kebab-case.json` or `kebab-case.md`
- Reference other skills by name: "See brand-identity skill for color values."

## When a New Skill Is Warranted

Create when a pattern recurs across 2+ modules AND has:
- AAN-specific business rules (not just standard JS/CSS patterns)
- Non-obvious constraints (like the hours notation)
- Values that must stay consistent across files (GSTIN, GST rates, label names)

## Existing Skills

| Skill | Trigger |
|---|---|
| `brand-identity` | Any UI, CSS, PDF, or user-facing text decision |
| `error-handling-patterns` | Any async, Firebase, Supabase, PDF, or network code |
| `skill-creator` | Creating a new skill file |
