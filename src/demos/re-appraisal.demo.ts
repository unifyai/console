/**
 * Demo Recording: Real Estate — Property Valuation & Comps
 *
 * Produces three video clips for the landing page case study.
 *
 * IMPORTANT DESIGN RULES:
 * - All real-time messages use DOM injection ONLY (no seedLogEntry, no send API)
 * - Pre-seeded messages (loaded before page render) use seedLogEntry
 * - Polling is blocked after initial load to protect injected DOM
 * - Photos use data URIs (static serving is unreliable)
 * - Each test writes timing markers for automatic post-processing (trim)
 *
 * Run:
 *   npx playwright test --config src/demos/playwright.config.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { test } from '@playwright/test';
import {
  createUser,
  createAssistant,
  createEmailLogin,
  seedChatInfrastructure,
  ensureProject,
} from '../tests/helpers/seeds/client';
import {
  loginAndNavigate,
  injectCursorOverlay,
  hideRecordingNoise,
  fixAvatarPhotos,
  zoomOnChat,
  setupRecordingRoutes,
  blockChatPolling,
  waitForChatReady,
  moveTo,
  seedLogEntry,
  pushActionEvent,
  preseedMessage,
  typeAndSendMessage,
  showTypingThenReply,
  createLocalAttachment,
  showFilePreview,
  clickExpandAll,
  writeMarkers,
} from './helpers';

/* eslint-disable @typescript-eslint/naming-convention */

let tsCounter = 0;
function ts(): string {
  const d = new Date();
  d.setSeconds(d.getSeconds() + tsCounter++);
  return d.toISOString();
}

let msgIdCounter = 70_000;
function nextMsgId(): number {
  return msgIdCounter++;
}

// ---------------------------------------------------------------------------
// Shared constants — exact message text used across clips
// ---------------------------------------------------------------------------

const USER_MSG_1 =
  'Morning Aria. New valuation instruction from Meridian Capital — 45 Moorgate, EC2R. Grade A office, refurbished 2023, 12,500 sq ft NIA. Single-let to a fintech tenant, 10-year lease with break at year 5. Passing rent £87.50/sq ft. Need a Market Value assessment.';

const ARIA_REPLY_1 =
  "Good morning James. Instruction noted:\n\n**Subject:** 45 Moorgate, London EC2R\n**Type:** Grade A office, refurbished 2023\n**Size:** 12,500 sq ft NIA\n**Tenancy:** Single-let, fintech tenant, 10yr from 2024, break yr 5\n**Passing rent:** £87.50/sq ft (£1,093,750 pa)\n**Basis:** Market Value (Red Book)\n\nI'll search CoStar, EGi, Land Registry and our internal records for City of London offices within 0.5 miles, 8,000–18,000 sq ft, last 12 months. Shortlist ready within the hour.";

const USER_MSG_2 =
  "Pay particular attention to the break clause — that 5-year break will compress the yield. Also check the tenant's covenant strength from Companies House.";

const ARIA_REPLY_2 =
  "Understood. I'll apply a yield premium for the break clause exposure and research the tenant's financials via Companies House. I'll note the covenant limitation in the assumptions section.\n\nStarting comparable search now.";

// ---------------------------------------------------------------------------
// Screenshot SVGs for action tree ToolLoop content
// ---------------------------------------------------------------------------

const ASSET_DIR = path.resolve(__dirname, '../../public/demos');
const CONSOLE_URL = 'http://localhost:3000';

function writeWorkflowSvgs(): void {
  fs.mkdirSync(ASSET_DIR, { recursive: true });
  const svgs: Record<string, string> = {
    'costar-screenshot.svg': costarScreenshotSvg(),
    'land-registry-screenshot.svg': landRegistryScreenshotSvg(),
    'companies-house-screenshot.svg': companiesHouseScreenshotSvg(),
    'adjustment-table.svg': adjustmentTableSvg(),
  };
  for (const [name, content] of Object.entries(svgs)) {
    fs.writeFileSync(path.join(ASSET_DIR, name), content);
  }
}

function svgUrl(name: string): string {
  return `${CONSOLE_URL}/demos/${name}`;
}

function costarScreenshotSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="420" viewBox="0 0 800 420">
    <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d2240"/><stop offset="1" stop-color="#122b4d"/></linearGradient></defs>
    <rect width="800" height="420" fill="#f5f6f8"/>
    <!-- Top bar -->
    <rect width="800" height="44" fill="url(#cg)"/>
    <text x="16" y="28" font-family="Helvetica,Arial" font-size="15" font-weight="bold" fill="#e8b931">CoStar</text>
    <text x="80" y="28" font-family="Helvetica,Arial" font-size="15" font-weight="bold" fill="white">Group</text>
    <text x="200" y="28" font-family="Arial" font-size="12" fill="#8aa4c8">Analytics</text>
    <text x="270" y="28" font-family="Arial" font-size="12" fill="white" font-weight="bold">Comps</text>
    <rect x="262" y="38" width="40" height="3" rx="1" fill="#e8b931"/>
    <text x="330" y="28" font-family="Arial" font-size="12" fill="#8aa4c8">Tenants</text>
    <text x="390" y="28" font-family="Arial" font-size="12" fill="#8aa4c8">Properties</text>
    <text x="470" y="28" font-family="Arial" font-size="12" fill="#8aa4c8">Market</text>
    <rect x="620" y="12" width="160" height="22" rx="3" fill="#1a3a66"/>
    <text x="632" y="27" font-family="Arial" font-size="11" fill="#7a9ac0">🔍  Search properties...</text>
    <!-- Filter bar -->
    <rect y="44" width="800" height="36" fill="#eef1f5"/>
    <rect x="12" y="50" width="120" height="24" rx="3" fill="white" stroke="#c5cdd8" stroke-width="1"/>
    <text x="22" y="66" font-family="Arial" font-size="11" fill="#333">EC2R • 0.5 mi</text>
    <rect x="140" y="50" width="140" height="24" rx="3" fill="white" stroke="#c5cdd8" stroke-width="1"/>
    <text x="150" y="66" font-family="Arial" font-size="11" fill="#333">8,000–18,000 sqft</text>
    <rect x="288" y="50" width="110" height="24" rx="3" fill="white" stroke="#c5cdd8" stroke-width="1"/>
    <text x="298" y="66" font-family="Arial" font-size="11" fill="#333">Office – Gr. A</text>
    <rect x="406" y="50" width="110" height="24" rx="3" fill="white" stroke="#c5cdd8" stroke-width="1"/>
    <text x="416" y="66" font-family="Arial" font-size="11" fill="#333">Last 12 months</text>
    <text x="540" y="66" font-family="Arial" font-size="11" fill="#1565c0" font-weight="bold">42 results</text>
    <!-- Table header -->
    <g transform="translate(0,88)">
      <rect width="800" height="28" fill="#f0f2f5"/>
      <text x="16" y="18" font-family="Arial" font-size="11" fill="#555" font-weight="bold">PROPERTY</text>
      <text x="280" y="18" font-family="Arial" font-size="11" fill="#555" font-weight="bold">SIZE (SQFT)</text>
      <text x="380" y="18" font-family="Arial" font-size="11" fill="#555" font-weight="bold">PRICE/SQFT</text>
      <text x="480" y="18" font-family="Arial" font-size="11" fill="#555" font-weight="bold">NIY</text>
      <text x="550" y="18" font-family="Arial" font-size="11" fill="#555" font-weight="bold">LEASE</text>
      <text x="640" y="18" font-family="Arial" font-size="11" fill="#555" font-weight="bold">TXN DATE</text>
      <text x="730" y="18" font-family="Arial" font-size="11" fill="#555" font-weight="bold">SOURCE</text>
      <rect y="28" width="800" height="1" fill="#dde0e5"/>
    </g>
    <!-- Row 1 -->
    <g transform="translate(0,117)">
      <rect width="800" height="40" fill="#edf7ee"/>
      <circle cx="26" cy="20" r="6" fill="#2e7d32" opacity="0.6"/>
      <text x="40" y="24" font-family="Arial" font-size="12" fill="#1b5e20" font-weight="bold">12 Moorgate, EC2R 6DA</text>
      <text x="280" y="24" font-family="Arial" font-size="12" fill="#333">14,200</text>
      <text x="380" y="24" font-family="Arial" font-size="12" fill="#333">£700</text>
      <text x="480" y="24" font-family="Arial" font-size="12" fill="#333">5.25%</text>
      <text x="550" y="24" font-family="Arial" font-size="12" fill="#333">10yr FRI</text>
      <text x="640" y="24" font-family="Arial" font-size="12" fill="#333">Nov 2025</text>
      <text x="730" y="24" font-family="Arial" font-size="12" fill="#888">CoStar</text>
      <rect y="40" width="800" height="1" fill="#dde0e5"/>
    </g>
    <!-- Row 2 -->
    <g transform="translate(0,158)">
      <rect width="800" height="40" fill="white"/>
      <circle cx="26" cy="20" r="6" fill="#90a4ae" opacity="0.4"/>
      <text x="40" y="24" font-family="Arial" font-size="12" fill="#333">55 Gresham Street, EC2V</text>
      <text x="280" y="24" font-family="Arial" font-size="12" fill="#333">18,500</text>
      <text x="380" y="24" font-family="Arial" font-size="12" fill="#333">£780</text>
      <text x="480" y="24" font-family="Arial" font-size="12" fill="#333">4.85%</text>
      <text x="550" y="24" font-family="Arial" font-size="12" fill="#333">15yr FRI</text>
      <text x="640" y="24" font-family="Arial" font-size="12" fill="#333">Sep 2025</text>
      <text x="730" y="24" font-family="Arial" font-size="12" fill="#888">CoStar</text>
      <rect y="40" width="800" height="1" fill="#eee"/>
    </g>
    <!-- Row 3 -->
    <g transform="translate(0,199)">
      <rect width="800" height="40" fill="#edf7ee"/>
      <circle cx="26" cy="20" r="6" fill="#2e7d32" opacity="0.6"/>
      <text x="40" y="24" font-family="Arial" font-size="12" fill="#1b5e20" font-weight="bold">25 Copthall Avenue, EC2R 7BP</text>
      <text x="280" y="24" font-family="Arial" font-size="12" fill="#333">13,400</text>
      <text x="380" y="24" font-family="Arial" font-size="12" fill="#333">£700</text>
      <text x="480" y="24" font-family="Arial" font-size="12" fill="#333">5.30%</text>
      <text x="550" y="24" font-family="Arial" font-size="12" fill="#333">10yr FRI</text>
      <text x="640" y="24" font-family="Arial" font-size="12" fill="#333">Dec 2025</text>
      <text x="730" y="24" font-family="Arial" font-size="12" fill="#888">LR</text>
      <rect y="40" width="800" height="1" fill="#dde0e5"/>
    </g>
    <!-- Row 4 -->
    <g transform="translate(0,240)">
      <rect width="800" height="40" fill="white"/>
      <circle cx="26" cy="20" r="6" fill="#90a4ae" opacity="0.4"/>
      <text x="40" y="24" font-family="Arial" font-size="12" fill="#333">30 Coleman Street, EC2R</text>
      <text x="280" y="24" font-family="Arial" font-size="12" fill="#333">9,200</text>
      <text x="380" y="24" font-family="Arial" font-size="12" fill="#333">£600</text>
      <text x="480" y="24" font-family="Arial" font-size="12" fill="#333">5.90%</text>
      <text x="550" y="24" font-family="Arial" font-size="12" fill="#333">5yr FRI</text>
      <text x="640" y="24" font-family="Arial" font-size="12" fill="#333">Oct 2025</text>
      <text x="730" y="24" font-family="Arial" font-size="12" fill="#888">Internal</text>
      <rect y="40" width="800" height="1" fill="#eee"/>
    </g>
    <!-- Row 5 -->
    <g transform="translate(0,281)">
      <rect width="800" height="40" fill="#f9f9fb"/>
      <circle cx="26" cy="20" r="6" fill="#90a4ae" opacity="0.4"/>
      <text x="40" y="24" font-family="Arial" font-size="12" fill="#333">60 London Wall, EC2M</text>
      <text x="280" y="24" font-family="Arial" font-size="12" fill="#333">16,700</text>
      <text x="380" y="24" font-family="Arial" font-size="12" fill="#333">£750</text>
      <text x="480" y="24" font-family="Arial" font-size="12" fill="#333">4.95%</text>
      <text x="550" y="24" font-family="Arial" font-size="12" fill="#333">12yr FRI</text>
      <text x="640" y="24" font-family="Arial" font-size="12" fill="#333">Feb 2026</text>
      <text x="730" y="24" font-family="Arial" font-size="12" fill="#888">CoStar</text>
      <rect y="40" width="800" height="1" fill="#eee"/>
    </g>
    <!-- Row 6 -->
    <g transform="translate(0,322)">
      <rect width="800" height="40" fill="white"/>
      <circle cx="26" cy="20" r="6" fill="#90a4ae" opacity="0.4"/>
      <text x="40" y="24" font-family="Arial" font-size="12" fill="#333">88 Wood Street, EC2V 7RS</text>
      <text x="280" y="24" font-family="Arial" font-size="12" fill="#333">15,100</text>
      <text x="380" y="24" font-family="Arial" font-size="12" fill="#333">£700</text>
      <text x="480" y="24" font-family="Arial" font-size="12" fill="#333">5.15%</text>
      <text x="550" y="24" font-family="Arial" font-size="12" fill="#333">10yr FRI</text>
      <text x="640" y="24" font-family="Arial" font-size="12" fill="#333">Jan 2026</text>
      <text x="730" y="24" font-family="Arial" font-size="12" fill="#888">LR</text>
      <rect y="40" width="800" height="1" fill="#eee"/>
    </g>
    <!-- Footer -->
    <rect y="366" width="800" height="54" fill="#f5f6f8"/>
    <text x="16" y="390" font-family="Arial" font-size="11" fill="#888">Showing 6 of 42 • Sorted by relevance • Filtered: Grade A, 8k–18k sqft, 0.5 mi of EC2R</text>
    <text x="640" y="390" font-family="Arial" font-size="11" fill="#1565c0">Export CSV ↓</text>
  </svg>`;
}

function landRegistryScreenshotSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="380" viewBox="0 0 800 380">
    <rect width="800" height="380" fill="#fff"/>
    <!-- GOV.UK header -->
    <rect width="800" height="10" fill="#0b0c0c"/>
    <rect y="10" width="800" height="50" fill="#0b0c0c"/>
    <rect x="16" y="18" width="100" height="32" rx="0" fill="#0b0c0c"/>
    <text x="16" y="30" font-family="Arial" font-size="14" font-weight="bold" fill="white">GOV.UK</text>
    <text x="16" y="48" font-family="Arial" font-size="10" fill="#a0a0a0">Official government website</text>
    <!-- Green service banner -->
    <rect y="60" width="800" height="44" fill="#00703c"/>
    <text x="24" y="88" font-family="Arial" font-size="18" font-weight="bold" fill="white">Search property information – HM Land Registry</text>
    <!-- Breadcrumb -->
    <text x="24" y="120" font-family="Arial" font-size="11" fill="#1d70b8">Home</text>
    <text x="56" y="120" font-family="Arial" font-size="11" fill="#505a5f">›</text>
    <text x="66" y="120" font-family="Arial" font-size="11" fill="#1d70b8">Price paid data</text>
    <text x="148" y="120" font-family="Arial" font-size="11" fill="#505a5f">›</text>
    <text x="158" y="120" font-family="Arial" font-size="11" fill="#505a5f">Search results</text>
    <!-- Search summary -->
    <text x="24" y="150" font-family="Arial" font-size="20" font-weight="bold" fill="#0b0c0c">Price paid search results</text>
    <rect x="24" y="160" width="740" height="28" rx="0" fill="#f3f2f1"/>
    <text x="32" y="179" font-family="Arial" font-size="12" fill="#505a5f">EC2R • Commercial • £5,000,000+ • 2 transactions found</text>
    <!-- Result 1 -->
    <rect x="24" y="200" width="740" height="1" fill="#b1b4b6"/>
    <text x="24" y="224" font-family="Arial" font-size="14" fill="#0b0c0c" font-weight="bold">25 Copthall Avenue, London EC2R 7BP</text>
    <text x="24" y="244" font-family="Arial" font-size="13" fill="#0b0c0c">Price paid: </text>
    <text x="104" y="244" font-family="Arial" font-size="13" fill="#0b0c0c" font-weight="bold">£9,380,000</text>
    <text x="24" y="262" font-family="Arial" font-size="12" fill="#505a5f">Date: 12 December 2025 • Title number: NGL892451</text>
    <text x="24" y="278" font-family="Arial" font-size="12" fill="#505a5f">Property type: Commercial • Estate type: Leasehold</text>
    <!-- Result 2 -->
    <rect x="24" y="296" width="740" height="1" fill="#b1b4b6"/>
    <text x="24" y="318" font-family="Arial" font-size="14" fill="#0b0c0c" font-weight="bold">88 Wood Street, London EC2V 7RS</text>
    <text x="24" y="338" font-family="Arial" font-size="13" fill="#0b0c0c">Price paid: </text>
    <text x="104" y="338" font-family="Arial" font-size="13" fill="#0b0c0c" font-weight="bold">£10,570,000</text>
    <text x="24" y="356" font-family="Arial" font-size="12" fill="#505a5f">Date: 22 January 2026 • Title number: NGL910834</text>
    <text x="24" y="372" font-family="Arial" font-size="12" fill="#505a5f">Property type: Commercial • Estate type: Leasehold</text>
  </svg>`;
}

function companiesHouseScreenshotSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400">
    <rect width="800" height="400" fill="#fff"/>
    <!-- GOV.UK header -->
    <rect width="800" height="10" fill="#0b0c0c"/>
    <rect y="10" width="800" height="50" fill="#0b0c0c"/>
    <text x="16" y="30" font-family="Arial" font-size="14" font-weight="bold" fill="white">GOV.UK</text>
    <text x="16" y="48" font-family="Arial" font-size="10" fill="#a0a0a0">Official government website</text>
    <!-- Blue Companies House banner -->
    <rect y="60" width="800" height="44" fill="#00557e"/>
    <text x="24" y="88" font-family="Arial" font-size="18" font-weight="bold" fill="white">Find and update company information</text>
    <!-- Breadcrumb -->
    <text x="24" y="120" font-family="Arial" font-size="11" fill="#1d70b8">Companies House</text>
    <text x="134" y="120" font-family="Arial" font-size="11" fill="#505a5f">›</text>
    <text x="144" y="120" font-family="Arial" font-size="11" fill="#505a5f">NEXAPOINT TECHNOLOGIES LTD</text>
    <!-- Company title -->
    <text x="24" y="152" font-family="Arial" font-size="22" font-weight="bold" fill="#0b0c0c">NEXAPOINT TECHNOLOGIES LTD</text>
    <text x="24" y="172" font-family="Arial" font-size="13" fill="#505a5f">Company number 14829371</text>
    <!-- Status badge -->
    <rect x="24" y="182" width="56" height="22" rx="3" fill="#00703c"/>
    <text x="32" y="197" font-family="Arial" font-size="11" fill="white" font-weight="bold">Active</text>
    <text x="90" y="197" font-family="Arial" font-size="12" fill="#505a5f">Incorporated on 15 March 2022</text>
    <!-- Tabs -->
    <g transform="translate(0,214)">
      <rect width="800" height="1" fill="#b1b4b6"/>
      <rect x="24" y="0" width="80" height="3" fill="#1d70b8"/>
      <text x="34" y="20" font-family="Arial" font-size="12" fill="#1d70b8" font-weight="bold">Overview</text>
      <text x="130" y="20" font-family="Arial" font-size="12" fill="#505a5f">Filing history</text>
      <text x="230" y="20" font-family="Arial" font-size="12" fill="#505a5f">People</text>
      <text x="300" y="20" font-family="Arial" font-size="12" fill="#505a5f">Charges</text>
    </g>
    <!-- Details -->
    <g transform="translate(24,248)">
      <text x="0" y="14" font-family="Arial" font-size="13" fill="#505a5f">Registered office address</text>
      <text x="0" y="34" font-family="Arial" font-size="14" fill="#0b0c0c" font-weight="bold">45 Moorgate, London, EC2R 6AR</text>
      <rect y="48" width="740" height="1" fill="#ddd"/>
      <text x="0" y="68" font-family="Arial" font-size="13" fill="#505a5f">Company type</text>
      <text x="200" y="68" font-family="Arial" font-size="13" fill="#0b0c0c">Private limited company</text>
      <rect y="80" width="740" height="1" fill="#ddd"/>
      <text x="0" y="100" font-family="Arial" font-size="13" fill="#505a5f">Last accounts</text>
      <text x="200" y="100" font-family="Arial" font-size="13" fill="#0b0c0c">31 March 2025</text>
      <rect y="112" width="740" height="1" fill="#ddd"/>
      <text x="0" y="132" font-family="Arial" font-size="13" fill="#505a5f">Total assets</text>
      <text x="200" y="132" font-family="Arial" font-size="13" fill="#0b0c0c" font-weight="bold">£28,450,000</text>
      <text x="310" y="132" font-family="Arial" font-size="12" fill="#505a5f">Net assets: £12,680,000 • Employees: 185</text>
    </g>
  </svg>`;
}

function adjustmentTableSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="300" viewBox="0 0 800 300">
    <rect width="800" height="300" fill="#fafbfc"/>
    <rect x="16" y="8" width="768" height="30" rx="4" fill="#1a237e"/>
    <text x="28" y="28" font-family="Arial" font-size="13" font-weight="bold" fill="white">Adjustment Grid — 6 Comparables</text>
    <g transform="translate(16,48)">
      <rect width="768" height="1" fill="#ccc"/>
      <text x="0" y="16" font-family="monospace" font-size="10" fill="#555" font-weight="bold">Comparable</text>
      <text x="190" y="16" font-family="monospace" font-size="10" fill="#555" font-weight="bold">Base £/sqft</text>
      <text x="290" y="16" font-family="monospace" font-size="10" fill="#555" font-weight="bold">Size adj</text>
      <text x="365" y="16" font-family="monospace" font-size="10" fill="#555" font-weight="bold">Lease adj</text>
      <text x="445" y="16" font-family="monospace" font-size="10" fill="#555" font-weight="bold">Refurb adj</text>
      <text x="535" y="16" font-family="monospace" font-size="10" fill="#555" font-weight="bold">Adj £/sqft</text>
      <text x="625" y="16" font-family="monospace" font-size="10" fill="#555" font-weight="bold">Adj NIY</text>
      <text x="705" y="16" font-family="monospace" font-size="10" fill="#555" font-weight="bold">Weight</text>
      <rect y="22" width="768" height="1" fill="#ccc"/>
      <!-- Row 1: 12 Moorgate (primary) -->
      <rect y="23" width="768" height="28" fill="#e8f5e9"/>
      <text x="0" y="41" font-family="monospace" font-size="10" fill="#1b5e20">★ 12 Moorgate</text>
      <text x="190" y="41" font-family="monospace" font-size="10" fill="#333">£700</text>
      <text x="290" y="41" font-family="monospace" font-size="10" fill="#c62828">−1.5%</text>
      <text x="365" y="41" font-family="monospace" font-size="10" fill="#c62828">+40bps</text>
      <text x="445" y="41" font-family="monospace" font-size="10" fill="#2e7d32">+2.0%</text>
      <text x="535" y="41" font-family="monospace" font-size="10" fill="#333">£710</text>
      <text x="625" y="41" font-family="monospace" font-size="10" fill="#333">5.65%</text>
      <text x="705" y="41" font-family="monospace" font-size="10" fill="#1a237e">30%</text>
      <!-- Row 2: 55 Gresham St -->
      <rect y="51" width="768" height="28" fill="white"/>
      <text x="0" y="69" font-family="monospace" font-size="10" fill="#333">55 Gresham St</text>
      <text x="190" y="69" font-family="monospace" font-size="10" fill="#333">£780</text>
      <text x="290" y="69" font-family="monospace" font-size="10" fill="#c62828">−3.2%</text>
      <text x="365" y="69" font-family="monospace" font-size="10" fill="#c62828">+55bps</text>
      <text x="445" y="69" font-family="monospace" font-size="10" fill="#2e7d32">+1.0%</text>
      <text x="535" y="69" font-family="monospace" font-size="10" fill="#333">£725</text>
      <text x="625" y="69" font-family="monospace" font-size="10" fill="#333">5.60%</text>
      <text x="705" y="69" font-family="monospace" font-size="10" fill="#555">15%</text>
      <!-- Row 3: 25 Copthall Ave (primary) -->
      <rect y="79" width="768" height="28" fill="#e8f5e9"/>
      <text x="0" y="97" font-family="monospace" font-size="10" fill="#1b5e20">★ 25 Copthall Ave</text>
      <text x="190" y="97" font-family="monospace" font-size="10" fill="#333">£700</text>
      <text x="290" y="97" font-family="monospace" font-size="10" fill="#c62828">−0.8%</text>
      <text x="365" y="97" font-family="monospace" font-size="10" fill="#c62828">+40bps</text>
      <text x="445" y="97" font-family="monospace" font-size="10" fill="#2e7d32">+2.0%</text>
      <text x="535" y="97" font-family="monospace" font-size="10" fill="#333">£708</text>
      <text x="625" y="97" font-family="monospace" font-size="10" fill="#333">5.70%</text>
      <text x="705" y="97" font-family="monospace" font-size="10" fill="#1a237e">25%</text>
      <!-- Row 4: 30 Coleman St -->
      <rect y="107" width="768" height="28" fill="white"/>
      <text x="0" y="125" font-family="monospace" font-size="10" fill="#333">30 Coleman St</text>
      <text x="190" y="125" font-family="monospace" font-size="10" fill="#333">£600</text>
      <text x="290" y="125" font-family="monospace" font-size="10" fill="#2e7d32">+3.0%</text>
      <text x="365" y="125" font-family="monospace" font-size="10" fill="#c62828">+60bps</text>
      <text x="445" y="125" font-family="monospace" font-size="10" fill="#2e7d32">+3.5%</text>
      <text x="535" y="125" font-family="monospace" font-size="10" fill="#333">£639</text>
      <text x="625" y="125" font-family="monospace" font-size="10" fill="#333">6.50%</text>
      <text x="705" y="125" font-family="monospace" font-size="10" fill="#555">5%</text>
      <!-- Row 5: 60 London Wall -->
      <rect y="135" width="768" height="28" fill="#f9f9fb"/>
      <text x="0" y="153" font-family="monospace" font-size="10" fill="#333">60 London Wall</text>
      <text x="190" y="153" font-family="monospace" font-size="10" fill="#333">£750</text>
      <text x="290" y="153" font-family="monospace" font-size="10" fill="#c62828">−2.5%</text>
      <text x="365" y="153" font-family="monospace" font-size="10" fill="#c62828">+50bps</text>
      <text x="445" y="153" font-family="monospace" font-size="10" fill="#2e7d32">+1.5%</text>
      <text x="535" y="153" font-family="monospace" font-size="10" fill="#333">£718</text>
      <text x="625" y="153" font-family="monospace" font-size="10" fill="#333">5.45%</text>
      <text x="705" y="153" font-family="monospace" font-size="10" fill="#555">10%</text>
      <!-- Row 6: 88 Wood St -->
      <rect y="163" width="768" height="28" fill="white"/>
      <text x="0" y="181" font-family="monospace" font-size="10" fill="#333">88 Wood St</text>
      <text x="190" y="181" font-family="monospace" font-size="10" fill="#333">£700</text>
      <text x="290" y="181" font-family="monospace" font-size="10" fill="#c62828">−1.8%</text>
      <text x="365" y="181" font-family="monospace" font-size="10" fill="#c62828">+45bps</text>
      <text x="445" y="181" font-family="monospace" font-size="10" fill="#2e7d32">+1.5%</text>
      <text x="535" y="181" font-family="monospace" font-size="10" fill="#333">£697</text>
      <text x="625" y="181" font-family="monospace" font-size="10" fill="#333">5.60%</text>
      <text x="705" y="181" font-family="monospace" font-size="10" fill="#555">15%</text>
      <!-- Divider + adopted value -->
      <rect y="195" width="768" height="1" fill="#1a237e"/>
      <rect y="196" width="768" height="30" fill="#e3f2fd"/>
      <text x="0" y="216" font-family="monospace" font-size="11" fill="#1a237e" font-weight="bold">ADOPTED VALUE</text>
      <text x="535" y="216" font-family="monospace" font-size="11" fill="#1a237e" font-weight="bold">£710/sqft</text>
      <text x="625" y="216" font-family="monospace" font-size="11" fill="#1a237e" font-weight="bold">5.65%</text>
      <text x="170" y="250" font-family="Arial" font-size="12" fill="#555">Market Value: 12,500 sqft × £710/sqft = £8,875,000</text>
    </g>
  </svg>`;
}

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

