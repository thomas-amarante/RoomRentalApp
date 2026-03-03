-- Inserindo salas de exemplo para o RoomRentalApp

-- Sala de Reunião Clássica
INSERT INTO rooms (name, description, hourly_rate, shift_rate, capacity)
VALUES (
    'Sala Alpha (Executiva)', 
    'Ideal para reuniões de diretoria, com TV 4K e isolamento acústico premium.', 
    150.00, 
    500.00, -- Desconto para turno de 4h (125/h)
    10
);

-- Sala de Workshop/Estúdio
INSERT INTO rooms (name, description, hourly_rate, shift_rate, capacity)
VALUES (
    'Espaço Criativo Beta', 
    'Ambiente descontraído com quadros brancos, projetor e café incluso.', 
    80.00, 
    280.00, -- Desconto para turno de 4h (70/h)
    20
);

-- Sala Individual (Foco)
INSERT INTO rooms (name, description, hourly_rate, shift_rate, capacity)
VALUES (
    'Cabine de Foco Gamma', 
    'Perfeita para chamadas de vídeo ou trabalho individual concentrado.', 
    35.00, 
    120.00, -- Desconto para turno de 4h (30/h)
    1
);

-- Exemplo de consulta para verificar salas criadas:
-- SELECT * FROM rooms;
