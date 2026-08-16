import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, type CollarColour } from '../db/schema';
import { COLLARS, COLLAR_ORDER } from '../db/constants';
import { loadDemoLitter } from '../db/seed';
import { collarHex, toLocalInput } from '../lib/ui';

interface Draft {
  collar: CollarColour;
  name: string;
  sex: 'M' | 'F';
  birthWeight: string;
}

export function LitterSetup() {
  const navigate = useNavigate();
  const [damName, setDamName] = useState('');
  const [sireName, setSireName] = useState('');
  const [breed, setBreed] = useState('');
  const [whelpedAt, setWhelpedAt] = useState(toLocalInput(Date.now()));
  const [puppies, setPuppies] = useState<Draft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const used = new Set(puppies.map((p) => p.collar));
  const nextFree = COLLAR_ORDER.find((c) => !used.has(c));

  function addPuppy() {
    if (!nextFree) return;
    setPuppies((list) => [
      ...list,
      { collar: nextFree, name: '', sex: 'F', birthWeight: '' },
    ]);
  }

  function update(i: number, patch: Partial<Draft>) {
    setPuppies((list) => list.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }

  async function save() {
    setError(null);
    if (!damName.trim()) return setError('The dam needs a name.');
    if (!breed.trim()) return setError('Add the breed.');
    if (puppies.length === 0) return setError('Add at least one puppy.');

    const whelped = new Date(whelpedAt).getTime();
    if (Number.isNaN(whelped)) return setError('Check the whelp date and time.');
    if (whelped > Date.now() + 60_000)
      return setError('The whelp time is in the future.');

    const collars = puppies.map((p) => p.collar);
    if (new Set(collars).size !== collars.length)
      return setError('Two puppies share a collar colour. Each collar is unique.');

    for (const p of puppies) {
      const g = parseInt(p.birthWeight, 10);
      if (!p.birthWeight.trim() || Number.isNaN(g) || g <= 0)
        return setError(`Add a birth weight for ${COLLARS[p.collar].label}.`);
    }

    setBusy(true);
    try {
      const litterId = await db.litters.add({
        damName: damName.trim(),
        sireName: sireName.trim() || undefined,
        breed: breed.trim(),
        whelpedAt: whelped,
      });

      for (const p of puppies) {
        const puppyId = await db.puppies.add({
          litterId,
          collar: p.collar,
          name: p.name.trim() || undefined,
          sex: p.sex,
        });
        // Birth weight is not a field; it is simply the earliest entry.
        await db.weights.add({
          puppyId,
          at: whelped,
          grams: parseInt(p.birthWeight, 10),
          source: 'manual',
        });
      }
      navigate('/');
    } catch {
      setError('Could not save to this device. Check that storage is available.');
    } finally {
      setBusy(false);
    }
  }

  async function demo() {
    setBusy(true);
    await loadDemoLitter();
    navigate('/');
  }

  const field =
    'w-full rounded-lg border border-cream/15 bg-surface px-3 py-2.5 text-cream placeholder:text-muted/60 focus:border-heat';

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <header className="mb-6">
        <h1 className="display text-3xl text-cream">Puppergram</h1>
        <p className="mt-0.5 text-sm text-muted">
          Gram by gram, day by day. Neonatal litter monitor.
        </p>
      </header>

      <section className="card mb-4 px-4 py-4">
        <h2 className="display text-lg text-cream">Start a litter</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Dam</span>
            <input
              className={field}
              value={damName}
              onChange={(e) => setDamName(e.target.value)}
              placeholder="Nala"
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Sire (optional)</span>
            <input
              className={field}
              value={sireName}
              onChange={(e) => setSireName(e.target.value)}
              placeholder="Bruno"
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Breed</span>
            <input
              className={field}
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              placeholder="Labrador Retriever"
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Whelped</span>
            <input
              type="datetime-local"
              className={`num ${field}`}
              value={whelpedAt}
              onChange={(e) => setWhelpedAt(e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="card mb-4 px-4 py-4">
        <div className="flex items-baseline justify-between">
          <h2 className="display text-lg text-cream">Puppies</h2>
          <span className="num text-xs text-muted">{puppies.length}</span>
        </div>

        {puppies.length === 0 && (
          <p className="mt-2 text-sm text-muted">
            Add each puppy with its collar colour. The collar is how the app
            identifies it everywhere else.
          </p>
        )}

        <ul className="mt-3 space-y-3">
          {puppies.map((p, i) => (
            <li key={i} className="rounded-lg border border-cream/10 p-3">
              <div className="flex flex-wrap items-center gap-2">
                {COLLAR_ORDER.map((c) => {
                  const taken = used.has(c) && c !== p.collar;
                  return (
                    <button
                      key={c}
                      type="button"
                      disabled={taken}
                      aria-label={COLLARS[c].label}
                      aria-pressed={p.collar === c}
                      onClick={() => update(i, { collar: c })}
                      title={COLLARS[c].label}
                      className={`h-8 w-8 rounded-full transition-transform disabled:opacity-20 ${
                        p.collar === c ? 'scale-110 ring-2 ring-cream ring-offset-2 ring-offset-surface' : ''
                      }`}
                      style={{
                        background: collarHex(c),
                        boxShadow: 'inset 0 0 0 1px rgba(237,227,216,0.3)',
                      }}
                    />
                  );
                })}
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-xs text-muted">Name (optional)</span>
                  <input
                    className={field}
                    value={p.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                    autoComplete="off"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-muted">Sex</span>
                  <select
                    className={field}
                    value={p.sex}
                    onChange={(e) =>
                      update(i, { sex: e.target.value as 'M' | 'F' })
                    }
                  >
                    <option value="F">Female</option>
                    <option value="M">Male</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-muted">Birth weight (g)</span>
                  <input
                    className={`num ${field}`}
                    inputMode="numeric"
                    value={p.birthWeight}
                    onChange={(e) =>
                      update(i, { birthWeight: e.target.value.replace(/\D/g, '') })
                    }
                    placeholder="420"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={() => setPuppies((l) => l.filter((_, j) => j !== i))}
                className="tap mt-2 text-xs text-muted hover:text-alarm"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={addPuppy}
          disabled={!nextFree}
          className="tap mt-3 w-full rounded-lg border border-dashed border-cream/20 py-3 text-sm text-heat disabled:opacity-40"
        >
          {nextFree
            ? '+ Add puppy'
            : `All ${COLLAR_ORDER.length} collars are in use`}
        </button>
      </section>

      {error && (
        <p className="mb-3 rounded-lg border border-alarm/40 bg-alarm/10 px-3 py-2 text-sm text-cream">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="tap h-14 w-full rounded-xl bg-heat text-base font-semibold text-ink disabled:opacity-40"
      >
        Start monitoring
      </button>

      <div className="mt-6 border-t border-cream/10 pt-4">
        <p className="text-sm text-muted">
          Want to look around first? The demo is a six-day-old litter of seven
          with one puppy already in trouble.
        </p>
        <button
          type="button"
          onClick={demo}
          disabled={busy}
          className="tap mt-2 rounded-lg border border-cream/20 px-4 py-2.5 text-sm text-cream"
        >
          Load demo litter
        </button>
      </div>
    </div>
  );
}