async function setupAssistant() {
  writeWorkflowSvgs();

  const valuer = createUser({ name: 'James', lastName: 'Whitfield', credits: 50_000 });
  createEmailLogin({ userId: valuer.id });

  const assistant = createAssistant({
    userId: valuer.id,
    firstName: 'Aria',
    surname: 'Sterling',
    profilePhoto: '/demos/aria-sterling.jpg',
  });

  const { apiKey } = valuer;
  const { agentId } = assistant;
  const seedOpts = { apiKey, userId: valuer.id, assistantId: agentId };

  await ensureProject(apiKey, 'Assistants');

  await seedChatInfrastructure({
    apiKey,
    userId: valuer.id,
    assistantId: agentId,
    email: valuer.email,
  });

  await seedLogEntry(seedOpts, 'Contacts', {
    contact_id: 0,
    first_name: 'Aria',
    surname: 'Sterling',
    email_address: 'aria@sterling-surveyors.example.com',
    is_system: true,
    timezone: 'Europe/London',
    bio: 'AI valuation analyst.',
  });
  await seedLogEntry(seedOpts, 'Contacts', {
    contact_id: 1,
    first_name: 'James',
    surname: 'Whitfield',
    email_address: valuer.email,
    timezone: 'Europe/London',
    bio: 'MRICS, Senior Director.',
  });

  return { valuer, assistant, seedOpts, agentId };
}

