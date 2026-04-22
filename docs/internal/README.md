# Internal Documents

This directory contains **internal design notes, deep dives, and working papers** used during CrewBee's framework evolution.

## Purpose

These files are kept in the repository because they still provide useful engineering context for:

- architectural decisions
- adapter/runtime research
- implementation trade-offs
- historical design rationale

## What this folder is **not**

This folder is **not** the primary public documentation surface for CrewBee.

- It does **not** define the public product story
- It does **not** replace `README.md`
- It does **not** replace the user-facing guides in `docs/guide/`
- It should not be treated as a stable API or compatibility contract

## Recommended reading order

For most readers:

1. `README.md`
2. `docs/architecture.md`
3. `docs/guide/installation.md`
4. `docs/guide/release.md`

Only then use `docs/internal/` if you need deeper implementation background.

## Maintenance policy

- Keep this folder for high-value internal engineering material only
- Prefer adding public-facing concepts to `README.md` or `docs/`
- Prefer moving operational/user guidance to `docs/guide/`
- Avoid placing temporary investigation scratch files here
