import { isSyntheticBootstrapEnabled } from "../lib/env";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main>
      <h1>Attesta foundation</h1>
      <p>Platform foundation is running.</p>
      {isSyntheticBootstrapEnabled() ? <a href="/bootstrap">Bootstrap synthetic tenant</a> : null}
    </main>
  );
}
