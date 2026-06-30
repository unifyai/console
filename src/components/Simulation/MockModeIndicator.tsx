'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FlaskConical } from 'lucide-react';
import { MOCK_PERSONA_COOKIE, MOCK_SCENARIO_COOKIE } from '@/lib/simulation/config';
import { getPersona, getScenarioById, listScenarios } from '@/lib/simulation/scenario';

function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

/**
 * Persistent "MOCK" badge shown only when simulation mode is on. Surfaces the
 * active scenario/persona and links back to the entry route to switch. Returns
 * null when the build-time flag is off, so it is inert in real builds.
 */
export function MockModeIndicator() {
  const enabled = process.env.NEXT_PUBLIC_MOCK_SIM === 'true';
  const [label, setLabel] = useState<string>('Mock');

  useEffect(() => {
    if (!enabled) return;
    const scenario = getScenarioById(readCookie(MOCK_SCENARIO_COOKIE));
    const persona = getPersona(scenario, readCookie(MOCK_PERSONA_COOKIE));
    setLabel(`${scenario.label} · ${persona.label}`);
  }, [enabled]);

  if (!enabled) return null;
  // Avoid rendering a switcher when no scenario catalogue exists.
  if (listScenarios().length === 0) return null;

  return (
    <Link
      href="/mock"
      className="text-label bg-card/95 fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-border px-3 py-1.5 font-medium text-foreground shadow-pop backdrop-blur-sm transition-colors hover:bg-[var(--surface-hover)]"
      title="Switch mock scenario"
    >
      <span className="grid h-5 w-5 place-items-center rounded-full bg-accent-soft text-accent-soft-foreground">
        <FlaskConical className="h-3 w-3" />
      </span>
      <span className="uppercase tracking-[0.16em]">Mock</span>
      <span className="text-muted-foreground">{label}</span>
    </Link>
  );
}
