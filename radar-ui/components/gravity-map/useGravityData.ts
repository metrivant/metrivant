"use client";

import { useEffect, useState } from "react";
import type { GravityNode } from "./gravityMath";

export type { GravityNode };

export type GravityDataState = {
  nodes:   GravityNode[];
  loading: boolean;
  error:   string | null;
};

export function useGravityData(): GravityDataState {
  const [state, setState] = useState<GravityDataState>({
    nodes:   [],
    loading: true,
    error:   null,
  });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/gravity-data")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ ok: boolean; data: GravityNode[] }>;
      })
      .then(({ data }) => {
        if (!cancelled) setState({ nodes: data ?? [], loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            nodes:   [],
            loading: false,
            error:   err instanceof Error ? err.message : "Failed to load",
          });
        }
      });

    return () => { cancelled = true; };
  }, []);

  return state;
}
