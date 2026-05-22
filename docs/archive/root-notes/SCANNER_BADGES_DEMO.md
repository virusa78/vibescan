/**
 * Visual Example: Scanner Badges Feature
 * 
 * This file shows how the ScannerBadges component renders in different scenarios
 * Run with: npx tsx SCANNER_BADGES_DEMO.tsx
 */

// ASCII Art Visualization of Scanner Badges

const demo = `
╔════════════════════════════════════════════════════════════════════════════════╗
║                      CVE SCANNER BADGES - VISUAL DEMO                          ║
╚════════════════════════════════════════════════════════════════════════════════╝

┌─ Scenario 1: Single Scanner ─────────────────────────────────────────────────┐
│                                                                               │
│  CVE-2021-1234    [G]    ℹ️     HIGH                                         │
│  └─ Found by Grype only                                                      │
│                                                                               │
│  Color: Purple (bg-purple-600)                                              │
│  Info button links to: NVD details                                          │
└───────────────────────────────────────────────────────────────────────────────┘

┌─ Scenario 2: Multiple Scanners ──────────────────────────────────────────────┐
│                                                                               │
│  CVE-2021-5678    Found by 2: [G] [S]    ℹ️     CRITICAL                   │
│  └─ Found by Grype and Snyk                                                 │
│                                                                               │
│  Colors: Purple (Grype) + Emerald (Snyk)                                    │
│  Info button links to: Dropdown with 3 databases                            │
└───────────────────────────────────────────────────────────────────────────────┘

┌─ Scenario 3: All Enterprise Scanners ─────────────────────────────────────────┐
│                                                                               │
│  CVE-2021-9999    Found by 3: [G] [S] [C]    ℹ️     CRITICAL                │
│  └─ Found by Grype, Snyk, and Johnny                                   │
│                                                                               │
│  Colors: Purple + Emerald + Indigo                                          │
│  Info button: Hover to see dropdown menu                                    │
└───────────────────────────────────────────────────────────────────────────────┘

┌─ Scenario 4: No Scanners (Edge Case) ─────────────────────────────────────────┐
│                                                                               │
│  CVE-2021-0000    ℹ️     MEDIUM                                              │
│  └─ No badges shown (no reportedBy data)                                    │
└───────────────────────────────────────────────────────────────────────────────┘


╔════════════════════════════════════════════════════════════════════════════════╗
║                         SCANNER COLOR PALETTE                                  ║
╚════════════════════════════════════════════════════════════════════════════════╝

  Grype (G)           Snyk (S)           Johnny (C)    Trivy (T)
  ┌─────────┐         ┌─────────┐       ┌─────────────┐     ┌─────────┐
  │    G    │         │    S    │       │      C      │     │    T    │
  │ PURPLE  │         │ EMERALD │       │   INDIGO    │     │  CYAN   │
  │ #9333EA │         │ #10B981 │       │   #4F46E5   │     │ #06B6D4 │
  └─────────┘         └─────────┘       └─────────────┘     └─────────┘

  OWASP (O)           DAST (D)
  ┌──────────┐        ┌──────────┐
  │    O     │        │    D     │
  │  ORANGE  │        │   ROSE   │
  │  #EA580C │        │  #E11D48 │
  └──────────┘        └──────────┘


╔════════════════════════════════════════════════════════════════════════════════╗
║                         INFO BUTTON DROPDOWN                                   ║
╚════════════════════════════════════════════════════════════════════════════════╝

  Click or hover the ℹ️ button to see:

  ┌──────────────────┐
  │  📋 NVD          │
  │  🔍 CVE.org      │
  │  ⚙️  GitHub       │
  └──────────────────┘

  Each option opens in a new tab with CVE-specific information:
  - NVD: National Vulnerability Database (NIST)
  - CVE.org: Official CVE Record  
  - GitHub: GitHub Security Advisory Search


╔════════════════════════════════════════════════════════════════════════════════╗
║                           HOVER INTERACTIONS                                   ║
╚════════════════════════════════════════════════════════════════════════════════╝

  Scanner Badge Hover:
  ┌─────┐
  │ [G] │ ← Hover to see "Grype" tooltip
  └─────┘  ← Shadow increases (hover:shadow-lg)
           ← Background darkens slightly

  Info Button Hover:
  ┌───┐
  │ ℹ️ │ ← Dropdown appears above
  └───┘
     ┌──────────────────┐
     │  📋 NVD          │
     │  🔍 CVE.org      │
     │  ⚙️  GitHub       │
     └──────────────────┘


╔════════════════════════════════════════════════════════════════════════════════╗
║                          RESPONSIVE SIZING                                     ║
╚════════════════════════════════════════════════════════════════════════════════╝

  Mobile (< md):
  [G] [S] [C]  ← 36x36 pixels (w-9 h-9)

  Desktop (>= md):
  [G] [S] [C]  ← 40x40 pixels (w-10 h-10)


╔════════════════════════════════════════════════════════════════════════════════╗
║                      ACCESSIBILITY FEATURES                                    ║
╚════════════════════════════════════════════════════════════════════════════════╝

  ✓ ARIA labels on all interactive elements
  ✓ Visible focus rings (focus:ring-2)
  ✓ Keyboard navigation (Tab, Enter)
  ✓ Semantic HTML (links, buttons)
  ✓ Color not the only indicator (text labels included)
  ✓ Tooltips for scanner names
  ✓ Sufficient color contrast ratios (WCAG AA)


╔════════════════════════════════════════════════════════════════════════════════╗
║                         USAGE EXAMPLE                                          ║
╚════════════════════════════════════════════════════════════════════════════════╝

  import { ScannerBadges } from '@src/reports/ScannerBadges';

  // Show badges for a CVE found by multiple scanners
  <ScannerBadges 
    cveId="CVE-2024-1234"
    reportedBy={['grype', 'snyk', 'codescoring_johnny']}
  />

  // Show just the info button (no scanner badges)
  <ScannerBadges 
    cveId="CVE-2024-5678"
    reportedBy={[]}
  />


═══════════════════════════════════════════════════════════════════════════════════
`;

console.log(demo);

// Summary
console.log('\n✨ FEATURE SUMMARY:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('• Large colored scanner badges with 3D shadow effects');
console.log('• Visual indicators for multi-scanner CVE detection');
console.log('• Quick links to external CVE databases (NVD, CVE.org, GitHub)');
console.log('• Hover tooltips and interactive dropdowns');
console.log('• Fully responsive (mobile & desktop optimized)');
console.log('• Accessible (WCAG AA compliant)');
console.log('• Zero additional database queries');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
