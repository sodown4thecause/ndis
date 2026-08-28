"use client";

import { type FormEvent, useState } from "react";

type Fields = {
  name: string;
  siteName: string;
  workerName: string;
  participantName: string;
};

const initialFields: Fields = {
  name: "",
  siteName: "",
  workerName: "",
  participantName: "",
};

const fieldDefinitions: Array<{ key: keyof Fields; label: string }> = [
  { key: "name", label: "Tenant name" },
  { key: "siteName", label: "Site name" },
  { key: "workerName", label: "Worker name" },
  { key: "participantName", label: "Participant name" },
];

type BootstrapResponse = {
  tenant: { id: string; name: string };
};

function isBootstrapResponse(value: unknown): value is BootstrapResponse {
  if (!value || typeof value !== "object" || !("tenant" in value)) return false;
  const tenant = value.tenant;
  return Boolean(
    tenant &&
      typeof tenant === "object" &&
      "id" in tenant &&
      "name" in tenant &&
      typeof tenant.id === "string" &&
      typeof tenant.name === "string",
  );
}

export default function BootstrapForm() {
  const [fields, setFields] = useState(initialFields);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setPending(true);

    try {
      const response = await fetch("/api/tenants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(fields),
      });

      if (!response.ok) {
        setMessage({ kind: "error", text: "Unable to create synthetic tenant. Check the values and try again." });
        return;
      }

      const body: unknown = await response.json();
      if (!isBootstrapResponse(body)) {
        setMessage({ kind: "error", text: "The server returned an unexpected response." });
        return;
      }

      setMessage({
        kind: "success",
        text: `Created synthetic tenant “${body.tenant.name}” (${body.tenant.id}).`,
      });
    } catch {
      setMessage({ kind: "error", text: "Unable to reach the local bootstrap service." });
    } finally {
      setPending(false);
    }
  }

  return (
    <main>
      <h1>Bootstrap a synthetic tenant</h1>
      <p>
        <strong>Synthetic development data only.</strong> This local form creates sample records for the Attesta foundation;
        do not enter real participant or worker information.
      </p>
      <form onSubmit={submit}>
        {fieldDefinitions.map(({ key, label }) => (
          <label key={key} htmlFor={key}>
            {label}
            <input
              id={key}
              name={key}
              type="text"
              required
              value={fields[key]}
              onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))}
            />
          </label>
        ))}
        <button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create synthetic tenant"}
        </button>
      </form>
      {message ? <p role={message.kind === "error" ? "alert" : "status"} aria-live="polite">{message.text}</p> : null}
    </main>
  );
}