async function setupPage(
  page: import('@playwright/test').Page,
  email: string,
  agentId: number,
  opts?: { zoom?: boolean }
) {
  await setupRecordingRoutes(page);
  await loginAndNavigate(page, email, 'testpass123', `/assistants?profile=${agentId}`);
  await injectCursorOverlay(page);
  await hideRecordingNoise(page);
  await waitForChatReady(page);
  await fixAvatarPhotos(page);
  if (opts?.zoom) {
    await zoomOnChat(page);
    await page.waitForTimeout(500);
  }
  await blockChatPolling(page);
  await page.waitForTimeout(1000);
}

// =========================================================================
// Clip 1 — "The Instruction"
//
// Clean chat. All messages via DOM injection. Zoomed on chat area.
// Video is trimmed to only show the conversation.
// =========================================================================

test('clip-1-the-instruction', async ({ page }) => {
  test.setTimeout(300_000);
  const testStart = Date.now();

  const { valuer, agentId } = await setupAssistant();
  await setupPage(page, valuer.email, agentId, { zoom: true });

  // --- Interesting content starts here ---
  const contentStart = Date.now();

  await typeAndSendMessage(page, USER_MSG_1, 18);
  await page.waitForTimeout(2500);
  await showTypingThenReply(page, ARIA_REPLY_1, 4000);
  await page.waitForTimeout(4000);
  await typeAndSendMessage(page, USER_MSG_2, 22);
  await page.waitForTimeout(2500);
  await showTypingThenReply(page, ARIA_REPLY_2, 3000);
  await page.waitForTimeout(3000);

  const contentEnd = Date.now();
  writeMarkers(test.info().outputDir, testStart, contentStart, contentEnd);
});

// =========================================================================
// Clip 2 — "The Research & Analysis"
//
// Pre-seeds the full clip 1 conversation, then shows the Actions panel.
//
// KEY CHANGES from previous versions:
// - Incoming events use status: 'running' so ToolLoop shows via
//   LiveToolLoopTimeline (auto-shows content, no extra "N steps" click)
// - clickExpandAll is called AFTER EACH new ManagerMethod event to
//   progressively reveal content, not just once at the end
// - Each step has a unique hierarchy segment for proper tree nesting
// =========================================================================

