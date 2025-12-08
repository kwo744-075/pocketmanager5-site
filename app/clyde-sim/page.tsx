'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  Environment,
  ContactShadows,
  RoundedBox,
} from '@react-three/drei';
import * as THREE from 'three';

// ---------- TIME & GAME CONSTANTS ----------

// 1 real second = 1 in-game minute
const GAME_MINUTES_PER_TICK = 1;

// Shop open 8:00 AM
const OPEN_MINUTE = 8 * 60; // 480
// Sim day = 10 hours (8:00–18:00)
const MINUTES_PER_DAY = 10 * 60; // 600
const CLOSING_MINUTE = OPEN_MINUTE + MINUTES_PER_DAY;

// Base average oil change ~20 minutes in-game
const BASE_BAY_SERVICE_TIME_TICKS = 20;

// Generic game goals (gamey, not real shop data)
const TARGET_VISITORS = 60;
const TARGET_REVENUE = 5000;
const TARGET_BIG4 = 35; // percent
const TARGET_SATISFACTION = 75;

const INITIAL_SATISFACTION = 80;
const INITIAL_REPUTATION = 50;

// Failure thresholds
const MIN_SATISFACTION_BEFORE_FAIL = 5;
const MIN_REPUTATION_BEFORE_FAIL = 5;
const MIN_CAPITAL_BEFORE_FAIL = -1000;

// Run length before “week complete”
const MAX_DAYS_PER_RUN = 7;

// LocalStorage key
const SAVE_KEY = 'clydeSimSaveV1';

// Daily cadence storage key
const CADENCE_OVERRIDES_KEY = 'clydeSim_dailyCadenceOverrides_v1';

const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Misc/Monthend',
];

const DEFAULT_DAILY_CADENCE: Record<string, string[]> = {
  Monday: [
    'All Shops Open',
    'Labor Verification',
    "KPI’s & #'s Communication to Team",
    'Deposit Verification',
    'Car Defecit Report',
    'Corrigo',
    'WorkVivo',
    'Workday – check applications',
    'Zendesk Follow-up',
    'Update 5-8 Tracker',
    'Daily Check-ins 12, 2:30, 5',
    'Training Reports & Communication',
    'Inventory Report & Communication',
    'Validation of Previous Week Supplemental Orders',
    'Achievers Recognition & Boosting',
    'Regional Meeting – Goal Setting & AORs',
    'District Meeting',
    'People Review & Schedule Interviews for Week',
    'Update Expense Report',
  ],
  Tuesday: [
    'All Shops Open',
    'Labor Verification',
    "KPI’s & #'s Communication to Team",
    'Deposit Verification',
    'Car Defecit Report',
    'Corrigo',
    'WorkVivo',
    'Workday – check applications',
    'Zendesk Follow-up',
    'Visit Prep',
    'Update 5-8 Tracker',
    'Daily Check-ins 12, 2:30, 5',
    'Schedule Review & Posting (Before you leave the house/office)',
    'Fleet Dashboard',
    'Shop Visits*',
    'Prep for Tomorrow Claims Call',
  ],
  Wednesday: [
    'All Shops Open',
    'Labor Verification (OT)',
    "KPI’s & #'s Communication to Team",
    'Deposit Verification',
    'Car Defecit Report',
    'Corrigo',
    'WorkVivo',
    'Workday – check applications',
    'Zendesk Follow-up',
    'Visit Prep',
    'Update 5-8 Tracker',
    'Daily Check-ins 12, 2:30, 5',
    'Claims Call',
    'NPS Comment Review',
    'Training Reports & Communication',
    'Overtime Notes',
    'Shop Visits*',
  ],
  Thursday: [
    'All Shops Open',
    'Labor Verification (OT)',
    "KPI’s & #'s Communication to Team",
    'Deposit Verification',
    'Car Defecit Report',
    'Corrigo',
    'WorkVivo',
    'Workday – check applications',
    'Zendesk Follow-up',
    'Visit Prep',
    'Update 5-8 Tracker',
    'Daily Check-ins 12, 2:30, 5',
    'Labor Comments added by Noon',
    'Training Reports & Communication',
    'Training Validation – Meet & Greet',
    'Shop Visits*',
  ],
  Friday: [
    'All Shops Open',
    'Labor Verification (OT)',
    "KPI’s & #'s Communication to Team",
    'Deposit Verification',
    'Car Defecit Report',
    'Corrigo',
    'WorkVivo',
    'Workday – check applications',
    'Zendesk Follow-up',
    'Visit Prep',
    'Update 5-8 Tracker',
    'Daily Check-ins 12, 2:30, 5',
    'Full Throttle Friday Visits',
  ],
  Saturday: [
    'All Shops Open',
    'Labor Verification (OT)',
    "KPI’s & #'s Communication to Team",
    'Update 5-8 Tracker',
    'Daily Check-ins 12, 2:30, 5',
    'Visit Prep if Weekend Visit Day',
  ],
  'Misc/Monthend': [
    'SM 1on1’s',
    '1on1 w/ RDO',
    'New Hire Orientation',
    'ASM Meeting',
    'Outlier Calls',
    'Monthend – placeholders x 10',
  ],
};

// 3-bay layout
const BAY_POSITIONS: [number, number, number][] = [
  [-6, 0.01, 9.5],
  [0, 0.01, 9.5],
  [6, 0.01, 9.5],
];

const QUEUE_POSITIONS: [number, number, number][] = [
  [-15, 0.01, 9.5],
  [-15, 0.01, 6],
  [-15, 0.01, 2.5],
  [-15, 0.01, -1],
  [-15, 0.01, -4.5],
  [-15, 0.01, -8],
];

const CAR_COLORS = [
  '#e53935', // red
  '#1e88e5', // blue
  '#43a047', // green
  '#fb8c00', // orange
  '#8e24aa', // purple
  '#fdd835', // yellow
];

// ---------- TYPES ----------

type CarGame = {
  id: number;
  color: string;
  progress: number; // 0–1 in bay
  waitTicks: number; // time spent in queue (ticks)
  ticketValue: number | null;
  hasBig4: boolean;
};

type BayState = {
  index: number;
  car: CarGame | null;
};

type Upgrades = {
  extraTech: number; // faster bay times
  marketing: number; // more traffic
  training: number; // satisfaction + Big4 boost
};

type DailyGoalMetric = 'revenue' | 'big4' | 'visitors' | 'satisfaction';

type DailyGoal = {
  id: number;
  title: string;
  description: string;
  metric: DailyGoalMetric;
  target: number;
  rewardCapital: number;
};

type RandomEvent = {
  id: number;
  name: string;
  description: string;
  trafficMultiplier: number; // affects max cars on lot
  serviceTimeDelta: number; // +/- ticks per car
  satisfactionDeltaPerCompletion: number; // +/- per completed car
};

type ManagerDecisionChoice = {
  id: string;
  label: string;
  description: string;
  effects: {
    satisfaction?: number;
    reputation?: number;
    capital?: number;
    revenue?: number;
  };
};

type ManagerDecision = {
  id: number;
  title: string;
  description: string;
  choices: ManagerDecisionChoice[];
};

type GameState = {
  queue: CarGame[];
  bays: BayState[];
  visitorsServed: number;
  revenue: number;
  big4Pct: number;
  big4Hits: number;
  nextCarId: number;
  currentMinute: number;
  dayIndex: number;
  satisfaction: number;
  reputation: number;
  capital: number;
  upgrades?: Upgrades;
  dailyGoal?: DailyGoal;
  dailyEvent?: RandomEvent;
  pendingDecision?: ManagerDecision;
  decisionsThisDay?: number;
  failed?: boolean;
  lifetimeRevenue?: number;
  lifetimeVisitors?: number;
  bestDayRevenue?: number;
  bestDayVisitors?: number;
};

type Selection =
  | { type: 'none' }
  | { type: 'bay'; index: number }
  | { type: 'queue'; index: number };

type Strategy = 'balanced' | 'speed' | 'upsell' | 'customerCare';

type UpgradeKey = keyof Upgrades;

// Upgrade costs per level
const UPGRADE_COSTS: Record<UpgradeKey, number[]> = {
  extraTech: [2500, 4000, 6000],
  marketing: [1500, 2500, 3500],
  training: [2000, 3000, 4500],
};

// ---------- HELPERS ----------

