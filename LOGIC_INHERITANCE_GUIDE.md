# Logic Inheritance System Guide

## Overview
The RadPal app now supports a powerful **logic inheritance system** that reduces token usage and improves customization flexibility. Instead of duplicating entire logic configurations for each study type, you can now:

1. **Set base logic once** that applies to ALL study types
2. **Override specific settings** per study type as needed
3. **View the final merged result** to see exactly what will be sent to GPT

## How to Use

### Opening the Logic Editor
Click the "Logic Editor" button in the settings or from any template management screen.

### Three Edit Modes

The enhanced logic editor provides three modes accessible via buttons at the top:

#### 1. 🔵 **Edit Base Logic** (Blue Button)
- **What it does**: Edits logic that applies to ALL your study types
- **When to use**: Set your general preferences like:
  - Whether to use bullet points
  - How to format impressions (numbered, concise, etc.)
  - Common exclusions (trace findings, minimal changes)
  - Report formatting preferences
- **Impact**: Changes here affect every template unless specifically overridden

#### 2. 🟣 **Edit Study-Specific Logic** (Purple Button)
- **What it does**: Override base settings for a specific study type
- **When to use**: When a particular study needs different settings:
  - MRI Knee might need different exclusions than CT Chest
  - Some studies might need technique sections while others don't
  - Certain studies require specific formatting
- **Smart storage**: Only stores the differences from base logic (reduces token usage)

#### 3. 🟢 **Preview Merged Logic** (Green Button)
- **What it does**: Shows the final combined logic that will be sent to GPT
- **Visual indicators**: Each setting shows where it comes from:
  - `from default` - System default (built-in)
  - `from base` - Your base logic
  - `from study` - Study-specific override
- **Read-only view**: For verification only, no editing

### Additional Features

#### 🟠 **Show Diff** (Orange Button - Study Mode Only)
- Shows exactly what's different from the base logic
- Helpful for understanding what overrides are in place
- Only appears when study-specific overrides exist

#### Timestamps
- Each mode shows when it was last updated
- Helps track recent changes

#### Reset to Default
- Available in both Base and Study modes
- Base reset: Restores system defaults for all templates
- Study reset: Removes all study-specific overrides (uses base logic only)

## Migration Path

### For Existing Users
1. Your existing templates will continue to work unchanged
2. The first time you edit logic, existing settings will be preserved
3. You can gradually migrate to the inheritance system by:
   - Setting common preferences in base logic
   - Removing duplicates from study-specific logic

### Token Savings Example

**Before (Old System):**
- Each template: ~500 tokens of logic
- 10 templates = 5,000 tokens per session

**After (New System):**
- Base logic: 500 tokens (shared)
- Study overrides: ~50 tokens each
- 10 templates = 500 + (50 × 10) = 1,000 tokens per session
- **80% reduction in token usage!**

## Best Practices

1. **Start with Base Logic**
   - Set your general preferences first
   - Include common exclusions and formatting rules
   - Think "what applies to most of my reports?"

2. **Use Study-Specific Sparingly**
   - Only override when truly needed
   - Keep overrides minimal and focused
   - Document why certain studies need different settings

3. **Review Merged Logic**
   - Always preview before generating reports
   - Verify inheritance is working as expected
   - Check source indicators to understand logic flow

4. **Offline Support**
   - All logic changes work offline
   - Syncs automatically when connection restored
   - Local storage maintains full functionality

## Technical Details

### Database Schema
- `default_agent_logic`: Stores base logic (JSONB)
- `agent_logic`: Stores study-specific overrides (JSONB)
- Both columns support partial updates (only store differences)

### Inheritance Order
1. System defaults (hardcoded)
2. User's base logic (`default_agent_logic`)
3. Study-specific overrides (`agent_logic`)

Each layer overrides/extends the previous one.

### Backward Compatibility
- Templates without `default_agent_logic` use `agent_logic` directly
- Empty `agent_logic` falls back to base logic
- Old templates continue working without modification

## Troubleshooting

### Logic Not Updating?
1. Check you're in the correct mode (Base vs Study)
2. Ensure you clicked "Save Changes"
3. Refresh the logic editor to see latest changes

### Unexpected Behavior?
1. Use Preview mode to see final merged logic
2. Check source indicators for each setting
3. Review both base and study-specific settings

### Performance Issues?
- The inheritance system actually improves performance
- Smaller payloads = faster API calls
- Less data to process and store

## Support

For issues or questions about the logic inheritance system:
1. Check the preview mode to understand current configuration
2. Use the "Show Diff" feature to see overrides
3. Reset to defaults if configuration becomes unclear
4. Report issues at: https://github.com/anthropics/claude-code/issues