test('clip-2-the-research', async ({ page }) => {
  test.setTimeout(300_000);
  const testStart = Date.now();

  const { valuer, seedOpts, agentId } = await setupAssistant();

  // Pre-seed the EXACT conversation from clip 1
  await preseedMessage(seedOpts, {
    message_id: nextMsgId(),
    medium: 'unify_message',
    sender_id: 1,
    receiver_ids: [0],
    timestamp: ts(),
    content: USER_MSG_1,
  });
  await preseedMessage(seedOpts, {
    message_id: nextMsgId(),
    medium: 'unify_message',
    sender_id: 0,
    receiver_ids: [1],
    timestamp: ts(),
    content: ARIA_REPLY_1,
  });
  await preseedMessage(seedOpts, {
    message_id: nextMsgId(),
    medium: 'unify_message',
    sender_id: 1,
    receiver_ids: [0],
    timestamp: ts(),
    content: USER_MSG_2,
  });
  await preseedMessage(seedOpts, {
    message_id: nextMsgId(),
    medium: 'unify_message',
    sender_id: 0,
    receiver_ids: [1],
    timestamp: ts(),
    content: ARIA_REPLY_2,
  });

  // Setup page WITHOUT zoom (need tabs visible to switch)
  await setupPage(page, valuer.email, agentId);

  // Switch to Actions tab BEFORE applying zoom
  await moveTo(page, '[data-testid="right-pane-tab-actions"]', { click: true });
  await page.waitForTimeout(1500);

  // Now zoom to fill viewport with actions content
  await zoomOnChat(page);
  await page.waitForTimeout(500);

  // Remove height constraints on the action viewer so images render at full size
  await page.addStyleTag({
    content: `
      /* Remove per-image height cap (default max-h-48 = 192px) */
      [data-testid="live-actions-scroll-container"] img { max-height: none !important; }
      /* Remove timeline scroll container height cap */
      [data-testid="live-actions-scroll-container"] .styled-scrollbar { max-height: none !important; }
    `,
  });

  // --- Interesting content starts here ---
  const contentStart = Date.now();

  const rootId = `root-${Date.now()}`;
  const researchId = `research-${Date.now()}`;
  const compileId = `compile-${Date.now()}`;
  const adjustId = `adjust-${Date.now()}`;
  const reportId = `report-${Date.now()}`;

  const rootH = ['ConversationManager.process_message'];
  const researchH = [...rootH, 'CodeActActor.research'];
  const compileH = [...rootH, 'CodeActActor.compile'];
  const adjustH = [...rootH, 'CodeActActor.adjust'];
  const reportH = [...rootH, 'CodeActActor.report'];

  // ── Root action ──
  await pushActionEvent(agentId, 'ManagerMethod', {
    manager: 'ConversationManager',
    method: 'process_message',
    phase: 'incoming',
    calling_id: rootId,
    hierarchy: rootH,
    hierarchy_label: rootH.join('->'),
    status: 'running',
    display_label: '45 Moorgate — Market Value assessment',
    question: '45 Moorgate valuation instruction from Meridian Capital',
    event_timestamp: ts(),
    event_id: 'mm-root',
  });
  await page.waitForTimeout(2500);

  // Expand once — inline children auto-expand when status is 'running'
  await clickExpandAll(page);
  await page.waitForTimeout(1000);

  // ── Step 1: Research ──
  await pushActionEvent(agentId, 'ManagerMethod', {
    manager: 'CodeActActor',
    method: 'research',
    phase: 'incoming',
    calling_id: researchId,
    hierarchy: researchH,
    hierarchy_label: researchH.join('->'),
    status: 'running',
    display_label: 'Researching comparables and market data',
    instructions: 'Search CoStar, Land Registry and Companies House.',
    event_timestamp: ts(),
    event_id: 'mm-research',
  });
  await page.waitForTimeout(2500);

  // Push ToolLoop events — content as plain string renders via markdown, not JSON
  await pushActionEvent(agentId, 'ToolLoop', {
    hierarchy: researchH,
    hierarchy_label: researchH.join('->'),
    method: 'research',
    kind: 'tool_result',
    event_timestamp: ts(),
    event_id: 'tl-costar',
    message: {
      role: 'tool',
      name: 'search_costar',
      tool_call_id: 'call-costar',
      content: `Searching CoStar — EC2R offices, 8,000–18,000 sqft, last 12 months\n\n![CoStar comparable search results](${svgUrl('costar-screenshot.svg')})`,
    },
  });
  await page.waitForTimeout(5000);

  await pushActionEvent(agentId, 'ToolLoop', {
    hierarchy: researchH,
    hierarchy_label: researchH.join('->'),
    method: 'research',
    kind: 'tool_result',
    event_timestamp: ts(),
    event_id: 'tl-landregistry',
    message: {
      role: 'tool',
      name: 'search_land_registry',
      tool_call_id: 'call-lr',
      content: `Cross-referencing HM Land Registry price paid data\n\n![Land Registry search results](${svgUrl('land-registry-screenshot.svg')})`,
    },
  });
  await page.waitForTimeout(5000);

  await pushActionEvent(agentId, 'ToolLoop', {
    hierarchy: researchH,
    hierarchy_label: researchH.join('->'),
    method: 'research',
    kind: 'tool_result',
    event_timestamp: ts(),
    event_id: 'tl-companieshouse',
    message: {
      role: 'tool',
      name: 'search_companies_house',
      tool_call_id: 'call-ch',
      content: `Checking tenant covenant — Companies House\n\n![Companies House result](${svgUrl('companies-house-screenshot.svg')})`,
    },
  });
  await page.waitForTimeout(4000);
  await pushActionEvent(agentId, 'ManagerMethod', {
    manager: 'CodeActActor',
    method: 'research',
    phase: 'outgoing',
    calling_id: researchId,
    hierarchy: researchH,
    hierarchy_label: researchH.join('->'),
    status: 'ok',
    display_label: 'Researching comparables and market data',
    answer: 'Found 42 transactions. Shortlisted 6 comparables.',
    event_timestamp: ts(),
    event_id: 'mm-research-done',
  });
  await page.waitForTimeout(2000);

  // ── Step 2: Compile evidence (header only — no injected content) ──
  await pushActionEvent(agentId, 'ManagerMethod', {
    manager: 'CodeActActor',
    method: 'compile',
    phase: 'incoming',
    calling_id: compileId,
    hierarchy: compileH,
    hierarchy_label: compileH.join('->'),
    status: 'running',
    display_label: 'Compiling comparable evidence from sources',
    instructions: 'Consolidate into evidence schedule.',
    event_timestamp: ts(),
    event_id: 'mm-compile',
  });
  await page.waitForTimeout(5000);

  await pushActionEvent(agentId, 'ManagerMethod', {
    manager: 'CodeActActor',
    method: 'compile',
    phase: 'outgoing',
    calling_id: compileId,
    hierarchy: compileH,
    hierarchy_label: compileH.join('->'),
    status: 'ok',
    display_label: 'Compiling comparable evidence from sources',
    answer: '6 comparables compiled.',
    event_timestamp: ts(),
    event_id: 'mm-compile-done',
  });
  await page.waitForTimeout(2000);

  // ── Step 3: Adjustment analysis ──
  await pushActionEvent(agentId, 'ManagerMethod', {
    manager: 'CodeActActor',
    method: 'adjust',
    phase: 'incoming',
    calling_id: adjustId,
    hierarchy: adjustH,
    hierarchy_label: adjustH.join('->'),
    status: 'running',
    display_label: 'Running adjustment analysis on 6 comparables',
    instructions: 'Apply size, lease, refurbishment adjustments.',
    event_timestamp: ts(),
    event_id: 'mm-adjust',
  });
  await page.waitForTimeout(2500);

  await pushActionEvent(agentId, 'ToolLoop', {
    hierarchy: adjustH,
    hierarchy_label: adjustH.join('->'),
    method: 'adjust',
    kind: 'tool_result',
    event_timestamp: ts(),
    event_id: 'tl-adjustment',
    message: {
      role: 'tool',
      name: 'run_adjustment_grid',
      tool_call_id: 'call-adj',
      content: `Adjustment grid — 6 comparables\n\n![Adjustment analysis table](${svgUrl('adjustment-table.svg')})`,
    },
  });
  await page.waitForTimeout(6000);
  await pushActionEvent(agentId, 'ManagerMethod', {
    manager: 'CodeActActor',
    method: 'adjust',
    phase: 'outgoing',
    calling_id: adjustId,
    hierarchy: adjustH,
    hierarchy_label: adjustH.join('->'),
    status: 'ok',
    display_label: 'Running adjustment analysis on 6 comparables',
    answer: 'Market Value: £8,875,000 at 5.65% NIY.',
    event_timestamp: ts(),
    event_id: 'mm-adjust-done',
  });
  await page.waitForTimeout(2000);

  // ── Step 4: Generate report (header only, no injected content) ──
  await pushActionEvent(agentId, 'ManagerMethod', {
    manager: 'CodeActActor',
    method: 'report',
    phase: 'incoming',
    calling_id: reportId,
    hierarchy: reportH,
    hierarchy_label: reportH.join('->'),
    status: 'running',
    display_label: 'Generating valuation report',
    instructions: 'Draft Red Book valuation report.',
    event_timestamp: ts(),
    event_id: 'mm-report',
  });
  await page.waitForTimeout(6000);

  const contentEnd = Date.now();
  writeMarkers(test.info().outputDir, testStart, contentStart, contentEnd);
});

// =========================================================================
// Clip 3 — "The Report & Revision"
//
// Pre-seeds the exact same 4 messages from clip 1 (matching its end state).
// Shows report delivery. Zoomed on the chat area.
// =========================================================================

