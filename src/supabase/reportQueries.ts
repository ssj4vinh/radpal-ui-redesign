import { supabase } from '../lib/supabase'

export interface Report {
  id?: string
  user_id: string
  study_type: string
  findings: string // Original findings input
  initial_result: string // Initial AI-generated result
  edited_result?: string // User-edited final result
  model_used?: string // Model used for generation
  tokens_used?: {
    input: number
    output: number
    total: number
  }
  prompt_used?: string // The prompt that was used
  user_feedback?: string // Optional feedback about what was wrong with the output
  created_at?: string
  updated_at?: string
  metadata?: Record<string, any> // Additional metadata if needed
}

export const reportQueries = {
  // Save a new report
  async saveReport(report: Omit<Report, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('reports')
      .insert([{
        ...report,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Update an existing report (e.g., with edited result)
  async updateReport(id: string, updates: Partial<Report>) {
    const { data, error } = await supabase
      .from('reports')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Get a specific report
  async getReport(id: string) {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  // Get all reports for a user
  async getUserReports(userId: string, limit = 50, offset = 0) {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return data
  },

  // Get reports by study type
  async getReportsByStudyType(userId: string, studyType: string) {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', userId)
      .eq('study_type', studyType)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  // Delete a report
  async deleteReport(id: string) {
    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // Search reports by findings or results
  async searchReports(userId: string, searchTerm: string) {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', userId)
      .or(`findings.ilike.%${searchTerm}%,initial_result.ilike.%${searchTerm}%,edited_result.ilike.%${searchTerm}%`)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  }
}