"use client";

import { useEffect } from "react";
import * as functions from "../../lib/api/v1";
import * as hooks from "../../lib/api/v1/hooks";

declare global {
  interface Window {
    datanoTransport?: { functions: typeof functions; hooks: typeof hooks };
    abortTransportTest?: () => void;
  }
}

// Imported only by the temporary test application, never by a product route.
export default function TransportTestPage() {
  useEffect(() => { window.datanoTransport = { functions, hooks }; }, []);
  return <p>Transport integration harness</p>;
}
