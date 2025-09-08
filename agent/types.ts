export interface AgentLogic {
  version?: string
  instructions?: string
  steps?: Array<{
    name: string
    description?: string
    prompt?: string
  }>
  context?: Record<string, any>
  examples?: Array<{
    input: string
    output: string
  }>
  reportSpecific?: {
    includeAllSections?: boolean
    sectionOrder?: string[]
    customSections?: Record<string, string>
  }
  impressionSpecific?: {
    style?: 'concise' | 'detailed' | 'structured'
    includeRecommendations?: boolean
    maxLength?: number
  }
  report?: {
    no_hallucinated_findings?: boolean
    include_technique_section?: boolean
    include_comparison?: boolean
    use_medical_abbreviations?: boolean
    expand_lesions?: boolean
    cartilage_placement?: {
      trochlear_cartilage_in_patellofemoral?: boolean
      mention_patellar_if_trochlear_defect_present?: boolean
    }
    anatomic_routing_rules?: {
      loose_bodies?: string
      bone_contusions?: string
      joint_effusions?: string
    }
  }
  impression?: {
    numerically_itemized?: boolean
    omit_minor_or_incidental_findings_unless_relevant?: boolean
    concise_summary?: boolean
    include_recommendations?: boolean
    differential_diagnosis?: boolean
    severity_classification?: boolean
    prioritize_by_urgency?: boolean
    first_item_should_address_clinical_concern?: boolean
    exclude_by_default?: string[]
    mention_muscle_atrophy_if?: string
    combine_compartments?: boolean
    exclude_unless_surgical?: string[]
  }
  formatting?: {
    preserve_template_punctuation?: boolean
    use_bullet_points?: boolean
    capitalize_sections?: boolean
  }
}

export interface ModelResponse {
  text: string
  tokens?: {
    input: number
    output: number
    total: number
  }
  model?: string
  error?: string
}

export interface GenerateOptions {
  userId: string
  studyType: string
  findings: string
  model?: string
  apiProvider?: 'openai' | 'claude-sonnet' | 'claude-opus' | 'gemini' | 'kimi'
  temperature?: number
}