function randomColor(): string {
  const idx = Math.floor(Math.random() * CAR_COLORS.length);
  return CAR_COLORS[idx];
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function defaultUpgrades(u?: Upgrades): Upgrades {
  return {
    extraTech: u?.extraTech ?? 0,
    marketing: u?.marketing ?? 0,
    training: u?.training ?? 0,
  };
}

function pickDailyGoal(dayIndex: number): DailyGoal {
  const goals: DailyGoal[] = [
    {
      id: 1,
      title: 'Beat the Car Count',
      description: 'Serve at least 45 cars today without tanking satisfaction.',
      metric: 'visitors',
      target: 45,
      rewardCapital: 500,
    },
    {
      id: 2,
      title: 'Big 4 Push',
      description: 'Drive your Big 4-style upsell rate to at least 40%.',
      metric: 'big4',
      target: 40,
      rewardCapital: 750,
    },
    {
      id: 3,
      title: 'Sales Sprint',
      description: 'Crack $6,000 in simulated revenue for the day.',
      metric: 'revenue',
      target: 6000,
      rewardCapital: 1000,
    },
    {
      id: 4,
      title: 'Keep Guests Happy',
      description: 'Finish the day with satisfaction of 80% or higher.',
      metric: 'satisfaction',
      target: 80,
      rewardCapital: 600,
    },
  ];

  const idx = (dayIndex - 1) % goals.length;
  return goals[idx];
}

function pickDailyEvent(dayIndex: number): RandomEvent | undefined {
  const events: (RandomEvent | null)[] = [
    null,
    {
      id: 1,
      name: 'Rainy Day',
      description:
        'Rain slows traffic a bit and techs move carefully. Customers are slightly more patient.',
      trafficMultiplier: 0.8,
      serviceTimeDelta: +2,
      satisfactionDeltaPerCompletion: +0.1,
    },
    {
      id: 2,
      name: 'Tech Called Out',
      description:
        'You are running one tech short. Bays move slower and guests get a little more upset with long waits.',
      trafficMultiplier: 1.0,
      serviceTimeDelta: +4,
      satisfactionDeltaPerCompletion: -0.2,
    },
    {
      id: 3,
      name: 'Coupon Blast',
      description:
        'Marketing just pushed a big coupon. Traffic spikes, but guests are a little more picky.',
      trafficMultiplier: 1.5,
      serviceTimeDelta: 0,
      satisfactionDeltaPerCompletion: -0.1,
    },
    {
      id: 4,
      name: 'Perfect Crew Day',
      description:
        'Crew is dialed in. Bays move quicker and guests are happier leaving.',
      trafficMultiplier: 1.1,
      serviceTimeDelta: -3,
      satisfactionDeltaPerCompletion: +0.3,
    },
  ];

  const idx = dayIndex % events.length;
  const event = events[idx];
  return event ?? undefined;
}

function pickManagerDecision(dayIndex: number): ManagerDecision {
  const decisions: ManagerDecision[] = [
    {
      id: 1,
      title: 'Line Out the Drive',
      description:
        'It’s mid-day and cars are stacked to the street. Crew wants to stay late on a bit of overtime to clear the line.',
      choices: [
        {
          id: 'approve-ot',
          label: 'Approve OT & crush the line',
          description:
            'Spend some cash, keep guests happy, and protect reputation.',
          effects: {
            capital: -300,
            satisfaction: +8,
            reputation: +5,
          },
        },
        {
          id: 'no-ot',
          label: 'Hold the line, no OT',
          description:
            'Protect labor dollars, but some guests won’t be thrilled.',
          effects: {
            satisfaction: -6,
            reputation: -3,
          },
        },
      ],
    },
    {
      id: 2,
      title: 'Free Wiper Promo?',
      description:
        'Vendor offers a quick “Free wiper install with any oil change” promo. Limited supply, but could pop some goodwill.',
      choices: [
        {
          id: 'run-promo',
          label: 'Run the promo',
          description:
            'Costs a bit, but might drive ticket count and smiles.',
          effects: {
            capital: -200,
            revenue: +300,
            satisfaction: +6,
            reputation: +4,
          },
        },
        {
          id: 'skip-promo',
          label: 'Skip it today',
          description: 'Save the spend. No change to the day’s plan.',
          effects: {},
        },
      ],
    },
    {
      id: 3,
      title: 'Crew Break Strategy',
      description:
        'Crew is tired. You can stagger breaks or send everyone at once for a long reset.',
      choices: [
        {
          id: 'stagger',
          label: 'Stagger breaks',
          description:
            'Flow stays steady; crew appreciates the structure but stays on their toes.',
          effects: {
            satisfaction: +4,
            reputation: +2,
          },
        },
        {
          id: 'group-break',
          label: 'All at once, long break',
          description:
            'Crew loves it, but guests hit a temporary hard stop.',
          effects: {
            satisfaction: -3,
            reputation: +3,
          },
        },
      ],
    },
  ];

  const idx = (dayIndex - 1) % decisions.length;
  return decisions[idx];
}

function isGoalMet(goal: DailyGoal | undefined, g: GameState): boolean {
  if (!goal) return false;
  switch (goal.metric) {
    case 'revenue':
      return g.revenue >= goal.target;
    case 'big4':
      return g.big4Pct >= goal.target;
    case 'visitors':
      return g.visitorsServed >= goal.target;
    case 'satisfaction':
      return g.satisfaction >= goal.target;
    default:
      return false;
  }
}

function createInitialGameState(): GameState {
  const bays: BayState[] = BAY_POSITIONS.map((_, index) => ({
    index,
    car: null,
  }));

  const initialQueue: CarGame[] = Array.from({ length: 4 }).map((_, i) => ({
    id: i,
    color: CAR_COLORS[i % CAR_COLORS.length],
    progress: 0,
    waitTicks: 0,
    ticketValue: null,
    hasBig4: false,
  }));

  const dayIndex = 1;

  return {
    queue: initialQueue,
    bays,
    visitorsServed: 0,
    revenue: 0,
    big4Pct: 0,
    big4Hits: 0,
    nextCarId: initialQueue.length,
    currentMinute: OPEN_MINUTE,
    dayIndex,
    satisfaction: INITIAL_SATISFACTION,
    reputation: INITIAL_REPUTATION,
    capital: 0,
    upgrades: defaultUpgrades(),
    dailyGoal: pickDailyGoal(dayIndex),
    dailyEvent: pickDailyEvent(dayIndex),
    pendingDecision: undefined,
    decisionsThisDay: 0,
    failed: false,
    lifetimeRevenue: 0,
    lifetimeVisitors: 0,
    bestDayRevenue: 0,
    bestDayVisitors: 0,
  };
}

// Strategy-driven numbers + upgrades
function getServiceTicks(strategy: Strategy, upgrades?: Upgrades): number {
  const u = defaultUpgrades(upgrades);
  let base: number;
  switch (strategy) {
    case 'speed':
      base = 16;
      break;
    case 'customerCare':
      base = 24;
      break;
    default:
      base = BASE_BAY_SERVICE_TIME_TICKS;
      break;
  }
  const reduction = u.extraTech * 2; // -2 ticks per level
  const result = clamp(base - reduction, 10, 30);
  return result;
}

function applyEventToServiceTicks(
  baseTicks: number,
  event?: RandomEvent
): number {
  if (!event) return baseTicks;
  const adjusted = baseTicks + event.serviceTimeDelta;
  return clamp(adjusted, 8, 40);
}

function getBig4Chance(strategy: Strategy, upgrades?: Upgrades): number {
  const u = defaultUpgrades(upgrades);
  let base: number;
  switch (strategy) {
    case 'upsell':
      base = 0.6;
      break;
    case 'speed':
      base = 0.25;
      break;
    default:
      base = 0.4;
      break;
  }
  const bonus = u.training * 0.05;
  return clamp(base + bonus, 0, 0.9);
}

function getSatisfactionAdjust(
  baseDelta: number,
  strategy: Strategy,
  upgrades?: Upgrades
): number {
  const u = defaultUpgrades(upgrades);
  let result = baseDelta;

  if (strategy === 'upsell') result -= 0.2;
  if (strategy === 'customerCare') result += 0.3;

  result += u.training * 0.15;

  return result;
}

function applyEventToSatisfactionDelta(
  baseDelta: number,
  event?: RandomEvent
): number {
  if (!event) return baseDelta;
  return baseDelta + event.satisfactionDeltaPerCompletion;
}

function applyEventToTrafficCap(
  baseMaxOnLot: number,
  event?: RandomEvent
): number {
  if (!event) return baseMaxOnLot;
  const adjusted = baseMaxOnLot * event.trafficMultiplier;
  return clamp(adjusted, 1, 16);
}

function advanceGame(prev: GameState, strategy: Strategy): GameState {
  if (prev.currentMinute >= CLOSING_MINUTE || prev.failed) {
    return prev;
  }

  const upgrades = defaultUpgrades(prev.upgrades);
  const dailyEvent = prev.dailyEvent;
  const baseServiceTicks = getServiceTicks(strategy, upgrades);
  const serviceTicks = applyEventToServiceTicks(baseServiceTicks, dailyEvent);
  const big4Chance = getBig4Chance(strategy, upgrades);

  const bays: BayState[] = prev.bays.map((b) => ({
    index: b.index,
    car: b.car ? { ...b.car } : null,
  }));
  let queue: CarGame[] = prev.queue.map((c) => ({ ...c }));

  let visitorsServed = prev.visitorsServed;
  let revenue = prev.revenue;
  let big4Hits = prev.big4Hits;
  let nextCarId = prev.nextCarId;
  let satisfaction = prev.satisfaction;
  let reputation = prev.reputation;
  let pendingDecision = prev.pendingDecision;
  const decisionsThisDay = prev.decisionsThisDay ?? 0;

  let currentMinute = prev.currentMinute + GAME_MINUTES_PER_TICK;
  if (currentMinute > CLOSING_MINUTE) currentMinute = CLOSING_MINUTE;

  // Trigger a manager decision once per day around mid-day
  const midpointMinute = OPEN_MINUTE + MINUTES_PER_DAY / 2;
  if (
    !pendingDecision &&
    decisionsThisDay === 0 &&
    currentMinute >= midpointMinute &&
    currentMinute < CLOSING_MINUTE
  ) {
    pendingDecision = pickManagerDecision(prev.dayIndex);
  }

  // Queue wait time
  queue.forEach((car) => {
    car.waitTicks += 1;
  });

  const allBaysFull = bays.every((b) => b.car !== null);
  if (queue.length > 4 && allBaysFull) {
    satisfaction = clamp(satisfaction - 0.5, 0, 100);
  }

  // Progress cars in bays
  bays.forEach((bay) => {
    if (!bay.car) return;
    bay.car.progress += 1 / serviceTicks;

    if (bay.car.progress >= 1) {
      visitorsServed += 1;

      const ticket = bay.car.ticketValue ?? 0;
      revenue += ticket;

      if (bay.car.hasBig4) big4Hits += 1;

      const queueMinutes = bay.car.waitTicks * GAME_MINUTES_PER_TICK;
      const serviceMinutes = serviceTicks * GAME_MINUTES_PER_TICK;
      const totalMinutes = queueMinutes + serviceMinutes;

      let baseDelta = 0;
      if (totalMinutes <= 25) baseDelta = 1.5;
      else if (totalMinutes <= 40) baseDelta = 0.5;
      else baseDelta = -1.5;

      let adjustedDelta = getSatisfactionAdjust(
        baseDelta,
        strategy,
        upgrades
      );
      adjustedDelta = applyEventToSatisfactionDelta(
        adjustedDelta,
        dailyEvent
      );

      satisfaction = clamp(satisfaction + adjustedDelta, 0, 100);

      bay.car = null;
    }
  });

  // Fill empty bays from queue
  bays.forEach((bay) => {
    if (!bay.car && queue.length > 0) {
      const [next, ...rest] = queue;
      queue = rest;

      const ticketValue = 70 + Math.random() * 80; // $70–$150
      const hasBig4 = Math.random() < big4Chance;

      bay.car = {
        ...next,
        progress: 0,
        ticketValue,
        hasBig4,
      };
    }
  });

  // Spawn new cars into queue
  const carsOnLot = queue.length + bays.filter((b) => b.car).length;
  const hour = Math.floor(currentMinute / 60);
  const isRushHour = (hour >= 11 && hour <= 13) || (hour >= 16 && hour <= 18);

  let baseMaxOnLot = 3;
  if (reputation >= 80) baseMaxOnLot += 2;
  else if (reputation >= 50) baseMaxOnLot += 1;

  if (isRushHour) baseMaxOnLot += 2;
  if (satisfaction < 40) baseMaxOnLot -= 1;

  baseMaxOnLot += upgrades.marketing;
  baseMaxOnLot = clamp(baseMaxOnLot, 2, 12);
  baseMaxOnLot = applyEventToTrafficCap(baseMaxOnLot, dailyEvent);

  if (carsOnLot < baseMaxOnLot && currentMinute < CLOSING_MINUTE) {
    const newCar: CarGame = {
      id: nextCarId,
      color: randomColor(),
      progress: 0,
      waitTicks: 0,
      ticketValue: null,
      hasBig4: false,
    };
    queue.push(newCar);
    nextCarId += 1;
  }

  const big4Pct =
    visitorsServed > 0 ? Math.min(100, (big4Hits / visitorsServed) * 100) : 0;

  reputation = clamp(
    reputation + (satisfaction - reputation) * 0.02,
    0,
    100
  );

  const capitalAfter = prev.capital;
  const failNow =
    satisfaction <= MIN_SATISFACTION_BEFORE_FAIL ||
    reputation <= MIN_REPUTATION_BEFORE_FAIL ||
    capitalAfter <= MIN_CAPITAL_BEFORE_FAIL;
  const failed = prev.failed || failNow;

  return {
    queue,
    bays,
    visitorsServed,
    revenue,
    big4Pct,
    big4Hits,
    nextCarId,
    currentMinute,
    dayIndex: prev.dayIndex,
    satisfaction,
    reputation,
    capital: capitalAfter,
    upgrades,
    dailyGoal: prev.dailyGoal,
    dailyEvent,
    pendingDecision,
    decisionsThisDay,
    failed,
    lifetimeRevenue: prev.lifetimeRevenue ?? 0,
    lifetimeVisitors: prev.lifetimeVisitors ?? 0,
    bestDayRevenue: prev.bestDayRevenue ?? 0,
    bestDayVisitors: prev.bestDayVisitors ?? 0,
  };
}

// ---------- 3D SCENE COMPONENTS (VISUALS) ----------

function Ground() {
  return (
    <>
      {/* Main pad */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        position={[0, 0, 0]}
      >
        <planeGeometry args={[80, 70]} />
        <meshStandardMaterial
          color="#11151b"
          metalness={0.1}
          roughness={0.95}
        />
      </mesh>

      {/* Driveway */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 16]}
        receiveShadow
      >
        <planeGeometry args={[40, 22]} />
        <meshStandardMaterial color="#22272f" roughness={0.9} />
      </mesh>

      {/* Front road */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 26]}
        receiveShadow
      >
        <planeGeometry args={[80, 14]} />
        <meshStandardMaterial color="#1a1f26" roughness={0.9} />
      </mesh>

      {/* Road center line */}
      {[-12, -6, 0, 6, 12].map((x, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[x, 0.02, 26]}
        >
          <boxGeometry args={[3, 0.3, 0.1]} />
          <meshStandardMaterial color="#ffeb3b" />
        </mesh>
      ))}

      {/* Side parking lines */}
      {[-5, -1, 3, 7].map((z, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[18, 0.02, z]}
        >
          <boxGeometry args={[10, 0.1, 0.1]} />
          <meshStandardMaterial color="#f5f5f5" />
        </mesh>
      ))}
    </>
  );
}

