-- Room Rental Application Schema
-- Extensão para lidar com exclusão de períodos (prevenir overlap)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Tabela de Usuários
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Salas
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    hourly_rate DECIMAL(10, 2) NOT NULL, -- Valor por 1 hora
    shift_rate DECIMAL(10, 2) NOT NULL,  -- Valor por 4 horas (turno)
    capacity INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Reservas (Core Business)
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- Referência ao seu sistema de Auth
    
    -- O 'tsrange' armazena [início, fim). 
    -- Ex: [14:00, 15:00) para 1 hora ou [08:00, 12:00) para 4 horas.
    booking_period TSRANGE NOT NULL,
    
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, cancelled
    total_price DECIMAL(10, 2) NOT NULL,
    
    -- CONSTRAINT CRÍTICA: Impede que a mesma sala tenha reservas sobrepostas
    EXCLUDE USING GIST (room_id WITH =, booking_period WITH &&),
    
    payment_reminder_sent BOOLEAN DEFAULT FALSE,
    cancellation_notice_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Pagamentos (Referenciando o Gateway externo como Stripe)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
    gateway_transaction_id VARCHAR(255) UNIQUE, -- ID que vem do Stripe/Adyen
    payment_status VARCHAR(50), -- succeeded, processing, failed
    amount_paid DECIMAL(10, 2),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
