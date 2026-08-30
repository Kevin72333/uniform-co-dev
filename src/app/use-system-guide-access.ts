"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export function useSystemGuideAccess(client: SupabaseClient | null, user: User | null): boolean {
  const [access, setAccess] = useState<{ userId: string; allowed: boolean } | null>(null);

  useEffect(() => {
    if (!client || !user) return;
    const activeClient = client;
    const activeUserId = user.id;
    const controller = new AbortController();
    let active = true;
    async function checkAccess() {
      const { data } = await activeClient.auth.getSession();
      const token = data.session?.access_token;
      if (!token || controller.signal.aborted) return;
      try {
        const response = await fetch("/api/system-guide", {
          method: "HEAD",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: controller.signal,
        });
        if (active) setAccess({ userId: activeUserId, allowed: response.ok });
      } catch {
        if (active && !controller.signal.aborted) setAccess({ userId: activeUserId, allowed: false });
      }
    }
    void checkAccess();
    return () => {
      active = false;
      controller.abort();
    };
  }, [client, user]);

  return Boolean(user && access?.userId === user.id && access.allowed);
}