function LightPoles() {
  const positions: [number, number, number][] = [
    [-22, 0, 18],
    [22, 0, 18],
    [-22, 0, -10],
    [22, 0, -10],
  ];

  return (
    <group>
      {positions.map((pos, i) => (
        <group key={i} position={pos}>
          {/* Pole */}
          <mesh position={[0, 4, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.18, 8, 16]} />
            <meshStandardMaterial
              color="#b0b0b0"
              metalness={0.6}
              roughness={0.3}
            />
          </mesh>

          {/* Lamp head */}
          <RoundedBox
            position={[0, 8.4, 0]}
            args={[1.3, 0.5, 0.9]}
            radius={0.12}
            smoothness={3}
            castShadow
          >
            <meshStandardMaterial
              emissive="#ffffe0"
              emissiveIntensity={2.2}
              color="#eeeeee"
            />
          </RoundedBox>
        </group>
      ))}
    </group>
  );
}

function ShopBuilding() {
  return (
    <group position={[0, 1.6, 0]}>
      {/* Main body */}
      <RoundedBox
        args={[20, 3.2, 10]}
        radius={0.3}
        smoothness={4}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color="#111111"
          metalness={0.2}
          roughness={0.9}
        />
      </RoundedBox>

      {/* Yellow roof band */}
      <RoundedBox
        position={[0, 3.4, -2.5]}
        args={[20, 0.6, 0.7]}
        radius={0.18}
        smoothness={4}
        castShadow
      >
        <meshStandardMaterial color="#ffd54f" metalness={0.3} roughness={0.4} />
      </RoundedBox>

      {/* Red bay frames */}
      {[-6, 0, 6].map((x, i) => (
        <RoundedBox
          key={i}
          position={[x, -0.4, 5.4]}
          args={[3.5, 2.3, 0.4]}
          radius={0.22}
          smoothness={4}
          castShadow
        >
          <meshStandardMaterial
            color="#d00000"
            metalness={0.25}
            roughness={0.5}
          />
        </RoundedBox>
      ))}

      {/* Bay openings */}
      {[-6, 0, 6].map((x, i) => (
        <mesh key={`open-${i}`} position={[x, -0.35, 5.8]}>
          <boxGeometry args={[3, 2, 0.1]} />
          <meshStandardMaterial color="#050505" />
        </mesh>
      ))}

      {/* Front fascia “Take 5” block */}
      <group position={[0, 2.4, 4]}>
        <RoundedBox
          args={[10, 1.5, 0.6]}
          radius={0.25}
          smoothness={4}
          castShadow
        >
          <meshStandardMaterial color="#000000" roughness={0.7} />
        </RoundedBox>

        <RoundedBox
          position={[0, 0.5, 0.05]}
          args={[10, 0.45, 0.08]}
          radius={0.12}
          smoothness={3}
        >
          <meshStandardMaterial color="#ffeb3b" />
        </RoundedBox>

        <RoundedBox
          position={[0, -0.1, 0.06]}
          args={[7.6, 0.8, 0.08]}
          radius={0.16}
          smoothness={3}
        >
          <meshStandardMaterial color="#d00000" />
        </RoundedBox>

        <RoundedBox
          position={[3.7, -0.1, 0.09]}
          args={[1.1, 0.9, 0.1]}
          radius={0.18}
          smoothness={3}
        >
          <meshStandardMaterial color="#ffeb3b" />
        </RoundedBox>
      </group>

      {/* Side office block */}
      <RoundedBox
        position={[12, -0.2, 0]}
        args={[5, 2.5, 6]}
        radius={0.3}
        smoothness={4}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#151515" roughness={0.9} />
      </RoundedBox>

      {/* Office window */}
      <RoundedBox
        position={[13.8, 0.4, 1.8]}
        args={[2.2, 1.2, 0.08]}
        radius={0.15}
        smoothness={3}
      >
        <meshStandardMaterial
          color="#9ecfff"
          metalness={0.6}
          roughness={0.15}
        />
      </RoundedBox>

      {/* Office door */}
      <RoundedBox
        position={[13.8, -0.3, -1.2]}
        args={[1.1, 1.8, 0.08]}
        radius={0.12}
        smoothness={3}
      >
        <meshStandardMaterial color="#e0e0e0" roughness={0.4} />
      </RoundedBox>
    </group>
  );
}

