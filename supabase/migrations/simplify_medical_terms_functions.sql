-- Simplify the init_default_medical_terms function
CREATE OR REPLACE FUNCTION init_default_medical_terms(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Only insert if user has no terms yet
  IF NOT EXISTS (SELECT 1 FROM medical_terms WHERE user_id = p_user_id) THEN
    -- Insert essential anatomy terms
    INSERT INTO medical_terms (user_id, term, weight, category) VALUES
      (p_user_id, 'acetabulum', 4, 'anatomy'),
      (p_user_id, 'acetabular', 3, 'anatomy'),
      (p_user_id, 'gluteus', 3, 'anatomy'),
      (p_user_id, 'gluteal', 3, 'anatomy'),
      (p_user_id, 'medius', 3, 'anatomy'),
      (p_user_id, 'minimus', 3, 'anatomy'),
      (p_user_id, 'maximus', 3, 'anatomy'),
      (p_user_id, 'meniscus', 3, 'anatomy'),
      (p_user_id, 'meniscal', 3, 'anatomy'),
      (p_user_id, 'menisci', 3, 'anatomy'),
      (p_user_id, 'cruciate', 3, 'anatomy'),
      (p_user_id, 'collateral', 3, 'anatomy'),
      (p_user_id, 'labrum', 3, 'anatomy'),
      (p_user_id, 'labral', 3, 'anatomy'),
      (p_user_id, 'chondral', 3, 'anatomy'),
      (p_user_id, 'chondrolabral', 3, 'anatomy'),
      (p_user_id, 'supraspinatus', 3, 'anatomy'),
      (p_user_id, 'infraspinatus', 3, 'anatomy'),
      (p_user_id, 'subscapularis', 3, 'anatomy'),
      (p_user_id, 'piriformis', 3, 'anatomy'),
      
      -- Common pathology terms
      (p_user_id, 'tendinosis', 3, 'pathology'),
      (p_user_id, 'tendinopathy', 3, 'pathology'),
      (p_user_id, 'tenosynovitis', 3, 'pathology'),
      (p_user_id, 'bursitis', 3, 'pathology'),
      (p_user_id, 'effusion', 3, 'pathology'),
      (p_user_id, 'edema', 3, 'pathology'),
      (p_user_id, 'osteophyte', 3, 'pathology'),
      (p_user_id, 'osteophytes', 3, 'pathology'),
      (p_user_id, 'osteoarthritis', 3, 'pathology'),
      (p_user_id, 'synovitis', 3, 'pathology'),
      
      -- MRI terms
      (p_user_id, 'hyperintense', 3, 'mri_terms'),
      (p_user_id, 'hypointense', 3, 'mri_terms'),
      (p_user_id, 'isointense', 3, 'mri_terms'),
      (p_user_id, 'heterogeneous', 3, 'mri_terms'),
      (p_user_id, 'homogeneous', 3, 'mri_terms'),
      (p_user_id, 'STIR', 4, 'mri_terms'),
      (p_user_id, 'FLAIR', 4, 'mri_terms'),
      
      -- Common abbreviations
      (p_user_id, 'ACL', 4, 'abbreviations'),
      (p_user_id, 'PCL', 4, 'abbreviations'),
      (p_user_id, 'MCL', 4, 'abbreviations'),
      (p_user_id, 'LCL', 4, 'abbreviations'),
      (p_user_id, 'SLAP', 4, 'abbreviations'),
      (p_user_id, 'TFCC', 4, 'abbreviations');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Simplify the get_user_medical_terms function
CREATE OR REPLACE FUNCTION get_user_medical_terms(p_user_id UUID)
RETURNS TABLE(
  term TEXT,
  weight INTEGER,
  category TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT mt.term, mt.weight, mt.category
  FROM medical_terms mt
  WHERE mt.user_id = p_user_id
  ORDER BY mt.category, mt.term;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;