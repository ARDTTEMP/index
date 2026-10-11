import { Suspense } from "react";
import PaymentReturn from "./PaymentReturn";
export default function Page() {
  return (
    <Suspense
      fallback={<main className="container section">Vérification…</main>}
    >
      <PaymentReturn />
    </Suspense>
  );
}