function PylonSign() {
  return (
    <group position={[-22, 0, 22]}>
      {/* Pole */}
      <mesh position={[0, 4.5, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.4, 9, 16]} />
        <meshStandardMaterial
          color="#b0b0b0"
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>

      {/* Top sign */}
      <RoundedBox
        position={[0, 9.6, 0]}
        args={[5, 3.2, 0.7]}
        radius={0.35}
        smoothness={4}
        castShadow
      >
        <meshStandardMaterial color="#000000" roughness={0.6} />
      </RoundedBox>

      {/* Yellow stripe */}
      <RoundedBox
        position={[0, 10.3, 0.01]}
        args={[5, 0.9, 0.1]}
        radius={0.2}
        smoothness={3}
      >
        <meshStandardMaterial color="#ffeb3b" />
      </RoundedBox>

      {/* Red block */}
      <RoundedBox
        position={[0, 9.3, 0.02]}
        args={[4.4, 1.8, 0.1]}
        radius={0.22}
        smoothness={3}
      >
        <meshStandardMaterial color="#d00000" />
      </RoundedBox>

      {/* “5” square */}
      <RoundedBox
        position={[1.1, 9.3, 0.05]}
        args={[1, 1, 0.12]}
        radius={0.2}
        smoothness={3}
      >
        <meshStandardMaterial color="#ffeb3b" />
      </RoundedBox>
    </group>
  );
}

function ReaderBoard() {
  return (
    <group position={[-18, 0, 18]}>
      {/* Pole */}
      <mesh position={[0, 1.3, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.25, 2.6, 12]} />
        <meshStandardMaterial color="#444444" />
      </mesh>

      {/* Board */}
      <RoundedBox
        position={[0, 2.9, 0]}
        args={[6.5, 2.4, 0.5]}
        radius={0.3}
        smoothness={4}
        castShadow
      >
        <meshStandardMaterial color="#111111" roughness={0.8} />
      </RoundedBox>

      {/* Placeholder rows */}
      {[-0.6, 0, 0.6].map((y, i) => (
        <mesh
          key={i}
          position={[0, 2.9 + y, 0.26]}
        >
          <boxGeometry args={[5.8, 0.1, 0.08]} />
          <meshStandardMaterial color="#f5f5f5" />
        </mesh>
      ))}
    </group>
  );
}

type CarVisualProps = {
  position: [number, number, number];
  color: string;
  onClick?: () => void;
};

function Car({ position, color, onClick }: CarVisualProps) {
  const bodyRef = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    if (!bodyRef.current) return;
    const t = clock.getElapsedTime();
    bodyRef.current.position.y =
      0.52 + 0.05 * Math.sin(t * 2 + position[0]);
  });

  return (
    <group
      position={[position[0], 0, position[2]]}
      onClick={onClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'default';
      }}
    >
      {/* Car body */}
      <RoundedBox
        ref={bodyRef}
        position={[0, 0.5, 0]}
        args={[2.4, 0.7, 4.4]}
        radius={0.35}
        smoothness={4}
        castShadow
      >
        <meshStandardMaterial
          color={color}
          metalness={0.9}
          roughness={0.25}
        />
      </RoundedBox>

      {/* Cabin */}
      <RoundedBox
        position={[0, 1.0, -0.1]}
        args={[1.6, 0.7, 2.4]}
        radius={0.3}
        smoothness={3}
        castShadow
      >
        <meshStandardMaterial
          color="#d7e9ff"
          metalness={0.7}
          roughness={0.15}
        />
      </RoundedBox>

      {/* Front lights */}
      {[-0.7, 0.7].map((x, i) => (
        <mesh key={i} position={[x, 0.55, 2.1]} castShadow>
          <boxGeometry args={[0.25, 0.15, 0.1]} />
          <meshStandardMaterial
            emissive="#fff9c4"
            emissiveIntensity={1.5}
            color="#fffde7"
          />
        </mesh>
      ))}

      {/* Rear lights */}
      {[-0.7, 0.7].map((x, i) => (
        <mesh key={`rear-${i}`} position={[x, 0.5, -2.1]} castShadow>
          <boxGeometry args={[0.25, 0.15, 0.1]} />
          <meshStandardMaterial
            emissive="#ff5252"
            emissiveIntensity={1.4}
            color="#ff8a80"
          />
        </mesh>
      ))}

      {/* Wheels – rotated 90° (fix) */}
      {[-0.9, 0.9].map((x) =>
        [-1.6, 1.6].map((z, i) => (
          <mesh
            key={`${x}-${z}-${i}`}
            position={[x, 0.2, z]}
            rotation={[0, 0, Math.PI / 2]} // 90° turn
            castShadow
          >
            <cylinderGeometry args={[0.35, 0.35, 0.4, 20]} />
            <meshStandardMaterial color="#111111" roughness={0.4} />
          </mesh>
        ))
      )}
    </group>
  );
}

type SceneProps = {
  game: GameState;
  setSelection: (selection: Selection) => void;
};

function Scene({ game, setSelection }: SceneProps) {
  return (
    <>
      {/* Environment + sky */}
      <Environment preset="city" background={false} />
      <color attach="background" args={['#02030a']} />

      <hemisphereLight intensity={0.5} groundColor="#222" />
      <directionalLight
        position={[25, 30, 15]}
        intensity={1.7}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-20, 15, -10]} intensity={0.4} />

      <Ground />
      <ShopBuilding />
      <LightPoles />
      <PylonSign />
      <ReaderBoard />

      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.45}
        width={80}
        height={60}
        blur={2.8}
        far={40}
      />

      {game.bays.map((bay) => {
        if (!bay.car) return null;
        const pos = BAY_POSITIONS[bay.index];
        return (
          <Car
            key={`bay-${bay.index}-${bay.car.id}`}
            position={pos}
            color={bay.car.color}
            onClick={() => setSelection({ type: 'bay', index: bay.index })}
          />
        );
      })}

      {game.queue.map((car, idx) => {
        const pos = QUEUE_POSITIONS[Math.min(idx, QUEUE_POSITIONS.length - 1)];
        return (
          <Car
            key={`queue-${car.id}`}
            position={pos}
            color={car.color}
            onClick={() => setSelection({ type: 'queue', index: idx })}
          />
        );
      })}
    </>
  );
}

// ---------- UI HELPERS ----------

function formatCurrency(v: number | undefined | null): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return '0';
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatClock(minutes: number): string {
  const total = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12Raw = h24 % 12;
  const h12 = h12Raw === 0 ? 12 : h12Raw;
  const mm = m.toString().padStart(2, '0');
  return `${h12}:${mm} ${ampm}`;
}

function strategyLabel(strategy: Strategy): string {
  switch (strategy) {
    case 'speed':
      return 'Speed Mode';
    case 'upsell':
      return 'Upsell Mode';
    case 'customerCare':
      return 'Customer Care';
    default:
      return 'Balanced';
  }
}

function upgradeTitle(key: UpgradeKey): string {
  switch (key) {
    case 'extraTech':
      return 'Extra Techs';
    case 'marketing':
      return 'Marketing Push';
    case 'training':
      return 'Training Boost';
  }
}

function upgradeDescription(key: UpgradeKey): string {
  switch (key) {
    case 'extraTech':
      return 'Reduces bay service time. More cars per day.';
    case 'marketing':
      return 'Increases traffic. More cars on the lot.';
    case 'training':
      return 'Improves satisfaction and Big 4 chance.';
  }
}

// ---------- PAGE COMPONENT ----------

