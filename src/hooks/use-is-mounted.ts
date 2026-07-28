"use client";

import { useEffect, useState } from "react";

/** True only after the component has mounted on the client. */
export function useIsMounted(): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}
