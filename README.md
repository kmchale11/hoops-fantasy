# Hoops Fantasy

Free-to-play fantasy basketball for Irish domestic leagues. Planned with [OpenSpec](https://github.com/Fission-AI/OpenSpec).

## Build order

Each folder in `openspec/changes/` is one change with a proposal, specs, design (where needed) and tasks. Build them in this order:

1. `add-stats-ingestion` – feed adapter, mock Irish league data, scheduled sync
2. `add-fantasy-scoring` – points formula, rounds, recalculation on corrections
3. `add-user-accounts` – magic link / Google sign-in, 18+ confirmation, account deletion
4. `add-squad-selection` – prices, 8-player squads, captain, deadline lock, user scores
5. `add-mini-leagues` – overall leaderboard and invite-code leagues

Later changes, not yet specced: live in-game scoring, form-based price changes, transfers and autosubs, Division 1 and National League D2.

## Working with it

```bash
npm install -g @fission-ai/openspec@latest
openspec list            # see the planned changes
openspec show add-stats-ingestion
openspec validate --all --strict
```

With your coding agent: `/openspec-apply-change add-stats-ingestion`, then `/openspec-archive-change` when it's done.
