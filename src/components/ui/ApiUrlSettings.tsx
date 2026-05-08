import { useState } from "react";
import { getApiUrl, setApiUrl } from "@/lib/config";

/**
 * Lets the user point this build at any backend without rebuilding. Persists to
 * localStorage["conquest.apiUrl"], which `getApiUrl()` reads on every request.
 */
export function ApiUrlSettings({ onChange }: { onChange?: (url: string) => void }) {
  const [value, setValue] = useState(getApiUrl());
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  function save() {
    setApiUrl(value);
    setSaved(true);
    onChange?.(value);
    setTimeout(() => setSaved(false), 1200);
  }

  function reset() {
    setApiUrl(null);
    const fresh = getApiUrl();
    setValue(fresh);
    onChange?.(fresh);
  }

  return (
    <div className="rounded border border-parchment/20 bg-ocean p-3 text-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-parchment/80 hover:text-parchment"
      >
        <span>API endpoint: {getApiUrl()}</span>
        <span>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-2">
          <label className="text-xs uppercase tracking-wider text-parchment/60">
            Backend URL
          </label>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="http://localhost:8000"
            className="rounded bg-ocean-deep px-2 py-1 text-parchment outline-none ring-1 ring-parchment/20 focus:ring-amber-400"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              className="rounded bg-amber-500 px-3 py-1 text-ocean-deep hover:bg-amber-400"
            >
              {saved ? "Saved ✓" : "Save"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded border border-parchment/30 px-3 py-1 text-parchment hover:bg-parchment/10"
            >
              Reset to default
            </button>
          </div>
          <p className="text-xs text-parchment/50">
            Resolution order: localStorage → /config.js → VITE_API_URL → http://localhost:8000.
            Changes apply immediately to subsequent requests.
          </p>
        </div>
      )}
    </div>
  );
}
