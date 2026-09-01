-- PROVISIONAL seed values. The brief requires pricing to be configurable
-- but specifies no actual numbers (M4 in TODO.md). These are development
-- placeholders only — replace before production launch, do not treat as
-- a business decision made on the client's behalf.

insert into tool_pricing (tool, cost_credits) values
  ('image_compressor', 1),
  ('passport_photo', 2),
  ('hindi_converter', 1);

insert into pricing_plans (label, price_inr, credits, active) values
  ('PROVISIONAL — ₹49 / 50 credits', 49.00, 50, true),
  ('PROVISIONAL — ₹99 / 120 credits', 99.00, 120, true),
  ('PROVISIONAL — ₹199 / 300 credits', 199.00, 300, true);
