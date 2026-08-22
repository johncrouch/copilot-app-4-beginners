import { createServer } from "node:http";
import { joinSession, createCanvas, CanvasError } from "@github/copilot-sdk/extension";

const stateByInstance = new Map();
const serverByInstance = new Map();

const defaultIssues = [
    {
        id: "db-explorer-canvas",
        title: "Improve the Database Explorer canvas",
        description: "The repo already has a Database Explorer canvas, so this work likely needs the most immediate attention because it is already documented, discoverable, and close to the core workflow.",
        rationale: "It affects an existing, user-facing canvas path and can unlock faster investigation for the rest of the project.",
    },
    {
        id: "pr-readiness-agent",
        title: "Harden the PR Readiness agent",
        description: "The README calls out a PR Readiness agent as the quality gate before opening pull requests, so its reliability directly affects the release flow.",
        rationale: "It sits on the critical path for validation and review, so any weakness here blocks confidence in every change.",
    },
    {
        id: "github-app-run-menu",
        title: "Refine the GitHub Copilot App Run menu",
        description: "The app run menu drives developer entry points like starting the site and validation commands, which makes it a high-leverage place to smooth the workflow.",
        rationale: "It is one of the first surfaces people use to get work moving, so a better experience here compounds across the whole repo.",
    },
    {
        id: "test-suite-coverage",
        title: "Expand test-suite coverage",
        description: "The project relies on unit, E2E, and type-check validation, so gaps in coverage can hide regressions in the static site and data layer.",
        rationale: "This is important but broader and less immediately blocking than the items above.",
    },
    {
        id: "docs-polish",
        title: "Polish contributor documentation",
        description: "Several repo instructions and README sections can always be tightened to make the project easier to onboard into.",
        rationale: "Useful work, but lower urgency than the core developer-facing features and checks.",
    },
];

function getState(instanceId) {
    let state = stateByInstance.get(instanceId);
    if (!state) {
        state = { issues: defaultIssues.slice() };
        stateByInstance.set(instanceId, state);
    }
    return state;
}

function renderIssueCard(issue, isTopThree) {
    const badge = isTopThree ? "Top priority" : "Backlog";
    return `
      <article class="card ${isTopThree ? "card-top" : "card-backlog"}" data-testid="issue-${issue.id}">
        <div class="card-head">
          <span class="badge">${badge}</span>
          <button type="button" data-action="add-to-context" data-issue-id="${issue.id}" data-testid="add-${issue.id}">
            Add to current context
          </button>
        </div>
        <h3>${issue.title}</h3>
        <p class="summary">${issue.description}</p>
        <p class="rationale"><strong>Why now:</strong> ${issue.rationale}</p>
      </article>
    `;
}

