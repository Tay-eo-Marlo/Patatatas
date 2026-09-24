INSERT INTO `rootcrops` (`crop_name`, `crop_description`) VALUES
('Sweet Potato', 'Sweet potato (Ipomoea batatas)'),
('Cassava',      'Cassava (Manihot esculenta)'),
('Taro',         'Taro (Colocasia esculenta)'),
('Yam',          'Yam (Dioscorea alata)');

-- Every crop also needs at least one unit, or "Add Stock Entry" will show
-- "No units defined for this crop". Adjust the units to what BSU-NPRCRTC really uses.
INSERT INTO `rootcrop_units` (`crop_id`, `unit_size`, `unit_abbreviated`, `unit_unabbreviated`)
SELECT crop_id, 'Cutting', 'Pc', 'Rooted Cuttings' FROM `rootcrops` WHERE crop_name = 'Sweet Potato'
UNION ALL
SELECT crop_id, 'Stem',    'Pc', 'Stem Cuttings'   FROM `rootcrops` WHERE crop_name = 'Cassava'
UNION ALL
SELECT crop_id, 'Setts',   'Pc', 'Taro Setts'      FROM `rootcrops` WHERE crop_name = 'Taro'
UNION ALL
SELECT crop_id, 'Tuber',   'Pc', 'Yam Tuber Pieces' FROM `rootcrops` WHERE crop_name = 'Yam';