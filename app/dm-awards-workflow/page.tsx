"use client";

import * as React from "react";
const { useEffect, useMemo, useState } = React;

// Types
type EmployeeRecord = {
  employeeId: string;
  employeeName: string;
  shopNumber: string;
  district: string;
  region: string;
  oilChanges: number;
  npsScore: number;
  npsSurveyCount: number;
  carCount?: number;
  // metric fields (may be undefined if missing from report)
  emailCollection?: number;
  pmix?: number;
  big4?: number;
  fuelFilters?: number;
  netAro?: number;
  coolants?: number;
  discounts?: number;
  differentials?: number;
  donationsAmount?: number;
};

type ShopRecord = {
  shopNumber: string;
  shopName: string;
  district: string;
  region: string;
  powerRankerRank?: number;
  carsVsBudget?: number;
  carsVsComp?: number;
  salesVsBudget?: number;
  salesVsComp?: number;
  npsScore: number;
  npsSurveyCount: number;
  carCount?: number;
  emailCollection?: number;
  pmix?: number;
  big4?: number;
  fuelFilters?: number;
  netAro?: number;
  coolants?: number;
  discounts?: number;
  differentials?: number;
  donations?: number;
};

type CustomRow = Record<string, unknown>;

type Qualifiers = { oilChanges: number | null; nps: number | null };

type DmAward = {
  id: number;
  title: string;
  recipientName: string;
  shopNumber: string;
  district: string;
  region: string;
};

type BirthdayEntry = { id: string; name: string; shopNumber: string; date: string };
type AnniversaryEntry = { id: string; name: string; shopNumber: string; date: string; years?: number };
type DonationEntry = { id: string; nameOrShop: string; shopNumber: string; amountOrNote: string };

// Helpers: client-side parsing (CSV via papaparse, XLSX via xlsx)
async function parseEmployeePerformanceReport(file: File): Promise<EmployeeRecord[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'csv') {
    const text = await file.text();
    // papaparse dynamic import
    // @ts-ignore - papaparse may not have local types in this repo
    const Papa: any = (await import('papaparse')).default;
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    const rows = (parsed.data || []).map((r: Record<string, unknown>, idx: number) => mapEmployeeRow(r, idx));
    return rows;
  }
  // xlsx
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const json: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null }) as Record<string, unknown>[];
  return json.map((r, idx) => mapEmployeeRow(r, idx));
}

async function parsePowerRankerReport(file: File): Promise<ShopRecord[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'csv') {
    const text = await file.text();
    // @ts-ignore - papaparse may not have local types in this repo
    const Papa: any = (await import('papaparse')).default;
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    const rows = (parsed.data || []).map((r: Record<string, unknown>, idx: number) => mapShopRow(r, idx));
    return rows;
  }
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const json: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null }) as Record<string, unknown>[];
  return json.map((r, idx) => mapShopRow(r, idx));
}

async function parseDistrictCustomReport(file: File): Promise<CustomRow[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'csv') {
    const text = await file.text();
    // @ts-ignore - papaparse may not have local types in this repo
    const Papa: any = (await import('papaparse')).default;
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    return parsed.data as CustomRow[];
  }
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const json: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null }) as Record<string, unknown>[];
  return json;
}

async function parseDonationsFile(file: File): Promise<DonationEntry[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'csv') {
    const text = await file.text();
    // @ts-ignore - papaparse maybe missing types
    const Papa: any = (await import('papaparse')).default;
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    // Expect columns like employeeId|employeeName|shopNumber|amount
    return (parsed.data || []).map((r: Record<string, unknown>, idx: number) => {
      const id = pickFirst<string>(r, ['employeeId', 'employee id', 'id', 'emp id', 'employee'], String(idx)) as string;
      const name = pickFirst<string>(r, ['employeeName', 'employee name', 'name'], '') as string;
      const shop = pickFirst<string>(r, ['shopNumber', 'shop #', 'shop number', 'shop'], '') as string;
      const amt = Number(pickFirst<number>(r, ['amount', 'donation', 'donations', 'amt'], 0)) || 0;
      return { id: crypto.randomUUID(), nameOrShop: name || id, shopNumber: shop, amountOrNote: String(amt) } as DonationEntry;
    });
  }
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const json: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null }) as Record<string, unknown>[];
  return json.map((r, idx) => {
    const id = pickFirst<string>(r, ['employeeId', 'employee id', 'id', 'emp id', 'employee'], String(idx)) as string;
    const name = pickFirst<string>(r, ['employeeName', 'employee name', 'name'], '') as string;
    const shop = pickFirst<string>(r, ['shopNumber', 'shop #', 'shop number', 'shop'], '') as string;
    const amt = Number(pickFirst<number>(r, ['amount', 'donation', 'donations', 'amt'], 0)) || 0;
    return { id: crypto.randomUUID(), nameOrShop: name || id, shopNumber: shop, amountOrNote: String(amt) } as DonationEntry;
  });
}

