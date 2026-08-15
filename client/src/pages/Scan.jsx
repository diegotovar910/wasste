import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api.js';
import { useAction, useApi } from '../hooks/useApi.js';
import { Card, CardHeader } from '../components/Card.jsx';
import { ClassificationResult } from '../components/ClassificationResult.jsx';
import { ErrorState, LoadingBlock } from '../components/States.jsx';
import { CATEGORY_LIST } from '../data/wasteCategories.js';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

/** Section 14 - the AI waste scanner. */
export default function Scan() {
  const bins = useApi((signal) => api.bins(signal), []);

  const [binId, setBinId] = useState('');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const classify = useAction(
    useCallback((payload) => api.classify(payload), []),
  );

  // Default to the first bin so the demo can record straight away.
  useEffect(() => {
    if (!binId && bins.data?.bins?.length) setBinId(bins.data.bins[0].id || bins.data.bins[0]._id);
  }, [bins.data, binId]);

  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  const selectFile = (nextFile) => {
    if (!nextFile) return;

    if (!ACCEPTED.includes(nextFile.type)) {
      setFileError('Please upload a valid image (JPEG, PNG, WebP or HEIC).');
      return;
    }
    if (nextFile.size > MAX_BYTES) {
      setFileError('That image is larger than 5 MB. Please choose a smaller one.');
      return;
    }

    setFileError(null);
    setResult(null);
    classify.clearError();
    setFile(nextFile);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(nextFile);
    });
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setFileError(null);
    classify.clearError();
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  };

  const analyse = async () => {
    if (!file) return;
    const response = await classify.run({ file, binId: binId || undefined, record: Boolean(binId) });
    if (response) setResult(response);
  };

  const binOptions = bins.data?.bins || [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">AI waste scanner</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-secondary">
          This is what happens inside a Wasste bin: the camera photographs the item, Gemini Vision
          identifies it, and the system routes it to one of four underground sub-bins and records the
          event.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <CardHeader
            title="Waste scanner"
            subtitle="Upload or photograph a single waste item"
          />

          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-ink-secondary">Wasste bin</span>
              {bins.isLoading ? (
                <LoadingBlock height="h-10" className="mt-1.5" />
              ) : (
                <select
                  value={binId}
                  onChange={(event) => setBinId(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink"
                >
                  <option value="">Do not record - classify only</option>
                  {binOptions.map((bin) => (
                    <option key={bin.id || bin._id} value={bin.id || bin._id}>
                      {bin.name}
                    </option>
                  ))}
                </select>
              )}
              <span className="mt-1 block text-[11px] text-ink-muted">
                The classified item is added to this bin&apos;s statistics.
              </span>
            </label>

            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                selectFile(event.dataTransfer.files?.[0]);
              }}
              className="rounded-xl border border-dashed border-hairline p-4"
            >
              {previewUrl ? (
                <div className="space-y-3">
                  <img
                    src={previewUrl}
                    alt="Selected waste item"
                    className="mx-auto max-h-64 w-auto rounded-lg object-contain"
                  />
                  <p className="text-center text-[11px] text-ink-muted">
                    {file?.name} · {(file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
              ) : (
                <div className="py-10 text-center">
                  <p className="text-sm font-medium text-ink">Drop an image here</p>
                  <p className="mt-1 text-xs text-ink-muted">JPEG, PNG or WebP, up to 5 MB</p>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => selectFile(event.target.files?.[0])}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => selectFile(event.target.files?.[0])}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-hairline px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-inset"
              >
                Upload image
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="rounded-lg border border-hairline px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-inset"
              >
                Take photo
              </button>
              {file ? (
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg border border-hairline px-3 py-2 text-xs font-semibold text-ink-secondary transition-colors hover:bg-inset"
                >
                  Clear
                </button>
              ) : null}

              <button
                type="button"
                onClick={analyse}
                disabled={!file || classify.isRunning}
                className="ml-auto rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-surface transition-opacity hover:opacity-85 disabled:opacity-40"
              >
                {classify.isRunning ? 'Analysing…' : 'Analyse waste'}
              </button>
            </div>

            {fileError ? (
              <p className="rounded-lg border border-hairline bg-inset p-3 text-xs text-ink-secondary">
                {fileError}
              </p>
            ) : null}
          </div>
        </Card>

        <div className="space-y-4">
          {classify.error ? (
            <ErrorState
              error={classify.error}
              onRetry={analyse}
              title="AI analysis is temporarily unavailable"
            />
          ) : null}

          {classify.isRunning && !result ? (
            <Card className="p-5">
              <p className="text-xs text-ink-muted" role="status">
                Sending the image to Gemini Vision…
              </p>
              <div className="mt-4 space-y-2">
                <div className="h-3 w-2/3 animate-pulse rounded bg-inset" />
                <div className="h-3 w-full animate-pulse rounded bg-inset" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-inset" />
              </div>
            </Card>
          ) : null}

          {result ? <ClassificationResult result={result} /> : null}

          {!result && !classify.isRunning && !classify.error ? (
            <Card className="p-5">
              <CardHeader
                title="The four sub-bins"
                subtitle="Every item is routed to exactly one of these, or flagged unknown"
              />
              <ul className="mt-4 space-y-3">
                {CATEGORY_LIST.map((category) => (
                  <li key={category.category} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 h-full w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: category.color, minHeight: 34 }}
                    />
                    <div>
                      <p className="text-xs font-semibold text-ink">{category.label}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">
                        {category.examples}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-hairline pt-3 text-[11px] leading-relaxed text-ink-muted">
                If the model cannot place an item confidently it returns <strong>Unknown</strong>{' '}
                rather than guessing, and nothing is added to a sub-bin.
              </p>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
