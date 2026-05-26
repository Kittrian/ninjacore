'use client';

import { useState } from 'react';

type DocType = 'id-document' | 'ssn-document' | 'proof-of-address' | 'cover-letter' | 'other';

const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: 'id-document', label: "Driver's License / ID" },
  { value: 'ssn-document', label: 'SSN Card' },
  { value: 'proof-of-address', label: 'Proof of Address' },
  { value: 'cover-letter', label: 'Cover Letter' },
  { value: 'other', label: 'Other' },
];

type PresignResponse = {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresAt: string;
  maxSize: number;
  headers: { name: string; value: string }[];
};

type AttachResponse = {
  ok: boolean;
  clientId: string;
  documents: Array<{
    id: string;
    storageKey: string;
    publicUrl: string;
    type: string;
    fileName: string;
    contentType: string;
    size?: number;
  }>;
};

export default function UploadDocument({
  clientId,
  onUploaded,
}: {
  clientId: string;
  onUploaded?: (docs: AttachResponse['documents']) => void;
}) {
  const [docType, setDocType] = useState<DocType>('id-document');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setProgress(null);
    setStatus('');
  };

  const handleUpload = async () => {
    if (!file) return;
    setError(null);
    setStatus('Requesting upload URL…');

    try {
      // 1. Ask backend for a presigned PUT URL.
      const presignRes = await fetch('/api/proxy/uploads/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          clientId,
          docType,
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          size: file.size,
        }),
      });
      if (!presignRes.ok) {
        throw new Error(`presign ${presignRes.status}: ${(await presignRes.text()).slice(0, 200)}`);
      }
      const presign = (await presignRes.json()) as PresignResponse;
      if (file.size > presign.maxSize) {
        throw new Error(`File too large (${file.size} > ${presign.maxSize})`);
      }

      // 2. PUT the bytes directly to R2 with progress.
      setStatus('Uploading to R2…');
      await putWithProgress(presign.uploadUrl, file, presign.headers, setProgress);

      // 3. Tell backend about the upload so it lands in SurrealDB.
      setStatus('Recording in SurrealDB…');
      const attachRes = await fetch(`/api/proxy/clients/${encodeURIComponent(clientId)}/documents/attach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          documents: [
            {
              key: presign.key,
              docType,
              fileName: file.name,
              contentType: file.type || 'application/octet-stream',
              size: file.size,
            },
          ],
        }),
      });
      if (!attachRes.ok) {
        throw new Error(`attach ${attachRes.status}: ${(await attachRes.text()).slice(0, 200)}`);
      }
      const attached = (await attachRes.json()) as AttachResponse;
      setStatus(`Uploaded ✓ ${attached.documents[0]?.fileName}`);
      onUploaded?.(attached.documents);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('');
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-wider text-white/50">Upload document</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value as DocType)}
          className="rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none focus:border-cyan-400/60"
        >
          {DOC_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          accept="image/png,image/jpeg,image/webp,image/heic,application/pdf"
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-cyan-600 file:px-3 file:py-1.5 file:text-white hover:file:bg-cyan-500"
        />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={handleUpload}
          disabled={!file || progress !== null}
          className="rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold text-sm px-4 py-2 transition"
        >
          {progress !== null ? `Uploading ${progress}%` : 'Upload to R2'}
        </button>
        {status && <div className="text-xs text-white/70">{status}</div>}
      </div>
      {error && (
        <div className="mt-2 rounded-md bg-red-500/15 border border-red-500/30 text-red-200 text-xs p-2 break-words">
          {error}
        </div>
      )}
      <div className="mt-3 text-[10px] text-white/40 leading-snug">
        File goes <strong>direct from your browser to Cloudflare R2</strong> via a 5-minute presigned URL. The
        server never sees the bytes — just the metadata + storage key, which lands in SurrealDB.
      </div>
    </div>
  );
}

async function putWithProgress(
  url: string,
  file: File,
  headers: { name: string; value: string }[],
  onProgress: (pct: number) => void,
): Promise<void> {
  // Use XHR (not fetch) so we get upload progress events in the browser.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    for (const h of headers) xhr.setRequestHeader(h.name, h.value);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`R2 PUT ${xhr.status}: ${xhr.responseText.slice(0, 200)}`));
    };
    xhr.onerror = () => reject(new Error('R2 PUT network error'));
    xhr.send(file);
  });
}
