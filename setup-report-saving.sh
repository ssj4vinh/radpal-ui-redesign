#!/bin/bash

echo "🚀 Setting up Report Saving Feature"
echo "===================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in the radpal project directory"
    exit 1
fi

echo "📦 Installing dependencies (if needed)..."
# Install date-fns if not already installed
npm list date-fns &>/dev/null || npm install date-fns

echo "✅ Dependencies installed"

echo ""
echo "📝 Files created:"
echo "  ✓ /electron/reportIPC.js - IPC handlers"
echo "  ✓ /src/supabase/reportQueries.ts - Database queries"
echo "  ✓ /src/hooks/useReports.ts - React hook"
echo "  ✓ /src/components/ReportSaver.tsx - Save UI component"
echo "  ✓ /src/components/ReportHistory.tsx - History UI component"
echo "  ✓ /supabase/migrations/create_reports_table.sql - Database schema"
echo "  ✓ /docs/REPORT_SAVING_INTEGRATION.md - Integration guide"

echo ""
echo "🔧 Next steps:"
echo "1. Run the SQL migration on your Supabase dashboard:"
echo "   - Go to SQL Editor in Supabase"
echo "   - Copy contents of /supabase/migrations/create_reports_table.sql"
echo "   - Run the SQL"
echo ""
echo "2. Build the project:"
echo "   npm run build"
echo ""
echo "3. Test in development:"
echo "   npm run dev"
echo ""
echo "✅ Setup complete! Check /docs/REPORT_SAVING_INTEGRATION.md for integration instructions."