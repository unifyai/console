import { FlaskConical } from 'lucide-react';
import { BrandStatusCard } from '@/components/Brand';
import { mockSimulationEnabled } from '@/lib/simulation/config';
import { listScenarios } from '@/lib/simulation/scenario';
import { enterScenario } from './actions';

/**
 * Mock simulation entry point. Lists every scenario/persona and, on selection,
 * establishes the mock session and redirects into the real shell. When the flag
 * is off this renders a disabled notice instead of any mock affordance.
 */
export default function MockEntryPage() {
  if (!mockSimulationEnabled()) {
    return (
      <main className="brand-page-stencil-bg grid min-h-screen place-items-center bg-background p-6">
        <BrandStatusCard
          eyebrow="Simulation"
          title="Mock mode is off"
          description="Set NEXT_PUBLIC_MOCK_SIM=true and restart to explore the Console against in-memory fixtures."
          icon={<FlaskConical className="h-5 w-5" />}
          tone="neutral"
        />
      </main>
    );
  }

  const scenarios = listScenarios();

  return (
    <main className="brand-page-stencil-bg min-h-screen bg-background px-6 py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="text-label uppercase tracking-[0.16em] text-muted-foreground">Simulation</p>
          <h1 className="text-h1 font-display text-foreground">Choose a mock scenario</h1>
          <p className="text-body-muted">
            Each scenario boots the real Console shell against hardcoded, in-memory data. Nothing is
            written to a backend; interactions reset on reload.
          </p>
        </header>

        <div className="flex flex-col gap-4">
          {scenarios.map((scenario) => (
            <section
              key={scenario.id}
              className="bg-card/95 flex flex-col gap-4 rounded-xl border border-border p-5 shadow-pop backdrop-blur-sm"
            >
              <div className="flex flex-col gap-1">
                <h2 className="text-h3 font-display text-foreground">{scenario.label}</h2>
                <p className="text-body-muted">{scenario.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {scenario.personas.map((persona) => (
                  <form key={persona.id} action={enterScenario}>
                    <input type="hidden" name="scenarioId" value={scenario.id} />
                    <input type="hidden" name="personaId" value={persona.id} />
                    <button
                      type="submit"
                      className="text-label rounded-lg border border-border bg-accent-soft px-4 py-2 font-medium text-accent-soft-foreground shadow-sm transition-colors hover:bg-[var(--surface-hover)]"
                    >
                      {persona.label}
                    </button>
                  </form>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
