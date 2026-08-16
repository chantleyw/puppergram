import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { LitterView } from '../logic/triage';
import { dailyBriefing } from '../logic/readback';
import { speak, stopSpeaking } from '../lib/voice';
import { AlertBanner } from './AlertBanner';
import { PuppyCard } from './PuppyCard';
import { LitterMatrix } from './LitterMatrix';
import { GrowthChart } from './GrowthChart';
import { Timeline } from './Timeline';
import { CareCards } from './CareCards';
import { RulesTable } from './RulesTable';
import { InstallHint } from './InstallHint';
import { Wordmark } from './Wordmark';
import { fmtDate } from '../lib/ui';

export function LitterHome({ view }: { view: LitterView }) {
  const [speaking, setSpeaking] = useState(false);

  async function brief() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    await speak(dailyBriefing(view));
    setSpeaking(false);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-28 pt-4">
      <header className="mb-4 flex items-start justify-between gap-3">
        <Wordmark />
        <Link
          to="/settings"
          className="tap -mr-2 px-2 text-sm text-muted hover:text-cream"
          aria-label="Settings"
        >
          ⚙
        </Link>
      </header>

      <div className="mb-4">
        <h1 className="display text-2xl leading-tight text-cream">
          {view.litter.damName}
          {view.litter.sireName && (
            <span className="text-berry"> × {view.litter.sireName}</span>
          )}
        </h1>
        <p className="num text-sm text-muted">
          {view.litter.breed} · {view.puppies.length} puppies · {view.ageLabel} ·
          whelped {fmtDate(view.litter.whelpedAt)}
        </p>
      </div>

      <div className="space-y-4">
        <AlertBanner view={view} />

        {/* Primary actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/weigh"
            className="tap gradient-action flex h-14 items-center justify-center rounded-xl text-base font-semibold shadow-lg shadow-berry/20"
          >
            Weigh the litter
          </Link>
          <button
            type="button"
            onClick={brief}
            aria-pressed={speaking}
            className="tap flex h-14 items-center justify-center gap-2 rounded-xl border border-iris/40 bg-iris/10 text-base text-cream hover:bg-iris/15"
          >
            <span aria-hidden>{speaking ? '■' : '▶'}</span>
            {speaking ? 'Stop' : 'Daily briefing'}
          </button>
        </div>

        <InstallHint />

        {/* Phone: cards. Tablet and desktop: the matrix. Same data. */}
        <div className="space-y-2 md:hidden">
          {view.puppies.map((p) => (
            <PuppyCard key={p.id} p={p} now={view.now} />
          ))}
        </div>
        <div className="hidden md:block">
          <LitterMatrix view={view} />
        </div>

        <GrowthChart view={view} />
        <Timeline view={view} />
        <CareCards view={view} />
        <RulesTable />

        <p className="pt-2 text-center text-xs text-muted">
          Puppergram is a breeder's record-keeping tool, not veterinary advice.
        </p>
      </div>
    </div>
  );
}
