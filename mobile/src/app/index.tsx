// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: Home → Upload → Rehearse → Review / Compare / Audience Q&A.
import { AppShell } from '../screens/AppShell';
import { DemoAccessGate } from '../screens/DemoAccessGate';

export default function Index() {
  return <DemoAccessGate><AppShell /></DemoAccessGate>;
}
