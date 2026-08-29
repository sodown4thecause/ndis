import { notFound } from "next/navigation";
import { isSyntheticBootstrapEnabled } from "../../lib/env";
import BootstrapForm from "./form";

export const dynamic = "force-dynamic";

export default function BootstrapPage() {
  if (!isSyntheticBootstrapEnabled()) notFound();
  return <BootstrapForm />;
}