test('clip-3-the-report', async ({ page }) => {
  test.setTimeout(300_000);
  const testStart = Date.now();

  const { valuer, seedOpts, agentId } = await setupAssistant();

  // Pre-seed the EXACT 4 messages from clip 1 — no extra messages
  await preseedMessage(seedOpts, {
    message_id: nextMsgId(),
    medium: 'unify_message',
    sender_id: 1,
    receiver_ids: [0],
    timestamp: ts(),
    content: USER_MSG_1,
  });
  await preseedMessage(seedOpts, {
    message_id: nextMsgId(),
    medium: 'unify_message',
    sender_id: 0,
    receiver_ids: [1],
    timestamp: ts(),
    content: ARIA_REPLY_1,
  });
  await preseedMessage(seedOpts, {
    message_id: nextMsgId(),
    medium: 'unify_message',
    sender_id: 1,
    receiver_ids: [0],
    timestamp: ts(),
    content: USER_MSG_2,
  });
  await preseedMessage(seedOpts, {
    message_id: nextMsgId(),
    medium: 'unify_message',
    sender_id: 0,
    receiver_ids: [1],
    timestamp: ts(),
    content: ARIA_REPLY_2,
  });

  // Create report files BEFORE page setup
  const reportV1 = generateValuationReportHtml(1);
  createLocalAttachment('Sterling_Valuation_45Moorgate_Draft_v1.html', reportV1);

  await setupPage(page, valuer.email, agentId, { zoom: true });

  // --- Interesting content starts here ---
  const contentStart = Date.now();

  await page.waitForTimeout(2000);

  const reportSummary =
    'James, the draft valuation report is ready:\n\n- **Market Value:** £8,875,000\n- **Market Rent:** £90.00/sq ft (£1,125,000 pa)\n- **Net Initial Yield:** 5.65% (reflecting break clause)\n- **Equivalent Yield:** 5.45%\n\nThe report covers executive summary, market commentary, comparable evidence (6 transactions), investment method, and special assumptions.\n\nPlease find the full report attached.';

  await showTypingThenReply(page, reportSummary, 4000, [
    {
      id: 'att-v1',
      filename: 'Sterling_Valuation_45Moorgate_Draft_v1.html',
      content_type: 'text/html',
      size_bytes: reportV1.length,
      gs_url: 'gs://bucket/Sterling_Valuation_45Moorgate_Draft_v1.html',
    },
  ]);

  await page.waitForTimeout(2000);

  // Hover attachment chip (white text on green), then open preview
  const chip = page.locator('[data-testid="attachment-chip"]').last();
  if (await chip.isVisible({ timeout: 3000 }).catch(() => false)) {
    const box = await chip.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
      await page.waitForTimeout(800);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(500);
    }
  }

  await showFilePreview(page, reportV1, 8000);

  // User sends feedback
  const feedbackText =
    'Excellent work. Two additions: add a sensitivity table at 5.25%, 5.50%, 5.75% and 6.00% yields, and expand the market rent evidence for £90/sq ft.';
  await typeAndSendMessage(page, feedbackText, 18);

  await page.waitForTimeout(2500);

  const ackText =
    'Good points. Adding both now:\n\n**Sensitivity table** — values from 5.00% to 6.25% in 25bp increments.\n\n**Market rent evidence (£90/sqft):**\n- 12 Moorgate: £92/sqft (Q4 2025 letting)\n- 55 Gresham Street: £88/sqft (Q3 2025)\n- 60 London Wall: £95/sqft (Q1 2026, Grade A+)\n- Knight Frank City Index: Grade A asking rents £90-95/sqft\n\nUpdated draft in a moment.';
  await showTypingThenReply(page, ackText, 3500);

  await page.waitForTimeout(2000);

  // Updated report v2
  const reportV2 = generateValuationReportHtml(2);
  createLocalAttachment('Sterling_Valuation_45Moorgate_Draft_v2.html', reportV2);

  const v2Summary =
    'Updated draft ready. Changes:\n- Sensitivity table added (Section 5.4)\n- Market rent evidence expanded with 4 letting comparables\n- Minor formatting corrections to comparable evidence schedule';
  await showTypingThenReply(page, v2Summary, 2500, [
    {
      id: 'att-v2',
      filename: 'Sterling_Valuation_45Moorgate_Draft_v2.html',
      content_type: 'text/html',
      size_bytes: reportV2.length,
      gs_url: 'gs://bucket/Sterling_Valuation_45Moorgate_Draft_v2.html',
    },
  ]);

  await page.waitForTimeout(1500);

  // Open and scroll through v2
  const v2Chip = page.locator('[data-testid="attachment-chip"]').last();
  if (await v2Chip.isVisible({ timeout: 3000 }).catch(() => false)) {
    const box = await v2Chip.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
      await page.waitForTimeout(800);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(500);
    }
  }

  await showFilePreview(page, reportV2, 8000);
  await page.waitForTimeout(2000);

  const contentEnd = Date.now();
  writeMarkers(test.info().outputDir, testStart, contentStart, contentEnd);
});

/* eslint-enable @typescript-eslint/naming-convention */

// ---------------------------------------------------------------------------
// Professional valuation report HTML
// ---------------------------------------------------------------------------

