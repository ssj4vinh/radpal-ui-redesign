-- Create function to get all global prompt sections
CREATE OR REPLACE FUNCTION get_global_prompt_sections(p_user_id UUID)
RETURNS TABLE (
    report_base_prompt TEXT,
    impression_base_prompt TEXT,
    global_findings_rules JSONB,
    global_impression_rules JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gbp.base_prompt as report_base_prompt,
        gbp.impression_base_prompt as impression_base_prompt,
        gbp.global_findings_rules as global_findings_rules,
        gbp.global_impression_rules as global_impression_rules
    FROM global_base_prompt gbp
    WHERE gbp.id = 1;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_global_prompt_sections(UUID) TO authenticated;