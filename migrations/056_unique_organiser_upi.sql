CREATE UNIQUE INDEX organiser_upi_active_unique
ON tpa.payment_details(organiser,lower(active_snapshot->>'upiId'))
WHERE organiser IS NOT NULL AND status='active';