function renderHtml(instanceId) {
    const state = getState(instanceId);
    const topThree = state.issues.slice(0, 3);
    const rest = state.issues.slice(3);

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Kanban triage board</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: var(--font-sans, system-ui, sans-serif);
      }
      body {
        margin: 0;
        background: var(--background-color-default, #0f172a);
        color: var(--text-color-default, #e2e8f0);
      }
      main {
        padding: 20px;
      }
      h1, h2, h3, p {
        margin: 0;
      }
      .section {
        margin-bottom: 24px;
      }
      .grid {
        display: grid;
        gap: 16px;
      }
      .priority {
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }
      .backlog {
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      }
      .card {
        border: 1px solid var(--border-color-default, #334155);
        border-radius: 16px;
        padding: 16px;
        background: rgba(15, 23, 42, 0.92);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
      }
      .card-top {
        border-color: var(--true-color-red-muted, #7f1d1d);
      }
      .card-backlog {
        opacity: 0.9;
      }
      .card-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        margin-bottom: 12px;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
        background: rgba(59, 130, 246, 0.16);
        color: #bfdbfe;
      }
      button {
        border: 1px solid var(--border-color-default, #475569);
        border-radius: 999px;
        padding: 8px 12px;
        background: #1e293b;
        color: inherit;
        cursor: pointer;
      }
      button:hover, button:focus-visible {
        outline: none;
        border-color: var(--color-focus-outline, #60a5fa);
        box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.35);
      }
      .summary, .rationale {
        margin-top: 10px;
        color: var(--text-color-muted, #94a3b8);
        line-height: 1.5;
      }
      .meta {
        margin-top: 8px;
        color: var(--text-color-muted, #94a3b8);
        font-size: 13px;
      }
      .toast {
        position: sticky;
        bottom: 12px;
        margin-top: 16px;
        padding: 12px 14px;
        border-radius: 12px;
        background: rgba(15, 118, 110, 0.92);
        color: white;
        display: none;
      }
      .toast.show {
        display: block;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="section">
        <h1>Kanban triage board</h1>
        <p class="meta">Top three issues are highlighted first; the remaining work is grouped below.</p>
      </section>

      <section class="section">
        <h2>Most likely to need attention now</h2>
        <div class="grid priority">${topThree.map((issue) => renderIssueCard(issue, true)).join("")}</div>
      </section>

      <section class="section">
        <h2>Everything else</h2>
        <div class="grid backlog">${rest.map((issue) => renderIssueCard(issue, false)).join("")}</div>
      </section>

      <div id="toast" class="toast" role="status" aria-live="polite"></div>
    </main>
    <script>
      const toast = document.getElementById("toast");
      const issues = ${JSON.stringify(state.issues)};

      function showToast(message) {
        toast.textContent = message;
        toast.classList.add("show");
        window.clearTimeout(window.__toastTimer);
        window.__toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2500);
      }

      document.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action='add-to-context']");
        if (!button) return;
        const issue = issues.find((item) => item.id === button.dataset.issueId);
        if (!issue) return;

        const response = await fetch("/context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(issue),
        });

        if (response.ok) {
          showToast("Added to current context: " + issue.title);
        } else {
          showToast("Unable to add issue to context.");
        }
      });
    </script>
  </body>
</html>`;
}

async function startServer(instanceId) {
    const server = createServer((req, res) => {
        if (req.method === "POST" && req.url === "/context") {
            const chunks = [];
            req.on("data", (chunk) => chunks.push(chunk));
            req.on("end", () => {
                try {
                    const issue = JSON.parse(Buffer.concat(chunks).toString("utf8"));
                    res.setHeader("Content-Type", "application/json; charset=utf-8");
                    res.end(JSON.stringify({ added: true, issue }));
                } catch {
                    res.statusCode = 400;
                    res.end("invalid json");
                }
            });
            return;
        }

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(renderHtml(instanceId));
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    return { server, url: `http://127.0.0.1:${port}/` };
}

await joinSession({
    canvases: [
        createCanvas({
            id: "triage-board",
            displayName: "Triage Board",
            description: "A basic Kanban board for quickly sorting the most urgent issues.",
            actions: [
                {
                    name: "add_issue_to_context",
                    description: "Mark an issue as added to the current session context.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            issueId: { type: "string" },
                        },
                        required: ["issueId"],
                        additionalProperties: false,
                    },
                    handler: async (ctx) => {
                        const { issueId } = ctx.input;
                        const state = getState(ctx.instanceId);
                        const issue = state.issues.find((item) => item.id === issueId);
                        if (!issue) {
                            throw new CanvasError("issue_not_found", "Unknown issue.");
                        }
                        return { added: true, issue };
                    },
                },
            ],
            open: async (ctx) => {
                let entry = serverByInstance.get(ctx.instanceId);
                if (!entry) {
                    entry = await startServer(ctx.instanceId);
                    serverByInstance.set(ctx.instanceId, entry);
                }
                return {
                    title: "Triage Board",
                    url: entry.url,
                };
            },
            onClose: async (ctx) => {
                const entry = serverByInstance.get(ctx.instanceId);
                if (entry && entry.server) {
                    serverByInstance.delete(ctx.instanceId);
                    await new Promise((resolve) => entry.server.close(() => resolve()));
                }
            },
        }),
    ],
});
