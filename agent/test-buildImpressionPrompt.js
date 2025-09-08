// Test script to demonstrate the refactored buildImpressionPrompt function
// Run with: node agent/test-buildImpressionPrompt.js

const buildImpressionPrompt = require('./buildImpressionPrompt.ts').default;

// Sample agent_logic with nested structures for impressions
const sampleAgentLogic = {
  version: "2.0",
  formatting: {
    use_bullet_points: false,
    capitalize_diagnoses: true
  },
  report: {
    no_hallucinated_findings: true,
    cartilage_placement: {
      group_cartilage_by_compartment_in_impression: true,
      mention_grade_in_impression: true
    },
    anatomic_routing_rules: {
      impression_order: "ligaments, menisci, cartilage, osseous, other",
      group_pathology_by_type: true
    }
  },
  impression: {
    numerically_itemized: true,
    omit_minor_or_incidental_findings_unless_relevant: true,
    concise_summary: true,
    include_recommendations: true,
    first_item_should_address_clinical_concern: true,
    exclude_by_default: [
      "Small joint effusions",
      "Small Baker's cysts", 
      "Mild bone marrow edema",
      "Minimal synovitis"
    ],
    mention_muscle_atrophy_if: "moderate_or_severe",
    combine_compartments: true,
    exclude_unless_surgical: [
      "Low-grade partial tears",
      "Mild degenerative changes"
    ],
    severity_classification: true,
    prioritize_by_urgency: true
  },
  clinical: {
    correlate_with_symptoms: true,
    mention_clinical_significance: true,
    suggest_follow_up: true,
    include_acuity: true,
    management_implications: true
  },
  custom_impression_instructions: [
    "Always start with ligamentous injuries if present",
    "Group bone contusions with associated ligament tears"
  ]
};

const sampleTemplate = `
FINDINGS:
Ligaments/tendons: [describe findings]
Menisci: [describe findings]  
Cartilage: [describe findings]

IMPRESSION:
[numbered list of key findings]
`;

const sampleFindings = `Complete ACL tear with associated bone marrow edema in the lateral compartment. 
Horizontal tear of the posterior horn of the medial meniscus.
Grade 3 cartilage defect in the medial femoral condyle.
Small joint effusion. Mild quadriceps atrophy.`;

console.log('=== TESTING REFACTORED buildImpressionPrompt.ts ===\n');

try {
  const generatedPrompt = buildImpressionPrompt(sampleFindings, sampleTemplate, sampleAgentLogic);
  
  console.log('\nGenerated Impression Prompt:');
  console.log('===========================');
  console.log(generatedPrompt);
  
} catch (error) {
  console.error('Error testing buildImpressionPrompt:', error);
}