import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useCurrentLitter, useLitterView } from './hooks/useLitterView';
import { LitterSetup } from './components/LitterSetup';
import { LitterHome } from './components/LitterHome';
import { WeighFlow } from './components/WeighFlow';
import { PuppyDetail } from './components/PuppyDetail';
import { Settings } from './components/Settings';

/* The Solana stack is large and is needed on exactly two screens. Splitting it
   out keeps it off the weigh flow, which is the one used offline at 3am.
   The service worker still precaches these chunks, so both screens work
   without a network once the app has been opened once. */
const PassportExport = lazy(() =>
  import('./components/PassportExport').then((m) => ({ default: m.PassportExport }))
);
const VerifyPage = lazy(() =>
  import('./components/VerifyPage').then((m) => ({ default: m.VerifyPage }))
);
import { Wordmark } from './components/Wordmark';
import { loadDemoLitter } from './db/seed';

function Loading() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <p className="text-sm text-muted">Loading…</p>
    </div>
  );
}

function Empty() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-lg px-4 pt-16">
      <Wordmark />
      <h1 className="display mt-8 text-3xl leading-tight text-cream">
        Weight is the first thing to change, and the last thing anyone notices.
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Puppergram watches every puppy's daily gain from birth to eight weeks and
        tells you which one needs attention tonight — before there is anything
        to see.
      </p>

      <div className="mt-8 space-y-2">
        <button
          type="button"
          onClick={async () => {
            await loadDemoLitter();
            navigate('/');
          }}
          className="tap h-14 w-full rounded-xl bg-heat text-base font-semibold text-ink"
        >
          Load demo litter
        </button>
        <button
          type="button"
          onClick={() => navigate('/setup')}
          className="tap h-14 w-full rounded-xl border border-cream/20 text-base text-cream"
        >
          Start my own litter
        </button>
      </div>

      <p className="mt-6 text-xs text-muted">
        The demo is a six-day-old litter of seven with one puppy already in
        trouble. Nothing leaves this device.
      </p>
    </div>
  );
}

function Home() {
  const litter = useCurrentLitter();
  const view = useLitterView(litter?.id);

  if (litter === undefined) return <Loading />; // still querying
  if (litter === null) return <Empty />; // no litter on this device
  if (!view) return <Loading />;
  return <LitterHome view={view} />;
}

function Weigh() {
  const litter = useCurrentLitter();
  if (litter === undefined) return <Loading />;
  if (litter === null) return <Navigate to="/" replace />;
  return <WeighFlow litterId={litter.id!} />;
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/setup" element={<LitterSetup />} />
        <Route path="/weigh" element={<Weigh />} />
        <Route path="/puppy/:puppyId" element={<PuppyDetail />} />
        <Route path="/passport/:puppyId" element={<PassportExport />} />
        {/* Standalone, read-only, no wallet required. */}
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
