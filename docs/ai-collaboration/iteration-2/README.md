# Iteration 2 development-session collection

**October 10–23, 2026, inclusive · Asia/Seoul · preliminary as of October 20**

Use this folder to coordinate private content selection and contributor confirmation.
It contains metadata and links, not session transcripts or another prompt diary.
The [canonical development prompt log](../../ai-collaboration-prompts-iteration-2.md)
and [provisional report](../../ai-collaboration-report-iteration-2.md) keep their existing paths.

## What belongs in the development collection

Select by the actual topics and work in each conversation. A repository folder,
working-directory match, date, title or model name only identifies a candidate.
Read the substantive exchanges and tool evidence privately before deciding.

- **Include:** OutLoud application implementation, testing, debugging, app builds,
  code review, and technical documentation tied to those changes. Explain the
  development task in the private selection reason.
- **Exclude:** AI-collaboration reporting and collection work, administration,
  coursework logistics, presentation/editorial work, general Codex/tool setup,
  and unrelated conversations. This report-preparation/collection conversation
  is excluded from the development archive and new developer prompt-log entries.
- **Mixed or uncertain:** exclude the whole session pending further content
  review. Record the reason privately; do not include it because one excerpt
  mentions application code, or trim its history to manufacture a development-only session.

Historical prompt-log records inherited from `main` are preserved. This scope
applies to the current archive and new task entries; an older log entry does not
establish that its whole source session was selected.

These are the team's collection rules requested by the user. They do not create
an exemption from the course's full-history review requirement. Review all
members' full histories as described in the [reporting guide](../../ai-collaboration-guidelines.md#review-all-members-interaction-histories);
a development-only archive does not establish that review or owner privacy approval.

## Private selection workflow

1. Each member identifies the tools, computers/interfaces and repository/worktree
   roots used during the iteration. Follow the [optional exporter procedure](../../ai-collaboration-guidelines.md#optional-local-session-exporter):
   dry-run the original exporter first, inspect its redacted staging and create a
   private source ZIP. Run separately for external worktree roots; review unsupported
   cloud/app histories in their original interfaces. Preserve originals.
2. From the repository root, initialize a private decision file using the
   [selection script](../../../scripts/select_development_sessions.py). Replace
   the placeholders with paths outside every Git checkout:

   ```sh
   python3 scripts/select_development_sessions.py init \
     /absolute/private/source.zip /absolute/private/selection.json
   ```

3. Review every candidate's content privately. In the generated decision file,
   mark each session `include` or `exclude` and supply a specific reason. Leave
   the source identity/hash fields unchanged. Pending decisions are not approval;
   use an exclusion with its unresolved-content reason for mixed/uncertain sessions.
   Exclude automatic safety-review sessions and agent-only sessions whose actual
   assignments are encrypted or otherwise unreadable. Do not infer their purpose
   from a parent conversation or a plausible final answer.
4. Build a separate development-only ZIP:

   ```sh
   python3 scripts/select_development_sessions.py build \
     /absolute/private/source.zip /absolute/private/selection.json \
     /absolute/private/development.zip
   ```

   The build must fail if any decision is unresolved, lacks a reason or does not
   match the source SHA. The script checks decisions and integrity; it does not
   understand topics, establish privacy or perform full-history review.
5. Inspect the new ZIP's membership and contents, including omissions, redactions,
   embedded media and any included support files. A hash/CRC check or clean text
   scan does not establish privacy. The owner must approve privacy before sharing;
   keep source ZIPs, decision files, manifests and development ZIPs outside Git.
6. Update the relevant member page below with coverage and confirmation metadata.
   Add verified missing **development** prompts/findings to the existing canonical
   task entries, without duplication, then update the report. Do not copy prompts
   into member pages or add this reporting conversation to the developer log.
7. Use the normal review, commit and push workflow for these public documentation
   changes. The selection script neither publishes evidence nor authorizes Git/Wiki
   publication. Refresh collection after October 23 before final team review.

## Member coverage

| Member | Source ownership and contribution account | Content selection | Full-history / privacy / report review |
| --- | --- | --- | --- |
| [Seoyeon](members/seoyeon.md) | This Mac's ownership confirmed; personal edits/non-use/testing account supplied | 12 included; 311 excluded; 0 pending topic decisions | Full-history / owner privacy / report review pending |
| [Injoon](members/injoon.md) | Member inventory and confirmation pending | Pending | Pending |
| [Jaewon](members/jaewon.md) | Member inventory and confirmation pending; app/cloud coverage needs review | Pending | Pending |
| [Jooyoung](members/jooyoung.md) | Member inventory and confirmation pending | Pending | Pending |

Seoyeon's preliminary source export had 323 candidate sessions. Content review
retained 12 development conversations and excluded 17 nondevelopment/mixed human
conversations, 142 automatic safety-review sessions and 152 agents with unreadable
assignments. All eight sessions in this reporting conversation's tree are excluded.
The private derived ZIP contains 24 source/support files plus its manifest; CRC,
selected membership and file hashes passed. This is topic selection, not completed
full-history or owner privacy review. The source snapshot ends October 20 at
10:41:23.889 KST, so later development still needs collection.

Do not infer another member's coverage from sessions on Seoyeon's Mac. No row
establishes all-flow testing, human acceptance or complete collection.

## How teammates update this branch

Start in a clean checkout, or save unrelated local work before switching branches.
For the first checkout of the shared branch:

```sh
git fetch origin
git switch --track origin/codex/ai-development-sessions
```

Follow the private selection steps, then edit your own `members/<name>.md` page.
Keep actual development prompts in the existing canonical task entries; do not
add transcript folders or another diary. Review the intended diff, commit the
public metadata/log changes and push to `codex/ai-development-sessions`. Fetch
teammates' updates before your next edit and resolve conflicts without force-pushing.
The report remains a team draft; Wiki publication and submission require their
separate review and authorization.

## Checks for the selection utility

Run these tests if changing the utility:

```sh
python3 -m unittest discover -s scripts -p 'test_*.py'
```

After building a private archive, inspect its manifest and run a ZIP integrity check:

```sh
python3 -m zipfile -t /absolute/private/development.zip
```

These checks verify the tool/archive, not topic decisions, media privacy or human approval.

## What goes on the public branch

Commit only the guide, scope/coverage metadata, member templates, selected report
content and filter code. Do not commit archives, raw/redacted transcripts, private
selection files, manifests, actual local source paths, credentials or private media.
Member pages summarize what is confirmed and link the canonical evidence; they
do not replace contributor review or the single development prompt log.
