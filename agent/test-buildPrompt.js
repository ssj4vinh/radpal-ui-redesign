// Test script to demonstrate the refactored buildPrompt function
// Run with: node agent/test-buildPrompt.js

const buildPrompt = require('./buildPrompt.ts').default;

// Sample agent_logic with nested structures
const sampleAgentLogic = {
  version: "2.0",
  formatting: {
    preserve_template_punctuation: true,
    use_bullet_points: true,
    capitalize_sections: true
  },
  report: {
    no_hallucinated_findings: true,
    include_technique_section: true,
    expand_lesions: true,
    cartilage_placement: {
      trochlear_cartilage_in_patellofemoral: true,
      mention_patellar_if_trochlear_defect_present: true
    },
    anatomic_routing_rules: {
      loose_bodies: "joints",
      bone_contusions: "ossea_or_bone_marrow", 
      joint_effusions: "joint_space"
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
      "Mild bone marrow edema"
    ],
    mention_muscle_atrophy_if: "moderate_or_severe"
  },
  custom_instructions: [
    "Always mention joint effusion volume when present",
    "Include ACL fiber continuity assessment"
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

const sampleFindings = "Complete ACL tear with associated bone marrow edema in the lateral compartment.";

console.log('=== TESTING REFACTORED buildPrompt.ts ===\n');

try {
  const generatedPrompt = buildPrompt(sampleFindings, sampleTemplate, sampleAgentLogic);
  
  console.log('Generated Prompt:');
  console.log('================');
  console.log(generatedPrompt);
  
} catch (error) {
  console.error('Error testing buildPrompt:', error);
}