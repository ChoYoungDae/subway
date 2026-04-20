-- ============================================================
-- stations: 플랫폼 구조 관련 boolean 컬럼 3개 추가
-- is_inside_restroom : 화장실이 개찰구 안(승강장 구역)에 있는지 여부
-- is_island_platform  : 섬식 승강장(island platform) 여부
-- can_cross_over      : 반대편 승강장으로 건너갈 수 있는지 여부
-- ============================================================

ALTER TABLE stations
  ADD COLUMN IF NOT EXISTS is_inside_restroom BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_island_platform  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_cross_over       BOOLEAN NOT NULL DEFAULT FALSE;

-- ── is_inside_restroom = TRUE ─────────────────────────────
UPDATE stations SET is_inside_restroom = TRUE WHERE id IN (
  15, 22, 32, 40, 41, 42, 43, 46, 47, 48,
  55, 57, 59, 63, 67, 68, 69, 71, 72, 73,
  74, 75, 76, 77, 79, 80, 81, 83, 84, 87,
  89, 91, 96, 97, 98, 100, 104, 107, 109, 110,
  111, 116, 117, 118, 120, 133, 145, 151, 173, 198,
  204, 207, 227, 232, 234, 235, 244, 260, 303, 306,
  309, 312, 315, 319, 320, 321, 322, 326, 329, 331, 332
);

-- ── is_island_platform = TRUE ─────────────────────────────
UPDATE stations SET is_island_platform = TRUE WHERE id IN (
  1, 10, 11, 21, 29, 38, 39, 40, 44, 49,
  51, 53, 61, 62, 63, 65, 66, 68, 69, 70,
  71, 72, 73, 74, 75, 76, 82, 87, 91, 103,
  105, 107, 108, 110, 111, 112, 119, 120, 121, 128,
  138, 139, 140, 142, 143, 144, 145, 146, 147, 148,
  149, 154, 155, 159, 164, 177, 178, 179, 180, 181,
  182, 183, 190, 191, 192, 194, 195, 196, 197, 202,
  203, 204, 205, 209, 211, 214, 215, 216, 218, 219,
  220, 221, 222, 236, 249, 255, 257, 269, 277, 278,
  281, 283, 289, 290, 296, 301, 308, 309, 310, 311,
  312, 313, 314, 318, 319, 323, 327, 328, 329, 330, 336
);

-- ── can_cross_over: 대부분 TRUE → 전체 TRUE 후 FALSE만 재설정 ──
UPDATE stations SET can_cross_over = TRUE;
UPDATE stations SET can_cross_over = FALSE WHERE id IN (
  8, 12, 13, 14, 16, 17, 19, 20, 23, 26,
  27, 30, 31, 33, 35, 36, 37, 45, 50, 60,
  64, 78, 79, 89, 90, 94, 95, 99, 100, 101,
  102, 106, 113, 115, 123, 126, 127, 132, 153, 179,
  181, 215, 225, 233, 234, 238, 247, 248, 254, 263,
  280, 293, 319
);
