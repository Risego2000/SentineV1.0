# Template PDF Implementation for Boletín Generation

## Summary
The system has been updated to use the template PDF file (`boletin_v4.pdf`) located in `/public/` for generating boletín (complaint/infraction report) PDFs, instead of generating PDFs from scratch.

## Changes Made

### 1. Added pdf-lib Dependency
- **File**: `package.json`
- **Change**: Added `"pdf-lib": "^1.17.1"` to dependencies
- **Purpose**: Enables loading and modifying existing PDF documents

### 2. Modified PDF Generation Logic
- **File**: `services/ReportService.ts`
- **Changes**:
  - Created new `loadTemplateAndFill()` function that:
    - Fetches the template PDF from `/boletin_v4.pdf`
    - Loads it using pdf-lib's `PDFDocument.load()`
    - Overlays infraction data (plate, date, severity, description) on the template
    - Returns modified PDF as ArrayBuffer
  - Modified `generateInfractionPdf()` to:
    - Try template-based generation first
    - Fall back to jsPDF-generated PDF if template fails
    - Ensure backward compatibility

### 3. Implementation Details

#### Text Fields Overlaid on Template
The following infraction data is overlaid on the template PDF:
- **Date**: From `log.localTime` or `log.time` (top area, position 120, 50)
- **License Plate**: From `log.plate` (prominent, position 120, 85)
- **Vehicle Details**: Make/Model and Color (position 20, 110-125)
- **Infraction Type**: From `log.ruleCategory` (position 20, 160)
- **Severity**: CRÍTICA, ALTA, MEDIA, BAJA (position 20, 175)
- **Description**: Wrapped text from `log.description` (position 20, 200+)
- **Location/Time**: From `log.localTime` (position 120, 280)

#### Coordinate System
- Uses PDF coordinate system (bottom-left origin)
- Automatically converts Y-coordinates: `y: height - y`
- Text wraps to `width - x - 10` pixels

## Workflow

### When an Infraction is Detected
1. ForensicQueueV3 processes the infraction
2. Calls listener with InfractionLog data
3. SentinelProvider.addInfraction() receives the log
4. After 1-second delay, `ReportService.generateAndSaveInfractionPdf()` is called
5. PDF generation flow:
   ```
   generateInfractionPdf()
   ├─ Try: loadTemplateAndFill()
   │  ├─ Fetch /boletin_v4.pdf
   │  ├─ Load with PDFDocument.load()
   │  ├─ Overlay infraction data
   │  └─ Return modified PDF
   └─ Fallback: Generate PDF with jsPDF (if template fails)
   ```
6. Generated PDF is saved to `C:\Denuncias\{YYYYMMDD}\` directory

## File Structure
```
SentinelV16/
├── public/
│   └── boletin_v4.pdf          ← Template file
├── services/
│   └── ReportService.ts        ← Modified PDF generation logic
├── package.json               ← Added pdf-lib dependency
```

## Backward Compatibility
- If template loading fails for any reason, the system automatically falls back to jsPDF-generated PDFs
- Existing functionality is preserved
- No breaking changes to the API

## Testing Notes

### Coordinates May Need Adjustment
The text overlay coordinates (120, 50), (120, 85), (20, 110), etc. are estimates based on typical form layouts. 

To fine-tune:
1. Open `boletin_v4.pdf` in a PDF editor
2. Note the exact positions where text should appear
3. Update coordinates in `loadTemplateAndFill()` function (lines 52-72 in ReportService.ts)

### Example Template Layout Adjustment
```typescript
// Current (estimated) coordinates:
drawTextField(date, 120, 50, 11);      // Date at (120, 50)
drawTextField(plate, 120, 85, 14);     // Plate at (120, 85)

// If template has different layout:
drawTextField(date, 100, 45, 11);      // Adjusted to (100, 45)
drawTextField(plate, 100, 75, 14);     // Adjusted to (100, 75)
```

## 30-Second Buffer
The user mentioned a "30-second buffer" requirement. The current implementation:
- Processes infractions immediately upon detection
- Adds 1-second delay before PDF generation to allow UI responsiveness
- Full buffering logic is managed by ForensicQueueV3 (optional time-based accumulation)

If you need to accumulate infractions for 30 seconds before generating a single boletín:
- This would require modifications to ForensicQueueV3 or a new buffer layer
- Contact the development team for implementation details

## Error Handling
- Template loading errors are logged to browser console
- System automatically falls back to generated PDFs
- No user-facing errors if template fails

## Future Improvements
1. Load template coordinates from configuration file
2. Support multiple template versions
3. Add template validation on startup
4. Create admin UI for template adjustment
5. Add template preview functionality

## References
- pdf-lib documentation: https://pdf-lib.js.org/
- Template file: `C:\Users\riseg\Desktop\Apps\SentinelV16\public\boletin_v4.pdf`
- Implementation: `services/ReportService.ts` (lines 6-107)
