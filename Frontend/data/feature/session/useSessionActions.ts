"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import type { UserLogin, UserRegistration } from "@/lib/api/v1/model";
import { loginSession, logoutSession, registerAccount, type SessionAccount } from "./session";

export interface UseSessionActionsReturn {
  pending: boolean;
  login: (values: UserLogin) => Promise<SessionAccount | null>;
  logout: () => Promise<void>;
  register: (values: UserRegistration) => Promise<void>;
}

export default function useSessionActions(): UseSessionActionsReturn {
  const client = useQueryClient();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  async function perform<T>(action: () => Promise<T>): Promise<T> {
    if (busy.current) throw new Error("Authentication operation already pending");
    busy.current = true; setPending(true);
    try { return await action(); }
    finally { busy.current = false; setPending(false); }
  }
  return { pending,
    login: (values: UserLogin) => perform(() => loginSession(client, values)),
    logout: () => perform(() => logoutSession(client)),
    register: (values: UserRegistration) => perform(() => registerAccount(values)),
  };
}