function generateValuationReportHtml(version: number): string {
  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const sensitivitySection =
    version >= 2
      ? `
    <div class="section">
      <h2>5.4&ensp;Sensitivity Analysis</h2>
      <table>
        <thead><tr><th>Net Initial Yield</th><th>Capital Value</th><th>£ per sq ft</th><th>vs Adopted</th></tr></thead>
        <tbody>
          <tr><td>5.00%</td><td>£9,475,000</td><td>£758</td><td class="green">+6.8%</td></tr>
          <tr><td>5.25%</td><td>£9,025,000</td><td>£722</td><td class="green">+1.7%</td></tr>
          <tr><td>5.50%</td><td>£8,625,000</td><td>£690</td><td class="red">−2.8%</td></tr>
          <tr class="highlight"><td><strong>5.65% (Adopted)</strong></td><td><strong>£8,875,000</strong></td><td><strong>£710</strong></td><td>—</td></tr>
          <tr><td>5.75%</td><td>£8,250,000</td><td>£660</td><td class="red">−7.0%</td></tr>
          <tr><td>6.00%</td><td>£7,906,250</td><td>£633</td><td class="red">−10.9%</td></tr>
          <tr><td>6.25%</td><td>£7,583,333</td><td>£607</td><td class="red">−14.6%</td></tr>
        </tbody>
      </table>

      <h2>5.5&ensp;Market Rent Evidence</h2>
      <table>
        <thead><tr><th>Address</th><th>Rent (£/sqft)</th><th>Grade</th><th>Date</th></tr></thead>
        <tbody>
          <tr><td>12 Moorgate, EC2R</td><td>£92</td><td>A</td><td>Q4 2025</td></tr>
          <tr><td>55 Gresham Street, EC2V</td><td>£88</td><td>A</td><td>Q3 2025</td></tr>
          <tr><td>60 London Wall, EC2M</td><td>£95</td><td>A+</td><td>Q1 2026</td></tr>
          <tr><td>Knight Frank City Index</td><td>£90–95</td><td>A (avg)</td><td>Q1 2026</td></tr>
        </tbody>
      </table>
      <p class="note">Adopted market rent of £90/sqft sits at the lower quartile, reflecting the break clause risk.</p>
    </div>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sterling Chartered Surveyors — Valuation Report v${version}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif;
      max-width: 820px; margin: 0 auto; padding: 48px 40px;
      color: #1a1a2e; line-height: 1.65; font-size: 14px;
    }
    .letterhead {
      display: flex; justify-content: space-between; align-items: flex-start;
      border-bottom: 3px solid #1a1a2e; padding-bottom: 20px; margin-bottom: 36px;
    }
    .letterhead .firm { font-size: 22px; font-weight: 700; letter-spacing: 0.5px; color: #1a1a2e; }
    .letterhead .firm-sub { font-size: 11px; color: #666; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; }
    .letterhead .meta { text-align: right; font-size: 11px; color: #666; line-height: 1.8; }
    .report-title {
      text-align: center; margin: 40px 0 32px; padding: 24px 0;
      border-top: 1px solid #ccc; border-bottom: 1px solid #ccc;
    }
    .report-title h1 { font-size: 20px; font-weight: 600; letter-spacing: 1px; color: #1a1a2e; }
    .report-title .subtitle { font-size: 13px; color: #666; margin-top: 8px; }
    .section { margin-top: 32px; }
    h2 { font-size: 15px; font-weight: 600; color: #1a1a2e; margin-bottom: 12px;
         border-bottom: 1px solid #ddd; padding-bottom: 6px; }
    .kv { display: grid; grid-template-columns: 180px 1fr; gap: 4px 20px; margin: 12px 0 20px; }
    .kv dt { font-weight: 600; color: #444; font-size: 13px; }
    .kv dd { margin: 0; font-size: 13px; }
    p { margin-bottom: 12px; text-align: justify; }
    table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 12.5px; }
    th, td { border: 1px solid #d0d0d0; padding: 8px 10px; text-align: left; }
    th { background: #f0f0f0; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .highlight { background: #fffde7; }
    .green { color: #2e7d32; }
    .red { color: #c62828; }
    .note { font-size: 12px; color: #666; font-style: italic; margin-top: 8px; }
    .disclaimer {
      font-size: 11px; color: #777; margin-top: 40px;
      border-top: 2px solid #1a1a2e; padding-top: 16px; line-height: 1.7;
    }
    .disclaimer strong { color: #1a1a2e; }
    .page-break { page-break-before: always; margin-top: 48px; }
  </style>
</head>
<body>
  <div class="letterhead">
    <div>
      <div class="firm">Sterling Chartered Surveyors</div>
      <div class="firm-sub">Chartered Surveyors &amp; Valuers • Est. 1987</div>
    </div>
    <div class="meta">
      Draft v${version}<br/>
      Ref: SCS/VAL/2026/0${version}47<br/>
      ${today}
    </div>
  </div>

  <div class="report-title">
    <h1>VALUATION REPORT</h1>
    <div class="subtitle">45 Moorgate, London EC2R &bull; Prepared for Meridian Capital Partners LLP</div>
  </div>

  <div class="section">
    <h2>1&ensp;Executive Summary</h2>
    <dl class="kv">
      <dt>Property</dt><dd>45 Moorgate, London EC2R</dd>
      <dt>Description</dt><dd>Grade A Office — Full refurbishment 2023</dd>
      <dt>Net Internal Area</dt><dd>12,500 sq ft (1,161 sq m)</dd>
      <dt>Tenure</dt><dd>Leasehold — 125 years from 2020</dd>
      <dt>Tenancy</dt><dd>Single-let to NexaPoint Technologies Ltd</dd>
      <dt>Lease Terms</dt><dd>10yr from Mar 2024, tenant break yr 5, FRI</dd>
      <dt>Passing Rent</dt><dd>£87.50/sq ft (£1,093,750 pa)</dd>
      <dt>Market Rent</dt><dd>£90.00/sq ft (£1,125,000 pa)</dd>
      <dt>Valuation Basis</dt><dd>Market Value (RICS Red Book Global Standards)</dd>
      <dt>Valuation Date</dt><dd>${today}</dd>
    </dl>
  </div>

  <div class="section">
    <h2>2&ensp;Market Commentary</h2>
    <p>The City of London office market has demonstrated resilience through Q1 2026. The MSCI UK Monthly Property Index for City offices recorded a total return of 1.8%, comprising capital growth of +0.3% and rental growth of +1.2%. Prime equivalent yields stand at 5.15%, broadly stable over the last two quarters.</p>
    <p>Grade A vacancy in the City has fallen to 4.3%, the lowest level since 2019, underpinned by persistent occupier demand for quality, well-located space. The Bank of England base rate holds at 4.25%, with interest rate swap markets pricing two 25bp cuts by year-end — a supportive backdrop for investment yields.</p>
  </div>

  <div class="section">
    <h2>3&ensp;Comparable Evidence</h2>
    <table>
      <thead>
        <tr><th>Address</th><th>NIA (sqft)</th><th>£/sqft</th><th>NIY</th><th>Lease Term</th><th>Txn Date</th><th>Source</th></tr>
      </thead>
      <tbody>
        <tr class="highlight"><td><strong>12 Moorgate, EC2R</strong></td><td>14,200</td><td>£700</td><td>5.25%</td><td>10yr, no break</td><td>Nov 2025</td><td>CoStar</td></tr>
        <tr><td>55 Gresham Street, EC2V</td><td>18,500</td><td>£780</td><td>4.85%</td><td>15yr</td><td>Sep 2025</td><td>CoStar</td></tr>
        <tr class="highlight"><td><strong>25 Copthall Avenue, EC2R</strong></td><td>13,400</td><td>£700</td><td>5.30%</td><td>10yr</td><td>Dec 2025</td><td>Land Registry</td></tr>
        <tr><td>30 Coleman Street, EC2R</td><td>9,200</td><td>£600</td><td>5.90%</td><td>5yr</td><td>Oct 2025</td><td>Internal</td></tr>
        <tr><td>60 London Wall, EC2M</td><td>16,700</td><td>£750</td><td>4.95%</td><td>12yr</td><td>Feb 2026</td><td>CoStar</td></tr>
        <tr><td>88 Wood Street, EC2V</td><td>15,100</td><td>£700</td><td>5.15%</td><td>10yr</td><td>Jan 2026</td><td>Land Registry</td></tr>
      </tbody>
    </table>
    <p class="note">Primary comparables (★) highlighted. Subject property adjusted upward for 2023 refurbishment (+2%) and downward for break clause exposure (+40bps yield premium).</p>
  </div>

  <div class="section">
    <h2>4&ensp;Valuation — Investment Method</h2>
    <dl class="kv">
      <dt>Passing Rent</dt><dd>£1,093,750 pa</dd>
      <dt>Estimated Market Rent</dt><dd>£1,125,000 pa (£90.00/sq ft)</dd>
      <dt>Net Initial Yield</dt><dd>5.65%</dd>
      <dt>Equivalent Yield</dt><dd>5.45%</dd>
      <dt>Reversionary Yield</dt><dd>5.80%</dd>
      <dt>Capital Value</dt><dd>£8,875,000 (£710/sq ft)</dd>
    </dl>
    <p>The adopted NIY of 5.65% reflects a 40bps premium to the primary comparable at 12 Moorgate (5.25%, 10yr no break) to account for the tenant break at year 5 which introduces income uncertainty. This is consistent with market evidence for break-clause-adjusted transactions in the EC2 corridor.</p>
  </div>

  ${sensitivitySection}

  <div class="section">
    <h2>5&ensp;Special Assumptions</h2>
    <ol style="padding-left: 20px; font-size: 13px; line-height: 2;">
      <li>The property is assumed to be free from structural defects and environmental contamination.</li>
      <li>All floor areas have been taken from the client's briefing and have not been independently measured.</li>
      <li>The break clause at year 5 is a tenant-only break, exercisable on 6 months' written notice, subject to no outstanding rent arrears.</li>
      <li>No allowance has been made for any rights, easements or encumbrances not apparent from the title documents.</li>
      ${version >= 2 ? '<li>This valuation does not account for any potential dilapidation liabilities at lease expiry.</li>' : ''}
    </ol>
  </div>

  <div class="disclaimer">
    <p><strong>Important Notice</strong></p>
    <p>This valuation has been prepared in accordance with the RICS Valuation — Global Standards (the "Red Book"). The valuation represents the valuer's objective opinion of Market Value as at the valuation date and is not a guarantee of the price achievable in the open market.</p>
    <p>This report is addressed to Meridian Capital Partners LLP and should not be relied upon by any third party without the express written consent of Sterling Chartered Surveyors.</p>
    <p style="margin-top: 24px; font-size: 12px; color: #1a1a2e;">
      <strong>Valuer:</strong> James Whitfield BSc (Hons) MRICS<br/>
      Senior Director — Valuation &amp; Advisory Services<br/>
      RICS Registered Valuer No. 7284159
    </p>
  </div>
</body>
</html>`;
}
