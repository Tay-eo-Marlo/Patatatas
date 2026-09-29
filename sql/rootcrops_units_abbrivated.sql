UPDATE `rootcrop_units`
SET `unit_abbreviated` = CASE `unit_id`
    WHEN 1 THEN 'Tuber'      -- Mini Tubers - Pea Size
    WHEN 2 THEN 'Tuber'      -- Mini Tubers - Marble Size
    WHEN 3 THEN 'Tuber'      -- Mini Tubers - Small Size
    WHEN 4 THEN 'Plantlet'   -- Tissue Culture Plantlet
    WHEN 5 THEN 'Cutting'    -- Rooted Cuttings
END
WHERE `unit_id` IN (1, 2, 3, 4, 5);

-- Check the result
SELECT `unit_id`, `unit_size`, `unit_abbreviated`, `unit_unabbreviated`
FROM `rootcrop_units`
WHERE `crop_id` = 1
ORDER BY `unit_id`;