# STEINER MINI CLOUD 2.0

A browser-based mini desktop, hosted on a Node.js HTTP service on Render, with an **optional outbound-only Windows agent**.

## Functions
- Desktop UI: windows, Start menu, Explorer, virtual text files, Notepad, calculator, Paint, constrained terminal, browser, settings, task manager.
- Cloud app: authenticates with administrator secret, selects agent, sends limited jobs and verifies completion.
- Agent (Python standard library): `status`, `list_projects`, `create_note`, `create_site`, `list_outputs`, `read_output`.
- Generated files live in the local STEINER_DEV workspace, under `STEINER_MINI_WINDOWS/CLOUD_OUTPUTS/`.
- Agent uses **outbound HTTPS polling**, not Windows Remote Desktop, no UAC bypass and no arbitrary command execution.
- Job queue is in memory and resets when the free Render web service restarts.

## Security
Set **two separate long random secrets** as Render environment variables:
- `STEINER_ADMIN_TOKEN`: only the owner enters it into the web UI.
- `STEINER_AGENT_TOKEN`: only the Windows agent receives it.

**Never commit actual tokens or config files.** The `cloud_agent_config.json` and `CLOUD_ACESSO_PRIVADO.txt` are local secrets, not part of this repository.

The public site is reachable without a password, **but its authenticated remote actions require the private administrator token**. The relay does not have a remote shell endpoint.

## Start the Windows agent
1. Copy `cloud_agent.py` and create `cloud_agent_config.json` from the example.
2. Ensure Python 3.9+ and HTTPS internet access.
3. Run `py -3 cloud_agent.py --selftest`.
4. Run `py -3 cloud_agent.py`.
5. Open your deployed site, launch **Ponte Cloud**, enter the admin token and check status.

## Free-tier limitations
The Render free service may sleep, cold start and reset queued jobs. This is a useful pilot, **not yet a reliable always-on commercial system**. Generated HTML is local and is not automatically published.

## What this is not
Not a Windows OS clone that runs EXEs or drivers; not a full MCP-to-cloud bridge; not automatic control of security prompts; not AI-based code repair. Those require separate implementations and testing.

## Test evidence
- JavaScript syntax verified.
- Agent Python syntax and selftests: sandbox output, SHA-256 and path traversal blocking.
- Authenticated cloud `status` job returned real Windows 10 and Python 3.14.3 agent data.
- Cloud-created files should be checked by the included integration test before claims of production readiness.
