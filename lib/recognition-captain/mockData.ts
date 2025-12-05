import { evaluateRecognitionAwards, buildRecognitionSummary } from "./engine";
import {
  type RecognitionDatasetRow,
  type RecognitionProcessResponse,
} from "./types";

export const MOCK_RECOGNITION_ROWS: RecognitionDatasetRow[] = [
  {
    shopNumber: 7012,
    shopName: "Shop 7012 Albuquerque",
    managerName: "Jordan Blake",
    districtName: "NM-01",
    regionName: "Southwest",
    metrics: {
      carCount: 1040,
      carGrowth: 12.4,
      sales: 186000,
      ticket: 179,
      csi: 92.1,
      retention: 47.5,
      safetyScore: 98,
    },
  },
  {
    shopNumber: 6145,
    shopName: "Shop 6145 Baton Rouge",
    managerName: "Katlyn Herrera",
    districtName: "LA-02",
    regionName: "Gulf Coast",
    metrics: {
      carCount: 980,
      carGrowth: 9.1,
      sales: 175400,
      ticket: 184,
      csi: 94.6,
      retention: 51.3,
      safetyScore: 96,
    },
  },
  {
    shopNumber: 5521,
    shopName: "Shop 5521 Arlington",
    managerName: "Quinn Li",
    districtName: "TX-07",
    regionName: "Texas North",
    metrics: {
      carCount: 860,
      carGrowth: 14.2,
      sales: 161900,
      ticket: 188,
      csi: 90.4,
      retention: 43.1,
      safetyScore: 93,
    },
  },
  {
    shopNumber: 4470,
    shopName: "Shop 4470 Mesa",
    managerName: "Dani Ramirez",
    districtName: "AZ-03",
    regionName: "Southwest",
    metrics: {
      carCount: 905,
      carGrowth: 7.8,
      sales: 158200,
      ticket: 175,
      csi: 96.2,
      retention: 55.8,
      safetyScore: 99,
    },
  },
  {
    shopNumber: 3890,
    shopName: "Shop 3890 Charlotte",
    managerName: "Noah Patel",
    districtName: "NC-04",
    regionName: "Atlantic",
    metrics: {
      carCount: 760,
      carGrowth: 5.4,
      sales: 139400,
      ticket: 183,
      csi: 91.7,
      retention: 49.6,
      safetyScore: 95,
    },
  },
  {
    shopNumber: 3211,
    shopName: "Shop 3211 Lexington",
    managerName: "Priya Shah",
    districtName: "KY-01",
    regionName: "Central",
    metrics: {
      carCount: 640,
      carGrowth: 11.6,
      sales: 129900,
      ticket: 203,
      csi: 89.1,
      retention: 52.4,
      safetyScore: 94,
    },
  },
  {
    shopNumber: 2788,
    shopName: "Shop 2788 Lubbock",
    managerName: "Miguel Torres",
    districtName: "TX-11",
    regionName: "Texas West",
    metrics: {
      carCount: 690,
      carGrowth: 8.2,
      sales: 135600,
      ticket: 196,
      csi: 88.8,
      retention: 45.2,
      safetyScore: 92,
    },
  },
  {
    shopNumber: 2440,
    shopName: "Shop 2440 Mobile",
    managerName: "Sydney Drake",
    districtName: "AL-02",
    regionName: "Gulf Coast",
    metrics: {
      carCount: 610,
      carGrowth: 3.7,
      sales: 117800,
      ticket: 193,
      csi: 95.4,
      retention: 58.6,
      safetyScore: 97,
    },
  },
];

export type BuildRecognitionMockOptions = {
  reportingPeriod?: string;
};

export function buildMockRecognitionResponse(options?: BuildRecognitionMockOptions): RecognitionProcessResponse {
  const dataset = MOCK_RECOGNITION_ROWS;
  const awards = evaluateRecognitionAwards(dataset);
  const summary = buildRecognitionSummary(dataset, {
    reportingPeriod: options?.reportingPeriod ?? "P10 2025",
    dataSource: "Mock KPI Upload",
    submissionNotes: [
      "Demo dataset injected so the UI has something to render.",
      "Replace with a real KPI upload to refresh results.",
    ],
  });

  return {
    summary,
    awards,
    dataset,
  };
}
