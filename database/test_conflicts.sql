-- Teste de Validação de Conflito de Horário (Overbooking)

-- 1. Inserir uma reserva de 1 hora (das 14:00 às 15:00) para a Sala Alpha
-- O UUID precisará ser capturado da tabela 'rooms' em um ambiente real, 
-- aqui usaremos uma subquery para facilitar o teste.
INSERT INTO reservations (room_id, user_id, booking_period, total_price)
VALUES (
    (SELECT id FROM rooms WHERE name = 'Sala Alpha (Executiva)' LIMIT 1),
    '550e8400-e29b-41d4-a716-446655440000', -- UUID fictício de usuário
    '[2026-03-02 14:00:00, 2026-03-02 15:00:00)',
    150.00
);

-- 2. TENTATIVA DE CONFLITO: Tentar reservar a MESMA sala, mas por um TURNO de 4h
-- que engloba o horário acima (ex: das 13:00 às 17:00).
-- ESTA QUERY DEVE FALHAR por causa da constraint EXCLUDE GIST.
INSERT INTO reservations (room_id, user_id, booking_period, total_price)
VALUES (
    (SELECT id FROM rooms WHERE name = 'Sala Alpha (Executiva)' LIMIT 1),
    '550e8400-e29b-41d4-a716-446655440001', 
    '[2026-03-02 13:00:00, 2026-03-02 17:00:00)',
    500.00
);

-- 3. TENTATIVA DE RESERVA ADJACENTE: Deve funcionar (das 15:00 às 16:00)
-- O PostgreSQL entende que [14:00, 15:00) e [15:00, 16:00) NÃO se sobrepõem.
INSERT INTO reservations (room_id, user_id, booking_period, total_price)
VALUES (
    (SELECT id FROM rooms WHERE name = 'Sala Alpha (Executiva)' LIMIT 1),
    '550e8400-e29b-41d4-a716-446655440002', 
    '[2026-03-02 15:00:00, 2026-03-02 16:00:00)',
    150.00
);
