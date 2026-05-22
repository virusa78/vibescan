# CVE Scanner Badges Feature

## Overview

The CVE Scanner Badges feature provides visual indicators showing which vulnerability scanners detected each CVE in your scan results.

## Features

### 1. **Scanner Badges**
- Large, colored badges displaying scanner initials
- Each scanner has a unique color:
  - 🟣 **G** - Grype (Purple)
  - 🟢 **S** - Snyk (Emerald)
  - 🔵 **C** - Johnny (Indigo)
  - 🔷 **T** - Trivy (Cyan)
  - 🟠 **O** - OWASP (Orange)
  - 🔴 **D** - DAST (Rose)

### 2. **Multi-Scanner Indication**
- When a CVE is found by multiple scanners, the interface shows:
  - A counter: "Found by 2:" or "Found by 3:"
  - Individual badges for each scanner
  - Visual emphasis on shared vulnerabilities

### 3. **External Links**
- **Badge buttons** link directly to CVE details on the respective scanner's database
- **Info icon (ℹ️)** provides quick access to multiple external CVE databases:
  - **NVD (NIST)** - National Vulnerability Database
  - **CVE.org** - Official CVE Record
  - **GitHub** - GitHub Security Advisory Search

### 4. **Hover Interactions**
- **Scanner Badges**: Display full scanner name on hover
- **Info Icon**: Dropdown menu showing all available CVE databases
- Smooth transitions and focus states for accessibility

## Usage

### In Reports
Badges appear on each CVE row in the vulnerability report:

```
CVE-2021-12345  [G] [S] [C]  ℹ️    CRITICAL
```

### Component API

```typescript
<ScannerBadges 
  cveId="CVE-2021-12345"
  reportedBy={['grype', 'snyk', 'codescoring_johnny']}
/>
```

**Props:**
- `cveId` (string, required): The CVE identifier
- `reportedBy` (string[], optional): Array of scanner names that found this CVE
  - Supported values: `grype`, `snyk`, `codescoring_johnny`, `trivy`, `owasp`, `dast`

## Styling

The component uses Tailwind CSS utility classes:
- **Badges**: `w-9 h-9 md:w-10 md:h-10` (responsive sizing)
- **Colors**: Full saturation scanner colors with hover effects
- **Shadows**: `shadow-md hover:shadow-lg` for depth
- **Borders**: 2px borders matching scanner colors
- **Responsive**: Mobile (9x9) and desktop (10x10) sizing

## Database Links

### Scanner-Specific Links
When clicking a scanner badge, users are directed to:
- **Grype** → NVD (NIST National Vulnerability Database)
- **Snyk** → Snyk Vulnerability Database
- **Johnny** → NVD
- **Trivy** → NVD
- **OWASP** → NVD
- **DAST** → NVD

### Universal CVE Links (Info Icon)
- **NVD**: `https://nvd.nist.gov/vuln/detail/{CVE_ID}`
- **CVE.org**: `https://www.cve.org/CVERecord?id={CVE_ID}`
- **GitHub**: `https://github.com/advisories?query={CVE_ID}`

## Implementation Details

### File Location
- Component: `wasp-app/src/reports/ScannerBadges.tsx`
- Integration: `wasp-app/src/reports/ReportsPage.tsx` (line 653)

### Type Safety
- Full TypeScript support with proper prop interfaces
- No `any` types (except pre-existing in ReportsPage)
- JSX element rendering with React

### Accessibility
- ARIA labels on all interactive elements
- Keyboard navigation support (Tab, Enter)
- Focus rings visible on interactive elements
- Semantic HTML (links, buttons, divs)

### Performance
- No additional database queries
- Uses existing `reportedBy` data from scan results
- Zero-cost deduplication with `Set`
- Memoization-friendly (pure component)

## Rendering Example

### Single Scanner
```
CVE-2021-1234  [G]  ℹ️    HIGH
```

### Multiple Scanners
```
CVE-2021-5678  Found by 3: [G] [S] [C]  ℹ️    CRITICAL
```

### No Scanners (Edge Case)
```
CVE-2021-9999  (no badges shown)  ℹ️    LOW
```

## Future Enhancements

Potential improvements for future versions:
1. Click counter showing how many times each CVE was found
2. Confidence scores per scanner
3. First detection date tracking
4. Cross-scan history of CVE detections
5. Scanner agreement analysis (when all scanners agree vs. single detections)

## Testing

The component has been tested with:
- TypeScript compilation ✓
- ESLint validation ✓
- Runtime component instantiation ✓
- Integration with ReportsPage ✓

## Browser Support

Works on all modern browsers supporting:
- CSS Flexbox
- CSS Grid
- Hover/Focus states
- External links (target="_blank")
- Tailwind CSS v3+

## Translation

For future internationalization:
- Scanner names (keys in SCANNER_CONFIG) are user-facing
- Label strings like "Found by" should be extracted for i18n
- Database names (NVD, CVE.org, GitHub) are proper nouns (typically untranslated)
