"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./PublicForm";
import { text, type Locale } from "@/lib/domain";
export default function GroupInvite({
  token,
  locale: l,
}: {
  token: string;
  locale: Locale;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <div style={{ marginTop: 25 }}>
      <p>
        {text(
          l,
          "Votre compte doit être approuvé et correspondre à la catégorie du groupe, ou avoir été ajouté par un administrateur.",
          "Your account must be approved and match the group category, or have been added by an administrator.",
        )}
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <button
        style={{ marginTop: 25 }}
        className="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const d = await api({ op: "join_group", token });
            router.push("/dashboard/groups/" + d.group_id);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Error");
            setBusy(false);
          }
        }}
      >
        {text(l, "Rejoindre le groupe", "Join group")}
      </button>
    </div>
  );
}
