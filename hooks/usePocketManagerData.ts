import { cache, use, useMemo } from "react";
import { fetchShopTotals, type PulseTotalsResult } from "@/lib/pulseTotals";
import { fetchPocketManagerSnapshot, type PocketManagerSnapshot } from "@/lib/pocketManagerData";

const NULL_PULSE_PROMISE = Promise.resolve<PulseTotalsResult | null>(null);
const NULL_SNAPSHOT_PROMISE = Promise.resolve<PocketManagerSnapshot | null>(null);

const cachedShopTotals = cache((shopId: string) => fetchShopTotals(shopId));
const cachedSnapshot = cache((shopNumber: string) => fetchPocketManagerSnapshot(shopNumber));

export function usePulseTotalsSuspense(shopId: string | null | undefined) {
  const pulsePromise = useMemo(() => {
    if (!shopId) {
      return NULL_PULSE_PROMISE;
    }
    return cachedShopTotals(shopId);
  }, [shopId]);

  return use(pulsePromise);
}

export function useSnapshotSuspense(shopNumber: number | string | null | undefined) {
  const snapshotPromise = useMemo(() => {
    if (!shopNumber) {
      return NULL_SNAPSHOT_PROMISE;
    }
    const key = shopNumber.toString();
    return cachedSnapshot(key);
  }, [shopNumber]);

  return use(snapshotPromise);
}