export default function ClydeSimPage() {
  const [game, setGame] = useState<GameState>(() => createInitialGameState());
  const [running, setRunning] = useState<boolean>(true);
  const [selection, setSelection] = useState<Selection>({ type: 'none' });
  const [strategy, setStrategy] = useState<Strategy>('balanced');

  // Daily cadence state (defaults + overrides stored in localStorage)
  const [cadenceByDay, setCadenceByDay] = useState<Record<string, string[]>>(() => {
    try {
      if (typeof window === 'undefined') return DEFAULT_DAILY_CADENCE;
      const raw = window.localStorage.getItem(CADENCE_OVERRIDES_KEY);
      if (!raw) return DEFAULT_DAILY_CADENCE;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const merged: Record<string, string[]> = { ...DEFAULT_DAILY_CADENCE };
        Object.keys(parsed).forEach((k) => {
          const v = parsed[k];
          if (Array.isArray(v)) merged[k] = v;
          else if (typeof v === 'string') merged[k] = v.split('\n').map((s) => s.trim()).filter(Boolean);
        });
        return merged;
      }
    } catch {
      // ignore
    }
    return DEFAULT_DAILY_CADENCE;
  });
  const [cadenceEditMode, setCadenceEditMode] = useState(false);
  const [cadenceEditText, setCadenceEditText] = useState<string>('');

  // Determine current day name from dayIndex (fall back to Monday)
  const currentDayName = DAY_NAMES[(game.dayIndex - 1) % DAY_NAMES.length] || 'Monday';

  // Role & cadence loading from server
  const [canEditCadence, setCanEditCadence] = useState(false);
  const [_loadingCadence, setLoadingCadence] = useState(true);
  void _loadingCadence;

  // Load session role and cadence templates from server on mount
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        // fetch session info
        const sRes = await fetch('/api/session/role');
        if (!sRes.ok) return;
        const sJson = await sRes.json();
        const alignment = sJson?.alignment ?? null;

        // derive role server-side mirror of deriveUserRole
        const derive = (alignmentArg: unknown) => {
          if (!alignmentArg || typeof alignmentArg !== 'object') return 'Unknown';
          const memberships = (alignmentArg as { memberships?: unknown }).memberships;
          if (!Array.isArray(memberships) || memberships.length === 0) return 'Unknown';
          const roles = memberships.map((m) => {
            const roleVal = (m as { role?: unknown }).role;
            return String(roleVal ?? '').toLowerCase();
          });
          if (roles.some((r: string) => r.includes('vp'))) return 'VP';
          if (roles.some((r: string) => r.includes('rd') || r.includes('regional'))) return 'RD';
          if (roles.some((r: string) => r.includes('dm') || r.includes('district'))) return 'DM';
          if (roles.some((r: string) => r.includes('shop') || r.includes('employee') || r.includes('ops'))) return 'Shop';
          return 'Unknown';
        };

        const role = derive(alignment);
        // detect explicit admin-like roles in the membership roles (if present)
        const memberships = (alignment as { memberships?: unknown })?.memberships;
        const rolesLower: string[] = Array.isArray(memberships)
          ? (memberships as unknown[]).map((m) => String(((m as Record<string, unknown>)['role']) ?? '').toLowerCase())
          : [];
        const isAdmin = rolesLower.some((r) => r.includes('admin') || r.includes('administrator') || r.includes('super'));

        // only RD, VP, or ADMIN can edit cadence in this UI
        setCanEditCadence(isAdmin || role === 'RD' || role === 'VP');

        // determine scope (shop if logged-in shop present)
        const shopStore = typeof window !== 'undefined' ? window.localStorage.getItem('shopStore') : null;

        // fetch cadence templates
        const q = shopStore ? `?shopId=${encodeURIComponent(shopStore)}` : '';
        const cRes = await fetch(`/api/cadence/templates${q}`);
        if (!cRes.ok) {
          setCadenceByDay(DEFAULT_DAILY_CADENCE);
          setLoadingCadence(false);
          return;
        }
        const cJson = await cRes.json();
        const data = cJson?.data ?? {};
        // merge: defaults with server overrides
        const merged: Record<string, string[]> = { ...DEFAULT_DAILY_CADENCE };
        Object.keys(data).forEach((k) => {
          const v = data[k];
          if (Array.isArray(v)) merged[k] = v;
          else if (typeof v === 'string') merged[k] = v.split('\n').map((s) => s.trim()).filter(Boolean);
        });
        if (mounted) setCadenceByDay(merged);
      } catch (err) {
        console.error('Failed to load session or cadence', err);
        setCadenceByDay(DEFAULT_DAILY_CADENCE);
      } finally {
        if (mounted) setLoadingCadence(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  function saveCadenceForCurrentDay() {
    const lines = cadenceEditText.split('\n').map((s) => s.trim()).filter(Boolean);
    const next = { ...cadenceByDay, [currentDayName]: lines };
    setCadenceByDay(next);
    // persist to server if possible
    (async () => {
      try {
        const shopStore = typeof window !== 'undefined' ? window.localStorage.getItem('shopStore') : null;
        const scope = shopStore ? 'shop' : 'company';
        const scopeId = shopStore ?? null;
        await fetch('/api/cadence/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope, scopeId, day: currentDayName, tasks: lines }),
        });
      } catch {
        // fallback to localStorage for offline/dev
        try {
          window.localStorage.setItem(CADENCE_OVERRIDES_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
    })();
    setCadenceEditMode(false);
  }

  function resetCadenceForCurrentDay() {
    const next = { ...cadenceByDay };
    next[currentDayName] = DEFAULT_DAILY_CADENCE[currentDayName] ?? [];
    setCadenceByDay(next);
    // try to persist reset to server (overwrite with default tasks)
    (async () => {
      try {
        const shopStore = typeof window !== 'undefined' ? window.localStorage.getItem('shopStore') : null;
        const scope = shopStore ? 'shop' : 'company';
        const scopeId = shopStore ?? null;
        await fetch('/api/cadence/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope, scopeId, day: currentDayName, tasks: next[currentDayName] }),
        });
      } catch {
        try {
          window.localStorage.setItem(CADENCE_OVERRIDES_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
    })();
    setCadenceEditMode(false);
  }

  const upgrades = defaultUpgrades(game.upgrades);
  const dailyGoal = game.dailyGoal;
  const dailyEvent = game.dailyEvent;

  const gameWithUpgrades = useMemo<GameState>(() => ({
    ...game,
    upgrades,
    dailyGoal,
    dailyEvent,
    lifetimeRevenue: game.lifetimeRevenue ?? 0,
    lifetimeVisitors: game.lifetimeVisitors ?? 0,
    bestDayRevenue: game.bestDayRevenue ?? 0,
    bestDayVisitors: game.bestDayVisitors ?? 0,
  }), [game, upgrades, dailyGoal, dailyEvent]);

  const dayCompleted =
    gameWithUpgrades.currentMinute >= CLOSING_MINUTE && !gameWithUpgrades.failed;
  const isGameOver = gameWithUpgrades.failed === true;
  const runCompleted =
    gameWithUpgrades.dayIndex > MAX_DAYS_PER_RUN && !isGameOver;

  // Auto-tick loop
  useEffect(() => {
    if (!running || isGameOver) return;

    const interval = setInterval(() => {
      setGame((prev) => advanceGame(prev, strategy));
    }, 1000);

    return () => clearInterval(interval);
  }, [running, strategy, isGameOver]);

  // Pause when manager decision appears
  useEffect(() => {
    if (game.pendingDecision && running) {
      setRunning(false);
    }
  }, [game.pendingDecision, running]);

  // Pause at end of day
  useEffect(() => {
    if (dayCompleted && running) {
      setRunning(false);
    }
  }, [dayCompleted, running]);

  // Pause on game over
  useEffect(() => {
    if (isGameOver && running) {
      setRunning(false);
    }
  }, [isGameOver, running]);

  // Load saved state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 1 && parsed.game) {
        const saved: GameState = parsed.game;
        setGame(() => {
          const safeDayIndex = saved.dayIndex ?? 1;
          return {
            ...createInitialGameState(),
            ...saved,
            upgrades: defaultUpgrades(saved.upgrades),
            dailyGoal: saved.dailyGoal ?? pickDailyGoal(safeDayIndex),
            dailyEvent: saved.dailyEvent ?? pickDailyEvent(safeDayIndex),
            failed: saved.failed ?? false,
            lifetimeRevenue: saved.lifetimeRevenue ?? 0,
            lifetimeVisitors: saved.lifetimeVisitors ?? 0,
            bestDayRevenue: saved.bestDayRevenue ?? 0,
            bestDayVisitors: saved.bestDayVisitors ?? 0,
          };
        });
      }
    } catch (e) {
      console.error('Failed to load Clyde Sim save:', e);
    }
  }, []);

  // Save state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const safe: GameState = {
        ...gameWithUpgrades,
        upgrades: defaultUpgrades(gameWithUpgrades.upgrades),
      };
      const payload = { version: 1, game: safe };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error('Failed to save Clyde Sim game:', e);
    }
  }, [gameWithUpgrades]);

  const activeBays = gameWithUpgrades.bays.filter((b) => b.car).length;
  const aro =
    gameWithUpgrades.visitorsServed > 0
      ? gameWithUpgrades.revenue / gameWithUpgrades.visitorsServed
      : 0;
  const laborPct =
    gameWithUpgrades.revenue > 0
      ? Math.min(45, 22 + activeBays * 3)
      : 0;

  const baseServiceTicks = getServiceTicks(strategy, upgrades);
  const serviceTicks = applyEventToServiceTicks(baseServiceTicks, dailyEvent);
  const goalMet = isGoalMet(dailyGoal, gameWithUpgrades);
  const clockLabel = `${formatClock(gameWithUpgrades.currentMinute)}`;
  const dayLabel = `Day ${gameWithUpgrades.dayIndex}`;
  const pendingDecision = gameWithUpgrades.pendingDecision;

  // Detail panel content
  let detailTitle = 'Nothing selected';
  let detailLines: string[] = [];

  if (selection.type === 'bay') {
    const bay = gameWithUpgrades.bays[selection.index];
    const label = `Bay ${selection.index + 1}`;
    if (bay.car) {
      const progressPct = Math.min(100, bay.car.progress * 100);
      const timeLeftTicks = Math.max(0, 1 - bay.car.progress) * serviceTicks;
      const timeLeftMinutes = timeLeftTicks * GAME_MINUTES_PER_TICK;
      const queueMinutes = bay.car.waitTicks * GAME_MINUTES_PER_TICK;

      detailTitle = `${label} – In Service`;
      detailLines = [
        `Car ID: ${bay.car.id}`,
        `Ticket: $${bay.car.ticketValue?.toFixed(0) ?? '—'}`,
        `Big 4 Upsell: ${bay.car.hasBig4 ? 'YES' : 'No'}`,
        `Queue Wait: ${queueMinutes.toFixed(0)} min`,
        `Progress: ${progressPct.toFixed(0)}%`,
        `Time Left: ${timeLeftMinutes.toFixed(0)} min`,
      ];
    } else {
      detailTitle = `${label} – Empty`;
      detailLines = [`No car currently in this bay.`];
    }
  } else if (selection.type === 'queue') {
    const car = gameWithUpgrades.queue[selection.index];
    if (car) {
      const queueMinutes = car.waitTicks * GAME_MINUTES_PER_TICK;
      detailTitle = `Queue Spot ${selection.index + 1}`;
      detailLines = [
        `Car ID: ${car.id}`,
        `Status: Waiting for open bay`,
        `Queue Wait: ${queueMinutes.toFixed(0)} min`,
        `Assigned Ticket: ${
          car.ticketValue ? `$${car.ticketValue.toFixed(0)}` : 'Not yet'
        }`,
      ];
    } else {
      detailTitle = `Queue`;
      detailLines = [`No car currently in this spot.`];
    }
  }

  const metVisitors = gameWithUpgrades.visitorsServed >= TARGET_VISITORS;
  const metRevenue = gameWithUpgrades.revenue >= TARGET_REVENUE;
  const metBig4 = gameWithUpgrades.big4Pct >= TARGET_BIG4;
  const metSatisfaction =
    gameWithUpgrades.satisfaction >= TARGET_SATISFACTION;

  const startNextDay = () => {
    setGame((prev) => {
      const safeUpgrades = defaultUpgrades(prev.upgrades);
      const prevGoal = prev.dailyGoal;
      const prevGoalMet = isGoalMet(prevGoal, prev);

      let capital = prev.capital + prev.revenue;
      if (prevGoal && prevGoalMet) {
        capital += prevGoal.rewardCapital;
      }

      const lifetimeRevenue =
        (prev.lifetimeRevenue ?? 0) + prev.revenue;
      const lifetimeVisitors =
        (prev.lifetimeVisitors ?? 0) + prev.visitorsServed;
      const bestDayRevenue = Math.max(
        prev.bestDayRevenue ?? 0,
        prev.revenue
      );
      const bestDayVisitors = Math.max(
        prev.bestDayVisitors ?? 0,
        prev.visitorsServed
      );

      const nextDayIndex = prev.dayIndex + 1;
      const nextGoal = pickDailyGoal(nextDayIndex);
      const nextEvent = pickDailyEvent(nextDayIndex);

      const base = createInitialGameState();

      return {
        ...base,
        dayIndex: nextDayIndex,
        reputation: prev.reputation,
        satisfaction: Math.max(60, prev.satisfaction),
        capital,
        upgrades: safeUpgrades,
        dailyGoal: nextGoal,
        dailyEvent: nextEvent,
        pendingDecision: undefined,
        decisionsThisDay: 0,
        failed: false,
        lifetimeRevenue,
        lifetimeVisitors,
        bestDayRevenue,
        bestDayVisitors,
      };
    });
    setSelection({ type: 'none' });
    setRunning(true);
  };

  const resetToDayOne = () => {
    setGame(createInitialGameState());
    setSelection({ type: 'none' });
    setRunning(true);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(SAVE_KEY);
      } catch {
        // ignore
      }
    }
  };

  const handleBuyUpgrade = (key: UpgradeKey) => {
    setGame((prev) => {
      const safeUpgrades = defaultUpgrades(prev.upgrades);
      const level = safeUpgrades[key];
      const costs = UPGRADE_COSTS[key];
      if (level >= costs.length) return prev;
      const cost = costs[level];
      if (prev.capital < cost) return prev;

      return {
        ...prev,
        capital: prev.capital - cost,
        upgrades: {
          ...safeUpgrades,
          [key]: level + 1,
        },
      };
    });
  };

  const canBuyUpgrade = (
    key: UpgradeKey
  ): { canBuy: boolean; cost: number | null } => {
    const safeUpgrades = defaultUpgrades(game.upgrades);
    const level = safeUpgrades[key];
    const costs = UPGRADE_COSTS[key];
    if (level >= costs.length) return { canBuy: false, cost: null };
    const cost = costs[level];
    return { canBuy: gameWithUpgrades.capital >= cost, cost };
  };

  const handleDecisionChoice = (choiceId: string) => {
    setGame((prev) => {
      const decision = prev.pendingDecision;
      if (!decision) return prev;
      const choice = decision.choices.find((c) => c.id === choiceId);
      if (!choice) return prev;

      const eff = choice.effects || {};

      return {
        ...prev,
        pendingDecision: undefined,
        decisionsThisDay: (prev.decisionsThisDay ?? 0) + 1,
        satisfaction: clamp(
          prev.satisfaction + (eff.satisfaction ?? 0),
          0,
          100
        ),
        reputation: clamp(
          prev.reputation + (eff.reputation ?? 0),
          0,
          100
        ),
        capital: prev.capital + (eff.capital ?? 0),
        revenue: prev.revenue + (eff.revenue ?? 0),
      };
    });
    setRunning(true);
  };

  const lifetimeRevenue = gameWithUpgrades.lifetimeRevenue ?? 0;
  const lifetimeVisitors = gameWithUpgrades.lifetimeVisitors ?? 0;
  const bestDayRevenue = gameWithUpgrades.bestDayRevenue ?? 0;
  const bestDayVisitors = gameWithUpgrades.bestDayVisitors ?? 0;

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background:
          'radial-gradient(circle at top, #121420 0, #05060a 55%, #000000 100%)',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
        position: 'relative',
      }}
    >
      {/* HUD */}
      <div
        style={{
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          fontSize: '14px',
          background:
            'linear-gradient(90deg, #111827 0, #0b1020 50%, #111827 100%)',
          borderBottom: '1px solid #111',
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ fontWeight: 600 }}>
          {dayLabel} • {clockLabel}
        </div>
        <div>Visitors: {gameWithUpgrades.visitorsServed}</div>
        <div>Today Revenue: ${formatCurrency(gameWithUpgrades.revenue)}</div>
        <div>ARO: ${aro.toFixed(2)}</div>
        <div>Big 4: {gameWithUpgrades.big4Pct.toFixed(0)}%</div>
        <div>
          Satisfaction: {gameWithUpgrades.satisfaction.toFixed(0)}%
        </div>
        <div>Reputation: {gameWithUpgrades.reputation.toFixed(0)}%</div>
        <div>Labor% (gamey): {laborPct.toFixed(0)}%</div>
        <div style={{ fontWeight: 600, color: '#ffeb3b' }}>
          Bank: ${formatCurrency(gameWithUpgrades.capital)}
        </div>

        {/* Strategy selector */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            marginLeft: 12,
          }}
        >
          {(['balanced', 'speed', 'upsell', 'customerCare'] as Strategy[]).map(
            (s) => {
              const active = strategy === s;
              return (
                <button
                  key={s}
                  onClick={() => setStrategy(s)}
                  style={{
                    padding: '2px 8px',
                    fontSize: 11,
                    borderRadius: 999,
                    border: active ? '1px solid #ffeb3b' : '1px solid #374151',
                    background: active ? '#1e293b' : '#111827',
                    color: active ? '#ffeb3b' : '#e5e7eb',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {strategyLabel(s)}
                </button>
              );
            }
          )}
        </div>

        {/* Daily goal quick peek */}
        {dailyGoal && (
          <div
            style={{
              marginLeft: 12,
              fontSize: 11,
              maxWidth: 220,
              lineHeight: 1.3,
            }}
          >
            <div style={{ fontWeight: 600 }}>
              Goal: {dailyGoal.title}{' '}
              {goalMet && (
                <span style={{ color: '#8bc34a', marginLeft: 4 }}>✅</span>
              )}
            </div>
            <div style={{ color: '#d1d5db' }}>{dailyGoal.description}</div>
          </div>
        )}

        {/* Daily event quick peek */}
        {dailyEvent && (
          <div
            style={{
              marginLeft: 12,
              fontSize: 11,
              maxWidth: 220,
              lineHeight: 1.3,
            }}
          >
            <div style={{ fontWeight: 600, color: '#ffb74d' }}>
              Event: {dailyEvent.name}
            </div>
            <div style={{ color: '#d1d5db' }}>{dailyEvent.description}</div>
          </div>
        )}

        <button
          onClick={() => setRunning((r) => !r)}
          style={{
            marginLeft: 'auto',
            padding: '4px 12px',
            background: running ? '#c62828' : '#16a34a',
            border: 'none',
            borderRadius: 999,
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          {running ? 'Pause' : 'Resume'}
        </button>

        <button
          onClick={resetToDayOne}
          style={{
            marginLeft: 8,
            padding: '4px 12px',
            background: '#374151',
            border: 'none',
            borderRadius: 999,
            color: '#f9fafb',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Reset Day 1
        </button>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1 }}>
          <Canvas
            shadows
            camera={{ position: [30, 26, 32], fov: 50 }}
            gl={{ antialias: true }}
          >
            <OrbitControls
              enablePan
              enableZoom
              enableRotate
              maxPolarAngle={Math.PI / 2.2}
              minDistance={18}
              maxDistance={70}
            />
            <Scene game={gameWithUpgrades} setSelection={setSelection} />
          </Canvas>
        </div>

        {/* Details panel */}
        <div
          style={{
            width: 270,
            padding: '10px 14px',
            borderLeft: '1px solid #111827',
            background:
              'radial-gradient(circle at top, #020617 0, #020617 40%, #020617 100%)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 4,
              borderBottom: '1px solid #1f2933',
              paddingBottom: 4,
            }}
          >
            {detailTitle}
          </div>
          {detailLines.length === 0 ? (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>
              Click a car in the queue or a bay to see details.
            </div>
          ) : (
            detailLines.map((line, idx) => (
              <div key={idx} style={{ fontSize: 12 }}>
                {line}
              </div>
            ))
          )}

          <div
            style={{
              marginTop: 10,
              paddingTop: 6,
              borderTop: '1px solid #1f2933',
              fontSize: 11,
              color: '#9ca3af',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 2 }}>
              Current Strategy: {strategyLabel(strategy)}
            </div>
            {strategy === 'balanced' && (
              <div>
                Balanced flow between speed, upsell, and satisfaction. Good for
                training new managers.
              </div>
            )}
            {strategy === 'speed' && (
              <div>
                Faster bay times, less Big 4. Watch queue shrink but keep an eye
                on ARO and happiness.
              </div>
            )}
            {strategy === 'upsell' && (
              <div>
                Higher Big 4 chance and bigger tickets. Service may slow and
                customers can get cranky if waits get long.
              </div>
            )}
            {strategy === 'customerCare' && (
              <div>
                Slower, more careful visits, but stronger satisfaction. Great
                when reputation is low or complaints are high.
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: 10,
              paddingTop: 6,
              borderTop: '1px solid #1f2933',
              fontSize: 11,
              color: '#9ca3af',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              Upgrades (Lv):
            </div>
            <div>Extra Techs: {upgrades.extraTech}</div>
            <div>Marketing Push: {upgrades.marketing}</div>
            <div>Training Boost: {upgrades.training}</div>
          </div>

          {dailyEvent && (
            <div
              style={{
                marginTop: 10,
                paddingTop: 6,
                borderTop: '1px solid #1f2933',
                fontSize: 11,
                color: '#ffb74d',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 2 }}>
                Today&apos;s Event: {dailyEvent.name}
              </div>
              <div>{dailyEvent.description}</div>
            </div>
          )}

          {/* Daily Workflow Cadence (always visible; editable for RD/VP/ADMIN) */}
          <div
            style={{
              marginTop: 10,
              paddingTop: 6,
              borderTop: '1px solid #1f2933',
              fontSize: 12,
              color: '#d1d5db',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 6,
              }}
            >
              <div style={{ fontWeight: 600 }}>
                Daily Workflow Cadence — {currentDayName}
              </div>
              {canEditCadence && !cadenceEditMode && (
                <button
                  onClick={() => {
                    const lines = cadenceByDay[currentDayName] ?? DEFAULT_DAILY_CADENCE[currentDayName] ?? [];
                    setCadenceEditText(lines.join('\n'));
                    setCadenceEditMode(true);
                  }}
                  style={{
                    padding: '4px 8px',
                    fontSize: 12,
                    borderRadius: 6,
                    border: '1px solid #334155',
                    background: '#0f172a',
                    color: '#f9fafb',
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
              )}
            </div>

            {!cadenceEditMode ? (
              <div style={{ fontSize: 12, color: '#e5e7eb' }}>
                {(cadenceByDay[currentDayName] || DEFAULT_DAILY_CADENCE[currentDayName] || []).map((task, idx) => (
                  <div key={idx} style={{ marginBottom: 6 }}>
                    • {task}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  value={cadenceEditText}
                  onChange={(e) => setCadenceEditText(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: 120,
                    background: '#020617',
                    color: '#f9fafb',
                    border: '1px solid #334155',
                    padding: 8,
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    onClick={() => {
                      // cancel edits
                      const lines = cadenceByDay[currentDayName] ?? DEFAULT_DAILY_CADENCE[currentDayName] ?? [];
                      setCadenceEditText(lines.join('\n'));
                      setCadenceEditMode(false);
                    }}
                    style={{
                      padding: '6px 10px',
                      background: '#374151',
                      border: 'none',
                      borderRadius: 6,
                      color: '#f9fafb',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    onClick={resetCadenceForCurrentDay}
                    style={{
                      padding: '6px 10px',
                      background: '#b91c1c',
                      border: 'none',
                      borderRadius: 6,
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    Reset to Default
                  </button>

                  <button
                    onClick={saveCadenceForCurrentDay}
                    style={{
                      padding: '6px 12px',
                      background: '#16a34a',
                      border: 'none',
                      borderRadius: 6,
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: 10,
              paddingTop: 6,
              borderTop: '1px solid #1f2933',
              fontSize: 11,
              color: '#9ca3af',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              Run Totals
            </div>
            <div>
              Lifetime Revenue: ${formatCurrency(lifetimeRevenue)}
            </div>
            <div>Lifetime Visitors: {lifetimeVisitors}</div>
            <div>Best Day Revenue: ${formatCurrency(bestDayRevenue)}</div>
            <div>Best Day Visitors: {bestDayVisitors}</div>
          </div>

          {selection.type !== 'none' && (
            <button
              onClick={() => setSelection({ type: 'none' })}
              style={{
                marginTop: 'auto',
                padding: '4px 10px',
                background: '#111827',
                border: '1px solid #1f2933',
                borderRadius: 6,
                color: '#e5e7eb',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Clear Selection
            </button>
          )}
        </div>
      </div>

      {/* Manager Decision Overlay */}
      {pendingDecision && !isGameOver && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 25,
          }}
        >
          <div
            style={{
              width: 520,
              maxWidth: '95vw',
              background: '#020617',
              borderRadius: 12,
              border: '1px solid #334155',
              boxShadow: '0 0 26px rgba(0,0,0,0.9)',
              padding: 16,
              fontSize: 13,
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              Manager Call: {pendingDecision.title}
            </div>
            <div
              style={{
                fontSize: 12,
                marginBottom: 10,
                color: '#e5e7eb',
              }}
            >
              {pendingDecision.description}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 8,
                marginBottom: 12,
              }}
            >
              {pendingDecision.choices.map((choice) => (
                <button
                  key={choice.id}
                  onClick={() => handleDecisionChoice(choice.id)}
                  style={{
                    textAlign: 'left',
                    padding: 8,
                    borderRadius: 8,
                    border: '1px solid #334155',
                    background:
                      'linear-gradient(135deg, #0f172a 0, #020617 100%)',
                    color: '#f9fafb',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      marginBottom: 2,
                    }}
                  >
                    {choice.label}
                  </div>
                  <div style={{ fontSize: 12, color: '#d1d5db' }}>
                    {choice.description}
                  </div>
                </button>
              ))}
            </div>

            <div
              style={{
                fontSize: 11,
                color: '#9ca3af',
                textAlign: 'right',
              }}
            >
              Your choice will immediately update satisfaction, reputation, and
              bank.
            </div>
          </div>
        </div>
      )}

      {/* End-of-day summary + Upgrade Shop */}
      {dayCompleted && !isGameOver && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20,
          }}
        >
          <div
            style={{
              width: 820,
              maxWidth: '95vw',
              background: '#020617',
              borderRadius: 12,
              border: '1px solid #1f2937',
              boxShadow: '0 0 30px rgba(0,0,0,0.9)',
              padding: 16,
              fontSize: 13,
              display: 'grid',
              gridTemplateColumns: '1.3fr 1.7fr',
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  marginBottom: 8,
                  borderBottom: '1px solid #1f2937',
                  paddingBottom: 6,
                }}
              >
                End of Day {gameWithUpgrades.dayIndex} Summary
              </div>

              <div style={{ marginBottom: 6 }}>
                <strong>Strategy Used:</strong> {strategyLabel(strategy)}
              </div>

              {dailyEvent && (
                <div style={{ marginBottom: 6, color: '#ffb74d' }}>
                  <strong>Event:</strong> {dailyEvent.name} –{' '}
                  {dailyEvent.description}
                </div>
              )}

              <div style={{ marginBottom: 10 }}>
                <div>
                  Visitors Served: {gameWithUpgrades.visitorsServed}
                </div>
                <div>
                  Today Revenue: ${formatCurrency(gameWithUpgrades.revenue)}
                </div>
                <div>ARO (Avg Ticket): ${aro.toFixed(2)}</div>
                <div>Big 4 Rate: {gameWithUpgrades.big4Pct.toFixed(0)}%</div>
                <div>
                  Satisfaction:{' '}
                  {gameWithUpgrades.satisfaction.toFixed(0)}%
                </div>
                <div>
                  Reputation: {gameWithUpgrades.reputation.toFixed(0)}%
                </div>
                <div>
                  Bank (prior days): $
                  {formatCurrency(gameWithUpgrades.capital)}
                </div>
              </div>

              <div
                style={{
                  marginBottom: 10,
                  borderTop: '1px solid #1f2937',
                  paddingTop: 6,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  Daily Targets (Game Goals)
                </div>
                <div>
                  {metVisitors ? '✅' : '❌'} Visitors:{' '}
                  {gameWithUpgrades.visitorsServed}/{TARGET_VISITORS}
                </div>
                <div>
                  {metRevenue ? '✅' : '❌'} Revenue: $
                  {formatCurrency(gameWithUpgrades.revenue)}/
                  {formatCurrency(TARGET_REVENUE)}
                </div>
                <div>
                  {metBig4 ? '✅' : '❌'} Big 4 Rate:{' '}
                  {gameWithUpgrades.big4Pct.toFixed(0)}% / {TARGET_BIG4}%
                </div>
                <div>
                  {metSatisfaction ? '✅' : '❌'} Satisfaction:{' '}
                  {gameWithUpgrades.satisfaction.toFixed(0)}% /{' '}
                  {TARGET_SATISFACTION}%
                </div>
              </div>

              {dailyGoal && (
                <div
                  style={{
                    marginBottom: 10,
                    borderTop: '1px solid #1f2937',
                    paddingTop: 6,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      marginBottom: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    Scenario Goal: {dailyGoal.title}
                    {goalMet && (
                      <span
                        style={{
                          fontSize: 11,
                          padding: '1px 6px',
                          borderRadius: 999,
                          background: '#16a34a',
                          color: '#fff',
                        }}
                      >
                        Achieved
                      </span>
                    )}
                    {!goalMet && (
                      <span
                        style={{
                          fontSize: 11,
                          padding: '1px 6px',
                          borderRadius: 999,
                          background: '#b91c1c',
                          color: '#fff',
                        }}
                      >
                        Missed
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>
                    {dailyGoal.description}
                  </div>
                  <div style={{ fontSize: 12 }}>
                    Reward: +${formatCurrency(dailyGoal.rewardCapital)} to Bank{' '}
                    {goalMet ? '(awarded on next day start)' : '(if achieved)'}
                  </div>
                </div>
              )}

              <div
                style={{
                  marginTop: 4,
                  borderTop: '1px solid #1f2937',
                  paddingTop: 6,
                  fontSize: 11,
                  color: '#d1d5db',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  Run Totals So Far
                </div>
                <div>
                  Lifetime Revenue (before adding today): $
                  {formatCurrency(lifetimeRevenue)}
                </div>
                <div>Lifetime Visitors: {lifetimeVisitors}</div>
                <div>Best Day Revenue: ${formatCurrency(bestDayRevenue)}</div>
                <div>Best Day Visitors: {bestDayVisitors}</div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 8,
                  marginTop: 8,
                }}
              >
                <button
                  onClick={resetToDayOne}
                  style={{
                    padding: '4px 10px',
                    background: '#374151',
                    border: 'none',
                    borderRadius: 999,
                    color: '#f9fafb',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  Reset to Day 1
                </button>
                {!runCompleted && (
                  <button
                    onClick={startNextDay}
                    style={{
                      padding: '4px 12px',
                      background: '#16a34a',
                      border: 'none',
                      borderRadius: 999,
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Start Next Day
                  </button>
                )}
                {runCompleted && (
                  <button
                    onClick={resetToDayOne}
                    style={{
                      padding: '4px 12px',
                      background: '#f59e0b',
                      border: 'none',
                      borderRadius: 999,
                      color: '#111827',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Week Complete – Start New Run
                  </button>
                )}
              </div>
            </div>

            {/* Upgrade shop */}
            <div
              style={{
                borderLeft: '1px solid #1f2937',
                paddingLeft: 12,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  marginBottom: 6,
                }}
              >
                Upgrade Shop
              </div>
              <div style={{ fontSize: 12, marginBottom: 6, color: '#d1d5db' }}>
                Banked from prior days: $
                {formatCurrency(gameWithUpgrades.capital)} <br />
                (Today&apos;s revenue and any goal bonus are added when you
                start the next day.)
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  gap: 8,
                  overflowY: 'auto',
                  maxHeight: '260px',
                }}
              >
                {(Object.keys(UPGRADE_COSTS) as UpgradeKey[]).map((key) => {
                  const { canBuy, cost } = canBuyUpgrade(key);
                  const level = upgrades[key];
                  const maxed = cost === null;
                  return (
                    <div
                      key={key}
                      style={{
                        borderRadius: 10,
                        border: '1px solid #1f2937',
                        padding: 8,
                        background:
                          'linear-gradient(135deg, #020617 0, #020617 30%, #020617 100%)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {upgradeTitle(key)} (Lv {level})
                        </div>
                        {maxed && (
                          <span
                            style={{
                              fontSize: 10,
                              padding: '2px 6px',
                              borderRadius: 999,
                              background: '#16a34a',
                              color: '#fff',
                            }}
                          >
                            Max
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>
                        {upgradeDescription(key)}
                      </div>
                      {!maxed && (
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: 4,
                          }}
                        >
                          <div style={{ fontSize: 11 }}>
                            Next level cost: $
                            {formatCurrency(cost ?? 0)}
                          </div>
                          <button
                            onClick={() => handleBuyUpgrade(key)}
                            disabled={!canBuy}
                            style={{
                              padding: '3px 8px',
                              fontSize: 11,
                              borderRadius: 999,
                              border: 'none',
                              cursor: canBuy ? 'pointer' : 'not-allowed',
                              background: canBuy ? '#f97316' : '#4b5563',
                              color: '#111827',
                              fontWeight: 600,
                            }}
                          >
                            Buy
                          </button>
                        </div>
                      )}
                      {maxed && (
                        <div
                          style={{
                            fontSize: 11,
                            color: '#a5d6a7',
                            marginTop: 4,
                          }}
                        >
                          Fully upgraded. Nice work.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Game Over / Run Complete */}
      {isGameOver && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 30,
          }}
        >
          <div
            style={{
              width: 520,
              maxWidth: '95vw',
              background: '#020617',
              borderRadius: 12,
              border: '1px solid #b91c1c',
              boxShadow: '0 0 30px rgba(0,0,0,0.95)',
              padding: 16,
              fontSize: 13,
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 8,
                color: '#ef5350',
              }}
            >
              Game Over – Shop in Trouble
            </div>
            <div
              style={{
                fontSize: 12,
                marginBottom: 10,
                color: '#e5e7eb',
              }}
            >
              Reputation, satisfaction, or bank crashed too hard. Use this run
              as coaching: try a different mix of strategy, upgrades, and
              manager calls next time.
            </div>

            <div
              style={{
                marginBottom: 10,
                borderTop: '1px solid #1f2937',
                paddingTop: 6,
                fontSize: 12,
              }}
            >
              <div>Run ended on Day {gameWithUpgrades.dayIndex}.</div>
              <div>
                Total Revenue this run: $
                {formatCurrency(
                  lifetimeRevenue + gameWithUpgrades.revenue
                )}
              </div>
              <div>
                Total Visitors this run:{' '}
                {lifetimeVisitors + gameWithUpgrades.visitorsServed}
              </div>
              <div>
                Best Day Revenue: ${formatCurrency(bestDayRevenue)}
              </div>
              <div>Best Day Visitors: {bestDayVisitors}</div>
              <div>
                Final Satisfaction:{' '}
                {gameWithUpgrades.satisfaction.toFixed(0)}%
              </div>
              <div>
                Final Reputation: {gameWithUpgrades.reputation.toFixed(0)}%
              </div>
              <div>Final Bank: ${formatCurrency(gameWithUpgrades.capital)}</div>
            </div>

            <div
              style={{
                fontSize: 11,
                color: '#9ca3af',
                marginBottom: 10,
              }}
            >
              Tip: For training, try running one game in full <b>Speed Mode</b>,
              one in full <b>Customer Care</b>, and one in <b>Upsell</b> to see
              how the shop behaves differently. Then mix and match.
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
              <button
                onClick={resetToDayOne}
                style={{
                  padding: '4px 12px',
                  background: '#f97316',
                  border: 'none',
                  borderRadius: 999,
                  color: '#111827',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Start New Training Run
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
