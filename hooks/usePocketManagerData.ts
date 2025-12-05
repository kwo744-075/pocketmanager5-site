import { cache, use, useMemo } from "react";
import { fetchShopTotals, type PulseTotalsResult } from "@/lib/pulseTotals";
import { fetchPocketManagerSnapshot, type PocketManagerSnapshot } from "@/lib/pocketManagerData";
import { fetchHierarchyRollups } from "@/lib/pulseRollups";
import { fetchMiniPosOverview, type MiniPosOverview } from "@/lib/miniPosOverview";
import {
  EMPTY_PEOPLE_PREVIEW,
  EMPTY_SCHEDULING_PREVIEW,
  fetchEmployeeSchedulingPreview,
  fetchPeopleFeaturePreview,
  type EmployeeSchedulingPreview,
  type PeopleFeaturePreview,
} from "@/lib/peopleFeatureData";
import { getWeekStartISO, todayISO } from "@/lib/dateUtils";

const NULL_PULSE_PROMISE = Promise.resolve<PulseTotalsResult | null>(null);
const NULL_SNAPSHOT_PROMISE = Promise.resolve<PocketManagerSnapshot | null>(null);
const NULL_PEOPLE_PREVIEW_PROMISE = Promise.resolve<PeopleFeaturePreview>(EMPTY_PEOPLE_PREVIEW);
const NULL_SCHEDULING_PREVIEW_PROMISE = Promise.resolve<EmployeeSchedulingPreview>(EMPTY_SCHEDULING_PREVIEW);
const EMPTY_HIERARCHY_ROLLUPS = { district: null, region: null, division: null } as Awaited<ReturnType<typeof fetchHierarchyRollups>>;
const NULL_HIERARCHY_PROMISE = Promise.resolve(EMPTY_HIERARCHY_ROLLUPS);
const NULL_MINI_POS_PROMISE = Promise.resolve<MiniPosOverview | null>(null);

const cachedShopTotals = cache((shopId: string) => fetchShopTotals(shopId));
const cachedSnapshot = cache((shopNumber: string) => fetchPocketManagerSnapshot(shopNumber));
const cachedHierarchyRollups = cache((serialized: string) => {
  const payload = JSON.parse(serialized) as Parameters<typeof fetchHierarchyRollups>[0];
  return fetchHierarchyRollups(payload);
});
const cachedMiniPosOverview = cache((shopId: string) => fetchMiniPosOverview(shopId));
const cachedPeoplePreview = cache((shopNumber: string) => fetchPeopleFeaturePreview(shopNumber));
const cachedSchedulingPreview = cache((shopNumber: string) => fetchEmployeeSchedulingPreview(shopNumber));

export type HierarchyRollupScope = {
  districtId?: string | null;
  regionId?: string | null;
  divisionId?: string | null;
  districtLabel?: string | null;
  regionLabel?: string | null;
  divisionLabel?: string | null;
};

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

export function useHierarchyRollupsSuspense(scope: HierarchyRollupScope | null | undefined) {
  const today = todayISO();
  const weekStart = getWeekStartISO();

  const serialized = useMemo(() => {
    if (!scope) {
      return null;
    }

    const {
      districtId = null,
      regionId = null,
      divisionId = null,
      districtLabel = null,
      regionLabel = null,
      divisionLabel = null,
    } = scope;

    if (!districtId && !regionId && !divisionId) {
      return null;
    }

    return JSON.stringify({
      districtId,
      regionId,
      divisionId,
      districtLabel,
      regionLabel,
      divisionLabel,
      dailyDate: today,
      weekStart,
    });
  }, [scope, today, weekStart]);

  const rollupsPromise = useMemo(() => {
    if (!serialized) {
      return NULL_HIERARCHY_PROMISE;
    }
    return cachedHierarchyRollups(serialized);
  }, [serialized]);

  return use(rollupsPromise);
}

export function useMiniPosOverviewSuspense(shopId: string | null | undefined) {
  const overviewPromise = useMemo(() => {
    if (!shopId) {
      return NULL_MINI_POS_PROMISE;
    }
    return cachedMiniPosOverview(shopId);
  }, [shopId]);

  return use(overviewPromise);
}

export function usePeopleFeaturePreviewSuspense(shopNumber: number | string | null | undefined) {
  const peoplePromise = useMemo(() => {
    if (!shopNumber && shopNumber !== 0) {
      return NULL_PEOPLE_PREVIEW_PROMISE;
    }
    return cachedPeoplePreview(shopNumber.toString());
  }, [shopNumber]);

  return use(peoplePromise);
}

export function useEmployeeSchedulingPreviewSuspense(shopNumber: number | string | null | undefined) {
  const schedulingPromise = useMemo(() => {
    if (!shopNumber && shopNumber !== 0) {
      return NULL_SCHEDULING_PREVIEW_PROMISE;
    }
    return cachedSchedulingPreview(shopNumber.toString());
  }, [shopNumber]);

  return use(schedulingPromise);
}
