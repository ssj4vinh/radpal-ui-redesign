# AI Prompt Preview Feature

## Overview

Added a new **"Preview AI Prompt"** button to the Logic Editor that shows exactly how your logic settings will be translated into the actual AI prompt sent to GPT/Claude.

## Features

### 🤖 Preview AI Prompt Button
- Located in the top toolbar with a purple color
- Shows robot emoji icon for easy identification
- Available in all modes (Base, Study-Specific, Preview)

### Preview Modal
When clicked, opens a modal that displays:

1. **Header**
   - Shows current mode (Base Logic, Study-Specific, or Merged)
   - Indicates which study type is selected

2. **Formatted Prompt Preview**
   - Shows the complete AI prompt that will be sent
   - Organized into clear sections:
     - FORMATTING RULES
     - REPORT GENERATION
     - IMPRESSION SECTION
     - ANATOMY ORGANIZATION
     - CLINICAL CORRELATION
     - MEASUREMENTS
     - WRITING STYLE
     - CUSTOM INSTRUCTIONS

3. **Dynamic Content**
   - Only shows rules that are enabled
   - Lists exclusions with bullet points
   - Numbers custom instructions
   - Converts underscores to readable text

4. **Copy to Clipboard**
   - Button to copy the entire prompt
   - Toast notification confirms copy success

## Example Preview Output

```
=== AI PROMPT PREVIEW ===

You are a radiologist assistant. Generate a report based on the following guidelines:

## FORMATTING RULES:
- Preserve exact punctuation from the template
- Capitalize all section headers

## REPORT GENERATION:
- CRITICAL: Only report findings explicitly mentioned in the input. Do NOT invent or assume findings.

## IMPRESSION SECTION:
- Number each impression item (1, 2, 3, etc.)
- The first impression item MUST directly address the clinical question
- EXCLUDE these minor findings from the impression unless clinically significant:
  • small joint effusion
  • trace bursitis
  • mild tendinosis
- Only mention muscle atrophy if it is moderate or severe

## CUSTOM INSTRUCTIONS:
1. Always compare to prior studies when available
2. Include all relevant measurements

=== END OF PROMPT ===
```

## Benefits

1. **Transparency**: Users can see exactly what instructions the AI receives
2. **Debugging**: Helps understand why reports are generated a certain way
3. **Learning**: Users can learn how settings affect the AI behavior
4. **Validation**: Verify that logic settings are correctly configured
5. **Sharing**: Copy prompt to share configurations with colleagues

## How to Use

1. Open the Logic Editor
2. Configure your logic settings (base or study-specific)
3. Click the **"🤖 Preview AI Prompt"** button
4. Review the generated prompt
5. Optionally copy to clipboard for documentation or sharing

## Technical Details

- Prompt generation based on current display logic
- Real-time: reflects current unsaved changes
- Mode-aware: shows base, study, or merged logic
- Readable formatting with proper line breaks and sections
- Keyboard shortcut: Escape key closes the preview modal