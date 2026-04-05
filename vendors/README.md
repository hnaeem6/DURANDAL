# Vendor Dependencies

These directories are managed via `git subtree`. Do not clone or init submodules.

## Updating vendors

```bash
# Update Hermes Agent
git subtree pull --prefix=vendors/hermes-agent hermes-upstream main --squash

# Update NanoClaw
git subtree pull --prefix=vendors/nanoclaw nanoclaw-upstream main --squash
```

## Remotes

```bash
git remote add hermes-upstream https://github.com/NousResearch/hermes-agent.git
git remote add nanoclaw-upstream https://github.com/qwibitai/nanoclaw.git
```
