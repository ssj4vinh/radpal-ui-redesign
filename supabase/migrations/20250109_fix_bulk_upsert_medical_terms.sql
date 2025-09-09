-- Fix the bulk_upsert_medical_terms function to properly handle JSONB operations
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
      SELECT 
        (term_obj->>'term')::text, 
        (term_obj->>'category')::text
      FROM jsonb_array_elements(p_terms) AS term_obj
    );
  
  -- Upsert all terms
  FOR v_term IN SELECT * FROM jsonb_array_elements(p_terms)
  LOOP
    INSERT INTO medical_terms (user_id, term, weight, category)
    VALUES (
      p_user_id,
      (v_term->>'term')::text,
      (v_term->>'weight')::INTEGER,
      (v_term->>'category')::text
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

-- Also ensure the upsert_medical_term function exists and works correctly
CREATE OR REPLACE FUNCTION upsert_medical_term(
  p_user_id UUID,
  p_term TEXT,
  p_weight INTEGER,
  p_category TEXT
)
RETURNS medical_terms AS $$
DECLARE
  v_result medical_terms;
BEGIN
  -- Only proceed if the user is authenticated and matches the requested user
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: User can only manage their own medical terms';
  END IF;

  INSERT INTO medical_terms (user_id, term, weight, category)
  VALUES (p_user_id, p_term, p_weight, p_category)
  ON CONFLICT (user_id, term, category)
  DO UPDATE SET 
    weight = EXCLUDED.weight,
    updated_at = timezone('utc'::text, now())
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;