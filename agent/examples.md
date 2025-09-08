# Agent Architecture Examples

## Sample agent_logic Configuration

```json
{
  "version": "2.0",
  "formatting": {
    "preserve_template_punctuation": true,
    "use_bullet_points": true,
    "capitalize_sections": true
  },
  "report": {
    "no_hallucinated_findings": true,
    "include_technique_section": true,
    "expand_lesions": true,
    "cartilage_placement": {
      "trochlear_cartilage_in_patellofemoral": true,
      "mention_patellar_if_trochlear_defect_present": true
    },
    "anatomic_routing_rules": {
      "loose_bodies": "joints",
      "bone_contusions": "ossea_or_bone_marrow",
      "joint_effusions": "joint_space"
    }
  },
  "impression": {
    "numerically_itemized": true,
    "omit_minor_or_incidental_findings_unless_relevant": true,
    "concise_summary": true,
    "include_recommendations": true,
    "first_item_should_address_clinical_concern": true,
    "exclude_by_default": [
      "Small joint effusions",
      "Small Baker's cysts",
      "Mild bone marrow edema"
    ],
    "mention_muscle_atrophy_if": "moderate_or_severe"
  },
  "anatomy": {
    "combine_meniscus_and_cartilage_findings": true,
    "group_by_anatomic_region": true
  },
  "clinical": {
    "correlate_with_symptoms": true,
    "mention_clinical_significance": true
  },
  "measurements": {
    "include_all_measurements": true,
    "use_metric_system": true
  },
  "severity": {
    "use_standard_grading": true,
    "avoid_vague_terms": true
  },
  "style": {
    "active_voice": true,
    "professional_tone": true
  },
  "custom_instructions": [
    "Always mention joint effusion volume when present",
    "Include ACL fiber continuity assessment"
  ],
  "impression_examples": [
    {
      "findings": "Complete ACL tear with bone marrow edema",
      "impression": "1. Complete anterior cruciate ligament tear\n2. Associated bone contusions in lateral compartment"
    }
  ]
}
```

## How It Works

1. **Template Query**: The system queries the `templates` table for the user's specific study type template and `agent_logic` JSONB configuration.

2. **Dynamic Prompt Building**: The `buildPrompt.ts` function processes the agent logic and creates instructions like:

### Generated Instructions from Sample Config:

**For Report Generation:**
```
Instructions:
1. Preserve all punctuation and formatting exactly as shown in the template.
2. Use bullet points for listing multiple findings within each section.
3. Ensure all section headers are in UPPERCASE.
4. Do not invent findings. Only report what is explicitly stated in the findings.
5. Include a TECHNIQUE section describing the imaging protocol used.
6. For each lesion, describe location, size, morphology, and enhancement characteristics.
7. Ensure trochlear cartilage findings are included in the patellofemoral compartment.
8. If a trochlear defect is present, confirm that the patellar cartilage is explicitly stated as intact or abnormal.
9. Describe loose bodies under the joints section.
10. Describe bone contusions under the osseous structures or bone marrow section.
11. Describe joint effusions under the joint space section.
12. Write the impression as a numbered list.
13. In the impression, omit mild or incidental findings unless relevant to the clinical history.
14. Keep the impression concise, focusing on clinically significant findings.
15. Include follow-up recommendations when appropriate.
16. The first impression item should address the clinical concern.
17. Do not include the following unless clinically relevant: Small joint effusions, Small Baker's cysts, Mild bone marrow edema.
18. Only mention muscle atrophy if it is moderate or severe.
```

**For Impression Generation (with enhanced logic):**
```
Instructions:
1. Generate ONLY the IMPRESSION section - do not include findings or other report sections.
2. Write the impression as a numbered list.
3. Omit mild or incidental findings unless relevant to the clinical history.
4. Keep the impression concise, focusing only on clinically significant findings.
5. Include follow-up recommendations when appropriate.
6. Classify findings by severity (mild, moderate, severe) when applicable.
7. List findings in order of clinical urgency, most urgent first.
8. The first impression item should address the clinical concern.
9. Do not include the following unless clinically relevant: Small joint effusions, Small Baker's cysts, Mild bone marrow edema, Minimal synovitis.
10. Only mention muscle atrophy if it is moderate or severe.
11. Combine meniscus and cartilage findings by compartment (e.g., medial/lateral) in the impression.
12. Exclude the following findings unless they require surgical intervention: Low-grade partial tears, Mild degenerative changes.
13. Do not invent findings. Only summarize what is explicitly stated in the findings.
14. Group cartilage findings by compartment (medial, lateral, patellofemoral) in the impression.
15. Include cartilage defect grades in the impression when available.
16. Organize impression findings in this order: ligaments, menisci, cartilage, osseous, other.
17. Group similar pathology together in the impression (e.g., all ligament tears, all cartilage defects).
18. Correlate impression with clinical symptoms when provided.
19. Comment on the clinical significance of findings.
20. Suggest appropriate follow-up when indicated.
21. Specify whether findings are acute, chronic, or acute-on-chronic when determinable.
22. Include management implications for significant findings.
```

3. **Model Generation**: The composed prompt is sent to the selected AI model (GPT, Claude, Gemini, or Kimi).

## Key Benefits

- **Highly Customizable**: Each user can have different logic for the same study type
- **No Code Changes**: Logic updates happen in the database without redeployment
- **Granular Control**: Fine-tune formatting, content, and style preferences
- **Consistent Output**: Standardized instructions ensure predictable results
- **Template Flexibility**: Works with any template structure

## Migration Path

The system maintains backward compatibility - if no `agent_logic` is found, it defaults to basic prompt construction.