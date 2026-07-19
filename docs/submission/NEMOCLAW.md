# Best Use of NemoClaw + OpenShell — Sky Launchpad

**An agent worth containing — then contained, with a boundary that holds under
attack.** Verified live on the GPU box `sky-nvidia`.

## The agent is worth containing

Sky Launchpad's agent isn't a chatbot — it holds **real power**: live Alibaba
Cloud RAM credentials and a GitLab token, and it runs actual `terraform apply`
to create/destroy cloud infrastructure, then drives a browser to test the
deployed app. That capability is exactly what makes the containment meaningful:
a weak agent behind a strong policy proves nothing.

## How it maps to the NemoClaw blueprint

- **Harness:** OpenClaw (NemoClaw's default), onboarded via
  `nemoclaw onboard` on `sky-nvidia`.
- **Routed inference:** `NEMOCLAW_PROVIDER=custom` pointed at **our self-hosted
  vLLM Nemotron** endpoint — the agent's only brain runs on open NVIDIA models
  on our own hardware, not a frontier API.
- **Sandbox:** OpenShell 0.0.72 (Docker driver), CPU sandbox — the GPU stays on
  the host for vLLM; the sandboxed agent reaches inference over the network.
- **Policy:** a custom preset (`nvidia/nemoclaw/policies/sky-deployer.yaml`)
  applied with `nemoclaw sky-deployer policy-add`.

**One design decision it forced:** NemoClaw's onboarding rejected a private
host-gateway inference URL via its **SSRF guard**. That pushed us to route the
sandbox's inference through the *public, authenticated* vLLM endpoint — which
in turn made the agent's own brain a **governed, allowlisted dependency** in the
policy, not an implicit localhost escape hatch.

## The policy — non-trivial, least-privilege egress

Deny-by-default. The agent may reach ONLY: the vLLM Nemotron endpoint, Alibaba
ECS/VPC APIs, GitLab (`/api/v4` GET/POST/PUT — **no DELETE**), the Supabase
skills memory (GET/POST/PATCH — **no DELETE, so it can learn but never erase its
own memory**), and the Terraform registries. Every other host is refused at the
CONNECT layer. It also uses **allow-with-escalation**: `terraform destroy` is
gated behind an operator-approval file writable only from *outside* the sandbox.

## Proof the boundary holds (run live, from inside the sandbox)

```
[1] ALLOWED  — Nemotron brain (vLLM):   -> reached: Nemotron            ✅
[2] BLOCKED  — webhook.site exfil:       -> 403 CONNECT tunnel failed    🛡️
[3] BLOCKED  — pastebin upload:          -> 403 CONNECT tunnel failed    🛡️
[4] BLOCKED  — gmail:                    -> 403 CONNECT tunnel failed    🛡️
```

The agent — which holds real cloud credentials — **can** reach the one endpoint
it needs to think, and **cannot** reach a single attacker-controlled or
arbitrary host to exfiltrate them. It knows how, it has the access, and it still
can't, because the boundary is enforced by OpenShell, not the model's judgment.

Reproduce: `nemoclaw sky-deployer exec -- curl https://webhook.site/` → `403`.
Full harness + policy: `nvidia/nemoclaw/NEMOCLAW.md`, `policies/sky-deployer.yaml`,
`adversarial_test.sh`.
