-- Fix the init_default_medical_terms function to work with RLS
CREATE OR REPLACE FUNCTION init_default_medical_terms(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Only proceed if the user is authenticated and matches the requested user
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: User can only initialize their own medical terms';
  END IF;

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

-- Fix the get_user_medical_terms function to work with RLS
CREATE OR REPLACE FUNCTION get_user_medical_terms(p_user_id UUID)
RETURNS TABLE(
  term TEXT,
  weight INTEGER,
  category TEXT
) AS $$
BEGIN
  -- Only return data if the user is authenticated and matches the requested user
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN; -- Return empty result set
  END IF;
  
  RETURN QUERY
  SELECT mt.term, mt.weight, mt.category
  FROM medical_terms mt
  WHERE mt.user_id = p_user_id
  ORDER BY mt.category, mt.term;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix bulk_upsert_medical_terms to work with RLS
CREATE OR REPLACE FUNCTION bulk_upsert_medical_terms(
  p_user_id UUID,
  p_terms JSONB
)
RETURNS SETOF medical_terms AS $$
DECLARE
  v_term JSONB;
  v_result medical_terms;
BEGIN
  -- Only proceed if the user is authenticated and matches the requested user
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: User can only manage their own medical terms';
  END IF;

  -- Delete terms not in the new list
  DELETE FROM medical_terms 
  WHERE user_id = p_user_id 
    AND (term, category) NOT IN (
      SELECT term->>'term', term->>'category'
      FROM jsonb_array_elements(p_terms) AS term
    );
  
  -- Upsert all terms
  FOR v_term IN SELECT * FROM jsonb_array_elements(p_terms)
  LOOP
    INSERT INTO medical_terms (user_id, term, weight, category)
    VALUES (
      p_user_id,
      v_term->>'term',
      (v_term->>'weight')::INTEGER,
      v_term->>'category'
    )
    ON CONFLICT (user_id, term, category)
    DO UPDATE SET 
      weight = EXCLUDED.weight,
      updated_at = timezone('utc'::text, now())
    RETURNING * INTO v_result;
    
    RETURN NEXT v_result;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;