-- ============================================================
-- variety_generations_seed.sql
-- ------------------------------------------------------------
-- ADDITIVE seed data only. Does NOT alter the schema in any way —
-- `rootcrops.sql` is imported first and completely unmodified;
-- this file just fills the previously-empty `variety_generations`
-- table so the app has real generation-lineage data to render.
--
-- Run order:
--   1. mysql -u root rootcrops < rootcrops.sql
--   2. mysql -u root rootcrops < variety_generations_seed.sql
--
-- Column reference (unchanged from rootcrops.sql):
--   variety_id                  int  -> FK varieties.variety_id
--   variety_generation_id       int  -> PK, AUTO_INCREMENT
--   generation_classification   int  -> 0 = G0 (foundation/breeder stock,
--                                        no parent), 1 = G1 (first daughter
--                                        generation), 2 = G2 (second daughter
--                                        generation). Mirrors the G0/G1/G2
--                                        seed-hierarchy badges already used
--                                        across the frontend.
--   generation_desc              varchar(256)
-- ============================================================

INSERT INTO `variety_generations`
  (`variety_id`, `generation_classification`, `generation_desc`)
VALUES
  -- Granola (variety_id 2) — the variety that already has a live stock row
  (2, 0, 'G0 - Foundation/breeder stock: tissue-cultured, disease-indexed source material maintained by BSU-NPRCRTC'),
  (2, 1, 'G1 - First field-multiplied generation, propagated from G0 minitubers'),
  (2, 2, 'G2 - Second field-multiplied generation, distributed to accredited producers for further multiplication'),

  -- Igorota (variety_id 3)
  (3, 0, 'G0 - Foundation/breeder stock maintained by the BSU-NPRCRTC tissue culture laboratory'),
  (3, 1, 'G1 - First-generation daughter tubers propagated from G0 minitubers');