// Mapping helpers
function normalizeKey(k: string) {
  return k.replace(/\s|_|\.|#/g, '').toLowerCase();
}

function pickFirst<T>(row: Record<string, unknown>, keys: string[], fallback?: T): unknown {
  for (const k of keys) {
    for (const rk of Object.keys(row)) {
      if (normalizeKey(rk) === normalizeKey(k) && row[rk] != null) return row[rk];
    }
  }
  return fallback;
}

function mapEmployeeRow(r: Record<string, unknown>, idx: number): EmployeeRecord {
  const employeeId = pickFirst<string>(r, ['employeeId', 'employee id', 'id', 'emp id', 'employee'], String(idx));
  const employeeName = (pickFirst<string>(r, ['employeeName', 'employee name', 'name'], '') as string) || String(employeeId ?? idx);
  const shopNumber = pickFirst<string>(r, ['shopNumber', 'shop #', 'shop number', 'shop'], '') as string;
  const district = pickFirst<string>(r, ['district'], '') as string;
  const region = pickFirst<string>(r, ['region'], '') as string;
  const oilChanges = Number(pickFirst<number>(r, ['oilChanges', 'oil changes', 'oil change'], 0)) || 0;
  const npsScore = Number(pickFirst<number>(r, ['npsScore', 'nps', 'nps %', 'nps percent'], 0)) || 0;
  const npsSurveyCount = Number(pickFirst<number>(r, ['npsSurveyCount', 'nps survey count', 'surveys'], 0)) || 0;
  const carCount = Number(pickFirst<number>(r, ['cars', 'car count', 'carCount', 'carsCount', 'carsHandled'], 0)) || undefined;
  const emailCollection = Number(pickFirst<number>(r, ['emailCollection', 'email collection', 'emails'], undefined)) || undefined;
  const pmix = Number(pickFirst<number>(r, ['pmix', 'p-mix', 'p mix'], undefined)) || undefined;
  const big4 = Number(pickFirst<number>(r, ['big4', 'big 4'], undefined)) || undefined;
  const fuelFilters = Number(pickFirst<number>(r, ['fuelFilters', 'fuel filters'], undefined)) || undefined;
  const netAro = Number(pickFirst<number>(r, ['netAro', 'net aro', 'net-aro'], undefined)) || undefined;
  const coolants = Number(pickFirst<number>(r, ['coolants'], undefined)) || undefined;
  const discounts = Number(pickFirst<number>(r, ['discounts'], undefined)) || undefined;
  const differentials = Number(pickFirst<number>(r, ['differentials'], undefined)) || undefined;
  const donationsAmount = Number(pickFirst<number>(r, ['donations', 'donation amount', 'donations amount'], undefined)) || undefined;
  return {
    employeeId: String(employeeId ?? idx),
    employeeName: String(employeeName ?? ''),
    shopNumber: String(shopNumber ?? ''),
    district: String(district ?? ''),
    region: String(region ?? ''),
    oilChanges,
    npsScore,
    npsSurveyCount,
    carCount,
    emailCollection,
    pmix,
    big4,
    fuelFilters,
    netAro,
    coolants,
    discounts,
    differentials,
    donationsAmount,
  } as EmployeeRecord;
}

function mapShopRow(r: Record<string, unknown>, idx: number): ShopRecord {
  const shopNumber = pickFirst<string>(r, ['shopNumber', 'shop #', 'shop number', 'shop'], String(idx)) as string;
  const shopName = pickFirst<string>(r, ['shopName', 'shop name', 'name'], '') as string;
  const district = pickFirst<string>(r, ['district'], '') as string;
  const region = pickFirst<string>(r, ['region'], '') as string;
  const powerRankerRank = Number(pickFirst<number>(r, ['powerRankerRank', 'rank', 'power rank'], undefined)) || undefined;
  const npsScore = Number(pickFirst<number>(r, ['npsScore', 'nps', 'nps %'], 0)) || 0;
  const npsSurveyCount = Number(pickFirst<number>(r, ['npsSurveyCount', 'surveys', 'nps survey count'], 0)) || 0;
  const carCount = Number(pickFirst<number>(r, ['cars', 'car count', 'carCount', 'carsCount', 'carsHandled'], undefined)) || undefined;
  const emailCollection = Number(pickFirst<number>(r, ['emailCollection', 'email collection', 'emails'], undefined)) || undefined;
  const pmix = Number(pickFirst<number>(r, ['pmix', 'p-mix', 'p mix'], undefined)) || undefined;
  const big4 = Number(pickFirst<number>(r, ['big4', 'big 4'], undefined)) || undefined;
  const fuelFilters = Number(pickFirst<number>(r, ['fuelFilters', 'fuel filters'], undefined)) || undefined;
  const netAro = Number(pickFirst<number>(r, ['netAro', 'net aro', 'net-aro'], undefined)) || undefined;
  const coolants = Number(pickFirst<number>(r, ['coolants'], undefined)) || undefined;
  const discounts = Number(pickFirst<number>(r, ['discounts'], undefined)) || undefined;
  const differentials = Number(pickFirst<number>(r, ['differentials'], undefined)) || undefined;
  return {
    shopNumber: String(shopNumber ?? idx),
    shopName: String(shopName ?? ''),
    district: String(district ?? ''),
    region: String(region ?? ''),
    powerRankerRank,
    npsScore,
    npsSurveyCount,
    carCount,
    emailCollection,
    pmix,
    big4,
    fuelFilters,
    netAro,
    coolants,
    discounts,
    differentials,
  } as ShopRecord;
}

function getQualifiedEmployees(allEmployees: EmployeeRecord[], qualifiers: Qualifiers): EmployeeRecord[] {
  if (!qualifiers.oilChanges || qualifiers.nps == null) return [];
  return allEmployees
    .filter((e) => e.oilChanges >= qualifiers.oilChanges! && e.npsScore >= qualifiers.nps!)
    .sort((a, b) => sortByNpsWithTiebreak(a, b));
}

function getQualifiedShops(allShops: ShopRecord[], qualifiers: Qualifiers): ShopRecord[] {
  if (qualifiers.nps == null) return [];
  return allShops
    .filter((s) => s.npsScore >= qualifiers.nps!)
    .sort((a, b) => {
      // prefer lower powerRankerRank (1 is best)
      if ((a.powerRankerRank ?? 999) !== (b.powerRankerRank ?? 999)) return (a.powerRankerRank ?? 999) - (b.powerRankerRank ?? 999);
      return sortByNpsWithTiebreak(a as any, b as any);
    });
}

function getDisqualifiedEmployees(allEmployees: EmployeeRecord[], qualifiers: Qualifiers) {
  return allEmployees.filter((e) => e.oilChanges < (qualifiers.oilChanges ?? 0) || e.npsScore < (qualifiers.nps ?? 0));
}

function getDisqualifiedShops(allShops: ShopRecord[], qualifiers: Qualifiers) {
  return allShops.filter((s) => s.npsScore < (qualifiers.nps ?? 0));
}

function sortByNpsWithTiebreak(a: { npsScore: number; npsSurveyCount: number; carCount?: number }, b: { npsScore: number; npsSurveyCount: number; carCount?: number }) {
  if (b.npsScore !== a.npsScore) return b.npsScore - a.npsScore;
  if (b.npsSurveyCount !== a.npsSurveyCount) return b.npsSurveyCount - a.npsSurveyCount;
  return (b.carCount ?? 0) - (a.carCount ?? 0);
}

function sortByMetricWithCarTiebreak(metricKey: keyof EmployeeRecord | keyof ShopRecord) {
  return (a: any, b: any) => {
    const av = Number(a[metricKey] ?? 0);
    const bv = Number(b[metricKey] ?? 0);
    if (bv !== av) return bv - av;
    return (b.carCount ?? 0) - (a.carCount ?? 0);
  };
}

const maxCardWidth = "max-w-3xl";

export default function DmAwardsWorkflowPage() {
  const [step, setStep] = useState<number>(1);
  const [qualifiers, setQualifiers] = useState<Qualifiers>({ oilChanges: null, nps: null });

  // files
  const [employeeReportFile, setEmployeeReportFile] = useState<File | null>(null);
  const [powerRankerFile, setPowerRankerFile] = useState<File | null>(null);
  const [districtCustomFile, setDistrictCustomFile] = useState<File | null>(null);
  const [donationsFile, setDonationsFile] = useState<File | null>(null);
  const [employeeSampleLoaded, setEmployeeSampleLoaded] = useState(false);
  const [powerSampleLoaded, setPowerSampleLoaded] = useState(false);
  const [periodSampleLoaded, setPeriodSampleLoaded] = useState(false);
  const [donationsSampleLoaded, setDonationsSampleLoaded] = useState(false);

  const [parsing, setParsing] = useState(false);
  const [allEmployees, setAllEmployees] = useState<EmployeeRecord[]>([]);
  const [allShops, setAllShops] = useState<ShopRecord[]>([]);
  const [districtCustomRows, setDistrictCustomRows] = useState<CustomRow[]>([]);
  const [donationRows, setDonationRows] = useState<DonationEntry[]>([]);

  const [parseError, setParseError] = useState<string | null>(null);

  // Manual entries
  const initial5Awards: DmAward[] = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, title: `DM Award #${i + 1}`, recipientName: "", shopNumber: "", district: "", region: "" }));
  const [dmAwards, setDmAwards] = useState<DmAward[]>(initial5Awards);

  // verifications and SM names
  const [verifiedEmployees, setVerifiedEmployees] = useState<Record<string, boolean>>({});
  const [shopSMNames, setShopSMNames] = useState<Record<string, string>>({});

  const [birthdays, setBirthdays] = useState<BirthdayEntry[]>([]);
  const [anniversaries, setAnniversaries] = useState<AnniversaryEntry[]>([]);
  const [donations, setDonations] = useState<DonationEntry[]>([]);

  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const qualifiedEmployees = useMemo(() => getQualifiedEmployees(allEmployees, qualifiers), [allEmployees, qualifiers]);
  const qualifiedShops = useMemo(() => getQualifiedShops(allShops, qualifiers), [allShops, qualifiers]);

  const disqualifiedEmployees = useMemo(() => getDisqualifiedEmployees(allEmployees, qualifiers), [allEmployees, qualifiers]);
  const disqualifiedShops = useMemo(() => getDisqualifiedShops(allShops, qualifiers), [allShops, qualifiers]);

  // derived district/region lists
  const districts = useMemo(() => {
    const set = new Set<string>();
    allEmployees.forEach((e) => e.district && set.add(e.district));
    allShops.forEach((s) => s.district && set.add(s.district));
    return Array.from(set).sort();
  }, [allEmployees, allShops]);

  const regions = useMemo(() => {
    const set = new Set<string>();
    allEmployees.forEach((e) => e.region && set.add(e.region));
    allShops.forEach((s) => s.region && set.add(s.region));
    return Array.from(set).sort();
  }, [allEmployees, allShops]);

  // step 1 next validation
  const step1Valid = !!(
    qualifiers.oilChanges &&
    qualifiers.oilChanges > 0 &&
    qualifiers.nps != null &&
    qualifiers.nps >= 0 &&
    qualifiers.nps <= 100 &&
    ((employeeReportFile || employeeSampleLoaded) && (powerRankerFile || powerSampleLoaded) && (districtCustomFile || periodSampleLoaded))
  );

  // donation tiers
  const donationTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of donationRows) {
      // try to use nameOrShop as key (ideally employeeId)
      const key = d.nameOrShop || d.shopNumber || d.id;
      const amt = Number(d.amountOrNote) || 0;
      map.set(key, (map.get(key) || 0) + amt);
    }
    return map;
  }, [donationRows]);

  const donationTiers = useMemo(() => {
    const arr: { key: string; amount: number; tier?: string }[] = [];
    for (const [k, v] of Array.from(donationTotals.entries())) {
      let tier: string | undefined = undefined;
      if (v >= 1000) tier = 'Platinum';
      else if (v >= 750) tier = 'Golden';
      else if (v >= 500) tier = 'Silver';
      else if (v >= 250) tier = 'Bronze';
      arr.push({ key: k, amount: v, tier });
    }
    return arr.sort((a, b) => b.amount - a.amount);
  }, [donationTotals]);

  // Verification completeness: all qualified employees checked and shops have SM names
  const allVerified = useMemo(() => {
    if (qualifiedEmployees.length === 0 && qualifiedShops.length === 0) return false;
    const employeesOk = qualifiedEmployees.every((e) => Boolean(verifiedEmployees[e.employeeId]));
    const shopsOk = qualifiedShops.every((s) => Boolean(shopSMNames[s.shopNumber] && String(shopSMNames[s.shopNumber]).trim()));
    return employeesOk && shopsOk;
  }, [qualifiedEmployees, qualifiedShops, verifiedEmployees, shopSMNames]);

  async function loadSample(which: "employee" | "power" | "period") {
    try {
      setParsing(true);
      const res = await fetch(`/api/sample-data?which=${which}`);
      if (!res.ok) throw new Error(`Failed to fetch sample: ${res.status}`);
      const body = await res.json();
      // pick first sheet's rows if available
      const sheetNames = Object.keys(body.sheets || {});
      const firstSheet = sheetNames.length ? body.sheets[sheetNames[0]] : [];
      if (which === "employee") {
        // best-effort mapping
        const getVal = (row: Record<string, unknown>, ...keys: string[]) => {
          for (const k of keys) {
            if (k in row && row[k] != null) return row[k] as unknown;
          }
          return undefined;
        };
        const rows: EmployeeRecord[] = (firstSheet || []).map((r: unknown, idx: number) => {
          const row = (r as Record<string, unknown>) ?? {};
          const employeeId = getVal(row, "employeeId", "Employee ID", "EmployeeID");
          const employeeName = getVal(row, "employeeName", "Employee Name", "Name", "Employee");
          const shopNumber = getVal(row, "shopNumber", "Shop", "Shop #", "Shop Number", "ShopNumber");
          const district = getVal(row, "district", "District");
          const region = getVal(row, "region", "Region");
          const oilChanges = getVal(row, "oilChanges", "Oil Changes", "Oil Change");
          const npsScore = getVal(row, "npsScore", "NPS", "NPS %", "NPS Score");
          const npsSurveyCount = getVal(row, "npsSurveyCount", "NPS Survey Count", "Surveys", "Survey Count");
          return {
            employeeId: String(employeeId ?? idx),
            employeeName: String(employeeName ?? ""),
            shopNumber: String(shopNumber ?? ""),
            district: String(district ?? ""),
            region: String(region ?? ""),
            oilChanges: Number(oilChanges ?? 0) || 0,
            npsScore: Number(npsScore ?? 0) || 0,
            npsSurveyCount: Number(npsSurveyCount ?? 0) || 0,
          } as EmployeeRecord;
        });
        setAllEmployees(rows);
        setEmployeeSampleLoaded(true);
      } else if (which === "power") {
        const getVal = (row: Record<string, unknown>, ...keys: string[]) => {
          for (const k of keys) {
            if (k in row && row[k] != null) return row[k] as unknown;
          }
          return undefined;
        };
        const rows: ShopRecord[] = (firstSheet || []).map((r: unknown, idx: number) => {
          const row = (r as Record<string, unknown>) ?? {};
          const shopNumber = getVal(row, "shopNumber", "Shop", "Shop #", "Shop Number", "ShopNumber");
          const shopName = getVal(row, "shopName", "Shop Name", "Period Winner");
          const district = getVal(row, "district", "District");
          const region = getVal(row, "region", "Region");
          const powerRankerRank = getVal(row, "powerRankerRank", "Rank", "Power Rank");
          const npsScore = getVal(row, "npsScore", "NPS", "NPS %");
          const npsSurveyCount = getVal(row, "npsSurveyCount", "NPS Survey Count", "Surveys");
          return {
            shopNumber: String(shopNumber ?? idx),
            shopName: String(shopName ?? ""),
            district: String(district ?? ""),
            region: String(region ?? ""),
            powerRankerRank: powerRankerRank != null ? Number(powerRankerRank) : undefined,
            npsScore: Number(npsScore ?? 0) || 0,
            npsSurveyCount: Number(npsSurveyCount ?? 0) || 0,
          } as ShopRecord;
        });
        setAllShops(rows);
        setPowerSampleLoaded(true);
      } else if (which === "period") {
        setDistrictCustomRows(firstSheet || []);
        setPeriodSampleLoaded(true);
      }
    } catch (err: any) {
      console.error(err);
      setParseError(String(err?.message || err));
    } finally {
      setParsing(false);
    }
  }

  async function onNext() {
    if (step === 1) {
      if (!step1Valid) return;
      setParsing(true);
      setParseError(null);
      try {
        // parse files
        const [employees, shops, custom, donations] = await Promise.all([
          parseEmployeePerformanceReport(employeeReportFile as File),
          parsePowerRankerReport(powerRankerFile as File),
          parseDistrictCustomReport(districtCustomFile as File),
          donationsFile ? parseDonationsFile(donationsFile as File) : Promise.resolve([] as DonationEntry[]),
        ]);
        setAllEmployees(employees);
        setAllShops(shops);
        setDistrictCustomRows(custom);
        setDonationRows(donations || []);
        setStep(2);
      } catch (err: any) {
        setParseError(String(err?.message || err));
      } finally {
        setParsing(false);
      }
    } else if (step < 5) {
      setStep(step + 1);
    } else if (step === 5) {
      // final generate - require verification completeness
      if (!allVerified) {
        setGenerateError("Please verify all qualified employees and fill SM names for qualified shops before generating.");
        return;
      }
      // final generate
      await generatePptx();
    }
  }

  function onBack() {
    if (step > 1) setStep(step - 1);
  }

  async function generatePptx() {
    setLoadingGenerate(true);
    setGenerateError(null);
    try {
      const payload = {
        qualifiedEmployees,
        qualifiedShops,
        birthdays,
        anniversaries,
        donations: donationRows,
        dmAwards,
        verifiedEmployees,
        shopSMNames,
      };

      const res = await fetch("/api/generate-awards-pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "awards.pptx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setGenerateError(String(err?.message || err));
    } finally {
      setLoadingGenerate(false);
    }
  }

  // small UI helpers
  function fileNameOrPlaceholder(file: File | null) {
    return file ? file.name : "No file chosen";
  }

  return (
    <div className={`mx-auto px-4 py-8 ${maxCardWidth}`}> 
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-xl font-semibold mb-4">Awards Workflow</h1>

        {/* Stepper */}
        <div className="flex gap-2 mb-6">
          <button className={`px-3 py-1 rounded ${step === 1 ? "bg-blue-600 text-white" : "bg-gray-100"}`}>#1 Qualifiers & Uploads</button>
          <button className={`px-3 py-1 rounded ${step === 2 ? "bg-blue-600 text-white" : "bg-gray-100"}`}>#2 Confirm Lists & Employee Names</button>
          <button className={`px-3 py-1 rounded ${step === 3 ? "bg-blue-600 text-white" : "bg-gray-100"}`}>#3 Manual Awards</button>
          <button className={`px-3 py-1 rounded ${step === 4 ? "bg-blue-600 text-white" : "bg-gray-100"}`}>#4 Review</button>
          <button className={`px-3 py-1 rounded ${step === 5 ? "bg-blue-600 text-white" : "bg-gray-100"}`}>#5 Generate</button>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div>
            <h2 className="font-semibold mb-3">#1 Qualifiers & uploads</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium">Min Oil Changes</label>
                  <input type="number" min={0} className="mt-1 block w-full border rounded p-2" value={qualifiers.oilChanges ?? ""} onChange={(e) => setQualifiers((s) => ({ ...s, oilChanges: e.target.value ? Number(e.target.value) : null }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium">NPS Qualifier (%)</label>
                  <input type="number" min={0} max={100} className="mt-1 block w-full border rounded p-2" value={qualifiers.nps ?? ""} onChange={(e) => setQualifiers((s) => ({ ...s, nps: e.target.value !== "" ? Number(e.target.value) : null }))} />
                </div>
                <div className="text-xs text-gray-600">Disqualification rules: employee &lt; Min Oil OR NPS &lt; Min NPS = disqualified. Shop &lt; Min NPS = disqualified. NPS ties resolved by highest survey count then car count. Other metric ties by car count.</div>
                {parseError && <div className="text-red-600">{parseError}</div>}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium">#1 Employee Performance Report</label>
                    <input type="file" accept=".csv,.xlsx,.xls" className="mt-1" onChange={(e) => setEmployeeReportFile(e.target.files?.[0] ?? null)} />
                  </div>
                  <div className="text-sm text-gray-700 ml-4">{employeeSampleLoaded ? 'Sample loaded' : fileNameOrPlaceholder(employeeReportFile)}</div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium">#2 Custom Region Report</label>
                    <input type="file" accept=".csv,.xlsx,.xls" className="mt-1" onChange={(e) => setDistrictCustomFile(e.target.files?.[0] ?? null)} />
                  </div>
                  <div className="text-sm text-gray-700 ml-4">{periodSampleLoaded ? 'Sample loaded' : fileNameOrPlaceholder(districtCustomFile)}</div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium">#3 Power Ranker Report</label>
                    <input type="file" accept=".csv,.xlsx,.xls" className="mt-1" onChange={(e) => setPowerRankerFile(e.target.files?.[0] ?? null)} />
                  </div>
                  <div className="text-sm text-gray-700 ml-4">{powerSampleLoaded ? 'Sample loaded' : fileNameOrPlaceholder(powerRankerFile)}</div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium">Donations (no qualifier)</label>
                    <input type="file" accept=".csv,.xlsx,.xls" className="mt-1" onChange={(e) => setDonationsFile(e.target.files?.[0] ?? null)} />
                  </div>
                  <div className="text-sm text-gray-700 ml-4">{donationsSampleLoaded ? 'Sample loaded' : fileNameOrPlaceholder(donationsFile)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Confirm lists and employee names */}
        {step === 2 && (
          <div>
            <h2 className="font-semibold mb-3">#2 Confirm lists and employee names</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium">Employee list (qualifiers applied)</h3>
                <div className="mt-2 border rounded p-2 max-h-72 overflow-auto text-sm">
                  {qualifiedEmployees.length === 0 ? <div className="text-gray-500">No qualified employees (check qualifiers and uploads).</div> : (
                    <div className="space-y-2">
                      {qualifiedEmployees.slice(0, 500).map((e) => (
                        <div key={e.employeeId} className="flex items-center gap-2">
                          <div className="w-12 text-xs text-gray-600">{e.shopNumber}</div>
                          <input className="flex-1 border rounded p-1 text-sm" value={e.employeeName} onChange={(ev) => {
                            const next = allEmployees.map((ae) => ae.employeeId === e.employeeId ? { ...ae, employeeName: ev.target.value } : ae);
                            setAllEmployees(next);
                          }} />
                          <div className="text-xs text-gray-500">NPS: {e.npsScore}% ({e.npsSurveyCount})</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-medium">Shop list (qualifiers applied)</h3>
                <div className="mt-2 border rounded p-2 max-h-72 overflow-auto text-sm">
                  {qualifiedShops.length === 0 ? <div className="text-gray-500">No qualified shops.</div> : (
                    <div className="space-y-2">
                      {qualifiedShops.slice(0, 500).map((s) => (
                        <div key={s.shopNumber} className="flex items-center gap-2">
                          <div className="flex-1">{s.shopName} #{s.shopNumber} — {s.npsScore}%</div>
                          <div className="text-xs text-gray-500">Rank: {s.powerRankerRank ?? '-'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

            {/* Birthday / Anniversary / Donations inputs omitted during syntax debug */}

        {/* Step 3: Manual Awards & Verifications */}
        {step === 3 && (
          <div>
            <h2 className="font-semibold mb-3">#3 Manual Awards & Verifications</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">DM Awards (Manual)</h3>
                <div className="space-y-2 mt-2">
                  {dmAwards.map((award, idx) => (
                    <div key={award.id} className="flex gap-2 items-center">
                      <input className="flex-1 border rounded p-1" placeholder={`Title`} value={award.title} onChange={(e) => setDmAwards((arr) => arr.map((a) => (a.id === award.id ? { ...a, title: e.target.value } : a)))} />
                      <input className="flex-1 border rounded p-1" placeholder="Recipient" value={award.recipientName} onChange={(e) => setDmAwards((arr) => arr.map((a) => (a.id === award.id ? { ...a, recipientName: e.target.value } : a)))} />
                      <input className="w-24 border rounded p-1" placeholder="Shop #" value={award.shopNumber} onChange={(e) => setDmAwards((arr) => arr.map((a) => (a.id === award.id ? { ...a, shopNumber: e.target.value } : a)))} />
                      <select className="border rounded p-1" value={award.district} onChange={(e) => setDmAwards((arr) => arr.map((a) => (a.id === award.id ? { ...a, district: e.target.value } : a)))}>
                        <option value="">District</option>
                        {districts.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      <select className="border rounded p-1" value={award.region} onChange={(e) => setDmAwards((arr) => arr.map((a) => (a.id === award.id ? { ...a, region: e.target.value } : a)))}>
                        <option value="">Region</option>
                        {regions.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-medium">Donations & Tiers</h3>
                <div className="mt-2 border rounded p-2 text-sm">
                  {donationTiers.length === 0 ? <div className="text-gray-500">No donations data.</div> : (
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr><th>Key</th><th>Amount</th><th>Tier</th></tr>
                      </thead>
                      <tbody>
                        {donationTiers.map((d) => (
                          <tr key={d.key}><td>{d.key}</td><td>${d.amount}</td><td>{d.tier ?? '-'}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div>
            <h2 className="font-semibold mb-3">#4 Review</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium">Employee Winners (preview)</h3>
                      <div className="mt-2 border rounded p-2 max-h-64 overflow-auto text-sm">
                        {qualifiedEmployees.length === 0 ? <div className="text-gray-500">No employee winners.</div> : (
                          <div className="space-y-2">
                            {qualifiedEmployees.slice(0, 200).map((e) => (
                              <div key={e.employeeId} className="flex items-center gap-2">
                                <input type="checkbox" checked={Boolean(verifiedEmployees[e.employeeId])} onChange={(ev) => setVerifiedEmployees((m) => ({ ...m, [e.employeeId]: ev.target.checked }))} />
                                <div className="flex-1">{e.employeeName} — {e.shopNumber} — {e.npsScore}% ({e.npsSurveyCount})</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
              </div>

              <div>
                <h3 className="font-medium">Shop Winners & SM name</h3>
                <div className="mt-2 border rounded p-2 max-h-64 overflow-auto text-sm">
                  {qualifiedShops.length === 0 ? <div className="text-gray-500">No shop winners.</div> : (
                    <div className="space-y-2">
                      {qualifiedShops.slice(0, 200).map((s) => (
                        <div key={s.shopNumber} className="flex items-center gap-2">
                          <div className="flex-1">{s.shopName} #{s.shopNumber} — {s.npsScore}%</div>
                          <input list={`sm-list-${s.shopNumber}`} className="w-48 border rounded p-1" placeholder="SM name (or select)" value={shopSMNames[String(s.shopNumber)] ?? ''} onChange={(e) => setShopSMNames((m) => ({ ...m, [String(s.shopNumber)]: e.target.value }))} />
                          <datalist id={`sm-list-${s.shopNumber}`}>
                            {allEmployees.filter((emp) => emp.shopNumber === String(s.shopNumber)).map((emp) => (
                              <option key={emp.employeeId} value={emp.employeeName} />
                            ))}
                          </datalist>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Generate */}
        {step === 5 && (
          <div>
            <h2 className="font-semibold mb-3">#5 Generate</h2>
            <div className="space-y-3">
              <div className="text-sm">Final qualified employees: {qualifiedEmployees.length}</div>
              <div className="text-sm">Final qualified shops: {qualifiedShops.length}</div>
              <div className="text-sm">Donations entries: {donationRows.length}</div>
              <div className="text-sm">Manual awards: {dmAwards.length}</div>
              <div className="text-sm">Ensure all verifications are checked and SM names filled before generating.</div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button className="px-4 py-2 rounded border" onClick={onBack} disabled={step === 1}>Back</button>
          <div>
            {parsing && <span className="text-sm text-gray-600 mr-3">Parsing reports...</span>}
            {generateError && <span className="text-sm text-red-600 mr-3">{generateError}</span>}
            <button
              className="px-4 py-2 rounded bg-blue-600 text-white"
              onClick={onNext}
              disabled={(step === 1 && !step1Valid) || parsing || loadingGenerate || (step === 5 && !allVerified)}
            >
              {step === 5 ? (loadingGenerate ? "Generating..." : "Generate PowerPoint") : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

