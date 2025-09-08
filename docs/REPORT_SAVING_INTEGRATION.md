# Report Saving Integration Guide

## Overview
This guide explains how to integrate the new report saving mechanism into your RadPal application. The system allows you to save findings, initial AI-generated results, and edited results to Supabase.

## Components Created

### 1. Database Schema (`/supabase/migrations/create_reports_table.sql`)
- Creates a `reports` table with fields for:
  - `findings`: Original input from the user
  - `initial_result`: AI-generated report
  - `edited_result`: User's edited version
  - `model_used`: Which AI model was used
  - `tokens_used`: Token consumption tracking
  - `prompt_used`: The prompt sent to the AI

### 2. Backend Components

#### IPC Handlers (`/electron/reportIPC.js`)
Handles all report operations through IPC:
- `report:save` - Save a new report
- `report:update` - Update an existing report
- `report:get` - Get a specific report
- `report:getUserReports` - Get all user reports
- `report:getByStudyType` - Get reports by study type
- `report:delete` - Delete a report
- `report:search` - Search reports

#### Supabase Queries (`/src/supabase/reportQueries.ts`)
TypeScript interface and query functions for report operations.

### 3. Frontend Components

#### `useReports` Hook (`/src/hooks/useReports.ts`)
Main hook for managing report state:
```typescript
const {
  reports,
  currentReport,
  saveReport,
  updateReport,
  loadUserReports,
  deleteReport,
  searchReports
} = useReports()
```

#### `ReportSaver` Component (`/src/components/ReportSaver.tsx`)
UI component for saving reports with auto-save capability:
```tsx
<ReportSaver
  studyType={selectedStudyType}
  findings={findings}
  initialResult={generatedReport}
  editedResult={editedReport}
  modelUsed={apiProvider}
  tokensUsed={tokenInfo}
  promptUsed={prompt}
  onReportSaved={(report) => console.log('Report saved:', report)}
/>
```

#### `ReportHistory` Component (`/src/components/ReportHistory.tsx`)
UI component for viewing and managing saved reports:
```tsx
<ReportHistory
  studyType={selectedStudyType}
  onReportSelect={(report) => {
    // Load the report into the editor
    setFindings(report.findings)
    setGeneratedReport(report.initial_result)
    setEditedReport(report.edited_result)
  }}
/>
```

## Integration Steps

### 1. Run Database Migration
Apply the migration to your Supabase instance to create the reports table.

### 2. Update Main Process
The IPC handlers are already registered in `/electron/main.js`. No additional changes needed.

### 3. Integrate into App.tsx

Add the report saving functionality to your main App component:

```tsx
import { ReportSaver } from './components/ReportSaver'
import { ReportHistory } from './components/ReportHistory'
import { useReports } from './hooks/useReports'

function App() {
  const { currentReport, saveReport } = useReports()
  
  // After generating a report with AI
  const handleGenerate = async () => {
    const agentResult = await generateReportWithAgent(...)
    
    // Auto-save the report
    await saveReport(
      selectedStudyType,
      findings,
      agentResult.text,
      apiProvider,
      agentResult.tokens,
      agentResult.prompt
    )
  }
  
  return (
    <>
      {/* Add report history button */}
      <ReportHistory
        studyType={selectedStudyType}
        onReportSelect={handleReportSelect}
      />
      
      {/* Add report saver */}
      <ReportSaver
        studyType={selectedStudyType}
        findings={findings}
        initialResult={generatedReport}
        editedResult={editedReport}
        modelUsed={apiProvider}
        tokensUsed={tokenInfo}
      />
      
      {/* Your existing editor components */}
    </>
  )
}
```

## Features

### Auto-Save
The `ReportSaver` component includes an auto-save toggle that will:
- Save the report automatically when generated
- Update the report every 5 seconds when edited

### Report Stages
1. **Findings**: Original input text
2. **Initial Result**: First AI generation (immutable)
3. **Edited Result**: User's modifications

### Report Management
- Search reports by content
- Filter by study type
- View report history with timestamps
- Delete old reports
- Track which reports have been edited

## API Reference

### Save a Report
```typescript
const report = await saveReport(
  studyType: string,
  findings: string,
  initialResult: string,
  modelUsed?: string,
  tokensUsed?: TokenInfo,
  promptUsed?: string
)
```

### Update a Report
```typescript
const success = await updateReport(
  reportId: string,
  editedResult: string
)
```

### Load Reports
```typescript
// Load all user reports
await loadUserReports(limit?: number, offset?: number)

// Load by study type
await loadReportsByStudyType(studyType: string)

// Search reports
await searchReports(searchTerm: string)
```

## Notes
- Reports are automatically associated with the authenticated user
- Row-level security ensures users can only see their own reports
- Full-text search is enabled on findings and results
- The system tracks whether a report has been edited (isDirty flag)