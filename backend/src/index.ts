
import express, { Request, Response } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, requireAdmin, AuthRequest } from './middleware/auth';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Configuração de Upload de Fotos
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
// Se o node rodar via dist/, precisamos garantir que o static aponte para a pasta certa
if (fs.existsSync(path.join(__dirname, '../../uploads'))) {
  app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));
}
app.use('/uploads', express.static('uploads'));

// Testar conexão com o banco ao iniciar
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ ERRO AO CONECTAR NO POSTGRES:', err.stack);
  } else {
    console.log('✅ CONECTADO AO BANCO DE DADOS POSTGRES COM SUCESSO');
    release();
  }
});

// Configuração Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || ''
});

// ─── WHATSAPP UTILITY ──────────────────────────────────────────────────────
const sendWhatsApp = async (number: string, text: string) => {
  try {
    const cleanPhone = number.replace(/\D/g, '');
    const fullNumber = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    
    const response = await fetch(`${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.EVOLUTION_API_KEY || ''
      },
      body: JSON.stringify({
        number: fullNumber,
        text: text
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro Evolution API (${response.status}):`, errorText);
    }
    return response.ok;
  } catch (error) {
    console.error('❌ Erro ao enviar WhatsApp:', error);
    return false;
  }
};

const notifyReservationChange = async (reservationId: string, type: 'new' | 'cancelled' | 'rescheduled', oldPeriod?: string) => {
  try {
    const query = `
      SELECT r.id, r.booking_period, r.status, r.total_price,
             ro.name as room_name,
             u.name as user_name, u.phone as user_phone
      FROM reservations r
      JOIN rooms ro ON r.room_id = ro.id
      JOIN users u ON r.user_id = u.id
      WHERE r.id = $1
    `;
    const result = await pool.query(query, [reservationId]);
    if (result.rows.length === 0) return;

    const res = result.rows[0];
    const admins = await pool.query("SELECT phone FROM users WHERE is_admin = true AND phone IS NOT NULL AND phone != ''");
    const adminPhones = Array.from(new Set(admins.rows.map(a => a.phone)));

    // Formatação de data/hora amigável
    const getFriendlyPeriod = (periodStr: string) => {
      // periodStr no formato "[2026-03-14 10:00:00, 2026-03-14 11:00:00)"
      const parts = periodStr.replace(/[\[\)\"]/g, '').split(',');
      
      // Adicionamos o offset para garantir que o JS interprete como horário de Brasília
      const startStr = parts[0].trim().includes(' ') ? parts[0].trim().replace(' ', 'T') + '-03:00' : parts[0].trim();
      const endStr = parts[1].trim().includes(' ') ? parts[1].trim().replace(' ', 'T') + '-03:00' : parts[1].trim();

      const start = new Date(startStr);
      const end = new Date(endStr);
      
      const date = start.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const startTime = start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
      const endTime = end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
      
      return { date, startTime, endTime, full: `${date} às ${startTime} - ${endTime}` };
    };

    const period = getFriendlyPeriod(res.booking_period);
    let userMsg = '';
    let clinicMsg = '';

    if (type === 'new') {
      userMsg = `Olá *${res.user_name}*! Sua reserva na *${res.room_name}* para o dia ${period.date} das ${period.startTime} às ${period.endTime} foi confirmada com sucesso! 🎉`;
      clinicMsg = `📌 *Nova Reserva Confirmada!*\n\n👤 Usuário: ${res.user_name}\n🏢 Sala: ${res.room_name}\n📅 Data: ${period.date}\n⏰ Horário: ${period.startTime} - ${period.endTime}`;
    } else if (type === 'cancelled') {
      userMsg = `Olá *${res.user_name}*! Sua reserva na *${res.room_name}* para o dia ${period.date} das ${period.startTime} às ${period.endTime} foi *cancelada*. ❌`;
      clinicMsg = `❌ *Reserva Cancelada!*\n\n👤 Usuário: ${res.user_name}\n🏢 Sala: ${res.room_name}\n📅 Data: ${period.date}\n⏰ Horário: ${period.startTime} - ${period.endTime}`;
    } else if (type === 'rescheduled') {
      const old = oldPeriod ? getFriendlyPeriod(oldPeriod) : null;
      userMsg = `Olá *${res.user_name}*! Sua reserva na *${res.room_name}* foi *reagendada* com sucesso! ✅\n\n📅 Nova Data: ${period.date}\n⏰ Novo Horário: ${period.startTime} - ${period.endTime}`;
      clinicMsg = `🕒 *Reserva Reagendada!*\n\n👤 Usuário: ${res.user_name}\n🏢 Sala: ${res.room_name}\n\n⬅️ *Antigo:* ${old ? old.full : 'N/A'}\n➡️ *Novo:* ${period.full}`;
    }

    // Enviar para o usuário
    if (res.user_phone) {
      await sendWhatsApp(res.user_phone, userMsg);
    }

    // Enviar para os admins
    for (const phone of adminPhones) {
      await sendWhatsApp(phone, clinicMsg);
    }

  } catch (error) {
    console.error('❌ Erro ao notificar mudança de reserva:', error);
  }
};

// ROTA 1: Listar todas as salas (GET /api/rooms) - PÚBLICA
app.get('/api/rooms', async (req: Request, res: Response) => {
  try {
    const query = `
      WITH RECURSIVE days AS (
        SELECT (NOW() AT TIME ZONE 'America/Sao_Paulo')::date AS d
        UNION ALL
        SELECT d + 1 FROM days WHERE d < (NOW() AT TIME ZONE 'America/Sao_Paulo')::date + 15
      ),
      all_possible_blocks AS (
        -- Standard 1h slots for normal rooms
        SELECT 
          r.id AS room_id,
          (d.d + (h.h || ' hours')::interval) AS start_time,
          (d.d + ((h.h + 1) || ' hours')::interval) AS end_time
        FROM days d
        CROSS JOIN generate_series(7, 22) h(h)
        CROSS JOIN rooms r
        WHERE r.locked_by_default = false

        UNION ALL

        -- Released slots by Admin
        SELECT 
          rs.room_id,
          (rs.date + rs.start_time) AS start_time,
          (rs.date + rs.end_time) AS end_time
        FROM released_slots rs

        UNION ALL

        -- Business Rule: Consultório 3 Fixed Schedule
        SELECT 
          r.id AS room_id,
          (d.d + (h.h || ':' || lpad(m.m::text, 2, '0') || ':00')::time)::timestamp AS start_time,
          (d.d + (h.h || ':' || lpad(m.m::text, 2, '0') || ':00')::time + interval '1 hour')::timestamp AS end_time
        FROM days d
        CROSS JOIN generate_series(7, 22) h(h)
        CROSS JOIN (VALUES (0), (30)) m(m)
        CROSS JOIN rooms r
        WHERE r.id = '0b5d4bf5-b66b-43bf-9575-0ca9925251f4'
        AND (
          (EXTRACT(ISODOW FROM d.d) = 1 AND (h.h * 60 + m.m) <= (12 * 60 + 30)) -- Mon until 13:30
          OR 
          (EXTRACT(ISODOW FROM d.d) IN (3, 5) AND (h.h * 60 + m.m) >= (13 * 60 + 30) AND (h.h * 60 + m.m) <= (22 * 60)) -- Wed/Fri from 13:30
        )
      ),
      available_blocks AS (
        SELECT p.room_id, p.start_time
        FROM all_possible_blocks p
        LEFT JOIN reservations res 
          ON res.room_id = p.room_id 
          AND res.status != 'cancelled'
          AND tsrange(p.start_time, p.end_time) && res.booking_period
        -- Only consider slots that are in the future
        WHERE res.id IS NULL AND p.start_time >= (NOW() AT TIME ZONE 'America/Sao_Paulo')
      ),
      first_available AS (
        SELECT room_id, MIN(start_time) as next_availability
        FROM available_blocks
        GROUP BY room_id
      )
      
      SELECT
        r.*,
        fa.next_availability
      FROM rooms r
      LEFT JOIN first_available fa ON r.id = fa.room_id
      ORDER BY 
        CASE WHEN r.name ILIKE '%Consultório 3%' THEN 0 ELSE 1 END,
        r.name
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar salas.' });
  }
});

// ROTA: Upload de Fotos (Admin)
app.post('/api/admin/upload', authenticateToken, requireAdmin, upload.single('photo'), (req: AuthRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }
  const fileUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});
// ROTA 1.5: Obter horários disponíveis dinâmicos - PÚBLICA
app.get('/api/availability', async (req: Request, res: Response) => {
  const { roomId, date } = req.query;
  
  if (!roomId || !date) {
    return res.status(400).json({ error: 'Faltam parâmetros roomId ou date' });
  }

  try {
    const roomCheck = await pool.query('SELECT locked_by_default FROM rooms WHERE id = $1', [roomId]);
    if (roomCheck.rows.length === 0) return res.status(404).json({ error: 'Sala não encontrada' });
    
    const isLocked = roomCheck.rows[0].locked_by_default;

    if (isLocked) {
      // Retorna slots de 1h que estejam INTEIRAMENTE dentro de um bloco liberado e não reservado
      const query = `
        WITH released AS (
          -- Unificando com a mesma lógica de janelas do GET /api/rooms para evitar discrepâncias
          SELECT start_time, end_time, date 
          FROM released_slots 
          WHERE room_id = $1 AND date = $2
          
          UNION ALL
          
          -- Monday: 07:00 to 13:30 (last slot starts at 12:30)
          SELECT (h.h || ':' || lpad(m.m::text, 2, '0') || ':00')::time, (h.h || ':' || lpad(m.m::text, 2, '0') || ':00')::time + interval '1 hour', $2::date
          FROM generate_series(7, 12) h(h)
          CROSS JOIN (VALUES (0), (30)) m(m)
          WHERE $1 = '0b5d4bf5-b66b-43bf-9575-0ca9925251f4'
          AND EXTRACT(ISODOW FROM $2::date) = 1
          AND (h.h * 60 + m.m) <= (12 * 60 + 30)
          
          UNION ALL
          
          -- Wed/Fri: 13:30 to 23:00 (last slot starts at 22:00)
          SELECT (h.h || ':' || lpad(m.m::text, 2, '0') || ':00')::time, (h.h || ':' || lpad(m.m::text, 2, '0') || ':00')::time + interval '1 hour', $2::date
          FROM generate_series(13, 22) h(h)
          CROSS JOIN (VALUES (0), (30)) m(m)
          WHERE $1 = '0b5d4bf5-b66b-43bf-9575-0ca9925251f4'
          AND EXTRACT(ISODOW FROM $2::date) IN (3, 5)
          AND (h.h * 60 + m.m) >= (13 * 60 + 30)
          AND (h.h * 60 + m.m) <= (22 * 60)
        ),
        possible_slots AS (
          SELECT
            ($2 || ' ' || lpad(h::text, 2, '0') || ':' || lpad(m::text, 2, '0') || ':00')::timestamp AS slot_start,
            ($2 || ' ' || lpad(h::text, 2, '0') || ':' || lpad(m::text, 2, '0') || ':00')::timestamp + interval '1 hour' AS slot_end
          FROM generate_series(7, 22) as h
          CROSS JOIN (VALUES (0), (30)) as t(m)
          WHERE NOT (h = 22 AND m = 30)
        )
        SELECT 
          ps.slot_start::time as start_time,
          ps.slot_end::time as end_time
        FROM possible_slots ps
        INNER JOIN released r ON ps.slot_start::time >= r.start_time AND ps.slot_end::time <= r.end_time
        LEFT JOIN reservations res 
          ON res.room_id = $1 
          AND res.status != 'cancelled'
          AND tsrange(ps.slot_start, ps.slot_end) && res.booking_period
        WHERE res.id IS NULL
        ORDER BY ps.slot_start ASC
      `;
      const result = await pool.query(query, [roomId, date]);
      const availableTimes = result.rows.map(row => ({
        start: row.start_time.substring(0, 5),
        end: row.end_time.substring(0, 5)
      }));
      return res.json(availableTimes);
    } else {
      // Sala Padrão: Rotina de horários comerciais estendida das 07h as 22h, incrementos de 30min
      const query = `
        WITH hourly_slots AS (
          SELECT
            ($2 || ' ' || lpad(h::text, 2, '0') || ':' || lpad(m::text, 2, '0') || ':00')::timestamp AS slot_start,
            ($2 || ' ' || lpad(h::text, 2, '0') || ':' || lpad(m::text, 2, '0') || ':00')::timestamp + interval '1 hour' AS slot_end
          FROM generate_series(7, 22) as h
          CROSS JOIN (VALUES (0), (30)) as t(m)
          WHERE NOT (h = 22 AND m = 30)
        )
        SELECT 
          hs.slot_start::time as start_time,
          hs.slot_end::time as end_time
        FROM hourly_slots hs
        LEFT JOIN reservations res 
          ON res.room_id = $1
          AND res.status != 'cancelled'
          AND tsrange(hs.slot_start, hs.slot_end) && res.booking_period
        WHERE res.id IS NULL
        ORDER BY hs.slot_start ASC
      `;
      const result = await pool.query(query, [roomId, date]);
      const availableTimes = result.rows.map(row => ({
        start: row.start_time.substring(0, 5),
        end: row.end_time.substring(0, 5)
      }));
      return res.json(availableTimes);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao verificar disponibilidade' });
  }
});

// ROTA 2: Criar uma Reserva - PROTEGIDA
app.post('/api/reservations', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { room_id, user_id, start_time, end_time, total_price } = req.body;

  // Garantir que o usuário só pode criar reservas para ele mesmo (ou pular se ele for admin testando)
  if (req.user?.id !== user_id && !req.user?.is_admin) {
    return res.status(403).json({ error: 'Operação não permitida.' });
  }

  // O start_time vem no formato "YYYY-MM-DD HH:mm:00" do frontend.
  // Vamos garantir que ele seja lido e comparado usando o fuso de São Paulo (-03:00) para evitar problemas de offset do JS
  let safeStartTime = start_time;
  if (start_time.includes(' ')) {
    safeStartTime = start_time.replace(' ', 'T') + '-03:00';
  } else if (!start_time.includes('T')) {
    safeStartTime = start_time + 'T00:00:00-03:00';
  } else if (!start_time.includes('-03:00') && !start_time.endsWith('Z')) {
    safeStartTime = start_time + '-03:00';
  }

  const requestDate = new Date(safeStartTime);
  const now = new Date();

  // Agora podemos comparar com precisão. Retiramos a tolerância errônea de 24h.
  if (requestDate.getTime() < now.getTime()) { 
    return res.status(400).json({ error: 'Não é possível agendar em horários passados.' });
  }

  try {
    // SECURITY CHECK: Se a sala for bloqueada por padrão
    const roomCheck = await pool.query('SELECT locked_by_default FROM rooms WHERE id = $1', [room_id]);
    if (roomCheck.rows.length > 0 && roomCheck.rows[0].locked_by_default) {
      const lockDate = start_time.split(' ')[0];
      const lockStartTime = start_time.split(' ')[1]; // e.g. "20:00:00"
      const lockEndTime = end_time.split(' ')[1];
      
      // 1. Check se há um slot explicitamente liberado pelo Admin
      const releaseCheck = await pool.query(
        `SELECT id FROM released_slots 
         WHERE room_id = $1 AND date = $2 
         AND start_time <= $3::time AND end_time >= $4::time`,
        [room_id, lockDate, lockStartTime, lockEndTime]
      );
      
      let isAllowed = releaseCheck.rows.length > 0;
      
      // 2. Check da agenda fixa do Consultório 3 (regra de negócio hardcoded)
      if (!isAllowed && room_id === '0b5d4bf5-b66b-43bf-9575-0ca9925251f4') {
        const dayOfWeekResult = await pool.query(
          'SELECT EXTRACT(ISODOW FROM $1::date) as dow',
          [lockDate]
        );
        const dow = parseInt(dayOfWeekResult.rows[0].dow);
        const [startH, startM] = lockStartTime.split(':').map(Number);
        const [endH, endM] = lockEndTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        
        // Segunda (1): 07:00 às 13:30
        if (dow === 1 && startMinutes >= 7 * 60 && endMinutes <= 13 * 60 + 30) {
          isAllowed = true;
        }
        // Quarta (3) ou Sexta (5): 13:30 às 23:00
        if ((dow === 3 || dow === 5) && startMinutes >= 13 * 60 + 30 && endMinutes <= 23 * 60) {
          isAllowed = true;
        }
      }
      
      if (!isAllowed) {
        return res.status(403).json({ error: 'Este horário está bloqueado e não foi liberado pelo Administrador.' });
      }
    }

    // ─── Hierarquia de Salas ────────────────────────────────────────────────
    // Carina → pode reservar qualquer sala
    // Consul.1 → pode reservar Consul.1 e Consul.2
    // Consul.2 → só pode reservar Consul.2
    const CARINA_ID  = '0b5d4bf5-b66b-43bf-9575-0ca9925251f4';
    const CONSUL1_ID = 'c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96';
    const CONSUL2_ID = 'd93d2b37-3720-4298-b70b-aaf8a94acee0';

    // Salas cujos tickets podem ser usados para reservar o target room_id
    const eligibleSourceRooms: Record<string, string[]> = {
      [CARINA_ID]:  [CARINA_ID],
      [CONSUL1_ID]: [CONSUL1_ID, CARINA_ID],
      [CONSUL2_ID]: [CONSUL2_ID, CONSUL1_ID, CARINA_ID],
    };
    const eligible = eligibleSourceRooms[room_id] || [room_id];

    // DEDUÇÃO DE TICKETS (com hierarquia)
    const reqStartObj = new Date(safeStartTime);
    const reqSafeEndTime = end_time.includes(' ') ? end_time.replace(' ', 'T') + '-03:00' : (!end_time.includes('-03:00') && !end_time.endsWith('Z') ? end_time + '-03:00' : end_time);
    const reqEndObj = new Date(reqSafeEndTime);
    const diffHours = (reqEndObj.getTime() - reqStartObj.getTime()) / (1000 * 60 * 60);
    const isShift = diffHours >= 4;

    // Buscar tickets de todas as salas elegíveis, priorizando a própria sala
    const ticketCheck = await pool.query(
      `SELECT room_id, hourly_tickets, shift_tickets 
       FROM user_tickets 
       WHERE user_id = $1 AND room_id = ANY($2::uuid[])
       ORDER BY (room_id = $3::uuid) DESC`, /* própria sala primeiro */
      [user_id, eligible, room_id]
    );

    let sourceRoomId: string | null = null;
    let hasShiftTicket = false;
    let hasHourlyTickets = false;
    let finalStatus = 'pending';
    let finalPrice = total_price;

    for (const row of ticketCheck.rows) {
      if (isShift && row.shift_tickets > 0) {
        hasShiftTicket = true;
        sourceRoomId = row.room_id;
        break;
      } else if (!isShift && row.hourly_tickets >= diffHours) {
        hasHourlyTickets = true;
        sourceRoomId = row.room_id;
        break;
      }
    }

    if (hasShiftTicket && sourceRoomId) {
      finalStatus = 'confirmed';
      finalPrice = 0;
      await pool.query(`UPDATE user_tickets SET shift_tickets = shift_tickets - 1 WHERE user_id = $1 AND room_id = $2`, [user_id, sourceRoomId]);
      console.log(`🎫 Turno deduzido do pacote de ${sourceRoomId} para reserva em ${room_id}`);
    } else if (hasHourlyTickets && sourceRoomId) {
      finalStatus = 'confirmed';
      finalPrice = 0;
      await pool.query(`UPDATE user_tickets SET hourly_tickets = hourly_tickets - $3 WHERE user_id = $1 AND room_id = $2`, [user_id, sourceRoomId, diffHours]);
      console.log(`🎫 ${diffHours}h deduzidas do pacote de ${sourceRoomId} para reserva em ${room_id}`);
    }


    const query = `
      INSERT INTO reservations (room_id, user_id, booking_period, total_price, status)
      VALUES ($1, $2, tsrange($3, $4), $5, $6)
      RETURNING *;
    `;
    const values = [room_id, user_id, start_time, end_time, finalPrice, finalStatus];

    const result = await pool.query(query, values);

    if (finalStatus === 'confirmed') {
      // Notificar imediatamente se foi confirmado via tickets
      notifyReservationChange(result.rows[0].id, 'new');
    }

    res.status(201).json({
      message: finalStatus === 'confirmed' ? 'Reserva confirmada via Saldo de Ingressos!' : 'Reserva criada! Aguardando pagamento.',
      reservation: result.rows[0],
      paidWithTickets: finalStatus === 'confirmed'
    });
  } catch (err: any) {
    if (err.code === '23P01') { // Código para check_violation
      return res.status(400).json({ error: 'Este horário está em conflito ou no passado.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Erro ao processar reserva' });
  }
});

// ROTA: Reagendamento de Reserva
app.put('/api/reservations/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { start_time, end_time } = req.body;

    if (!userId || !start_time || !end_time) {
      return res.status(400).json({ error: 'Dados incompletos.' });
    }

    const existing = await pool.query(`SELECT * FROM reservations WHERE id = $1`, [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Reserva não encontrada.' });

    const reservation = existing.rows[0];
    if (reservation.user_id !== userId && !req.user?.is_admin) {
      return res.status(403).json({ error: 'Sem permissão para alterar esta reserva.' });
    }
    if (reservation.status !== 'confirmed') {
      return res.status(400).json({ error: 'Apenas reservas confirmadas podem ser reagendadas.' });
    }

    const safeStart = start_time.includes(' ') ? start_time.replace(' ', 'T') + '-03:00' : start_time;
    const safeEnd = end_time.includes(' ') ? end_time.replace(' ', 'T') + '-03:00' : end_time;

    const conflict = await pool.query(
      `SELECT id FROM reservations 
       WHERE room_id = $1 AND id != $2 AND status = 'confirmed'
       AND booking_period && tsrange($3::timestamp, $4::timestamp)`,
      [reservation.room_id, id, safeStart, safeEnd]
    );
    if (conflict.rows.length > 0) {
      return res.status(400).json({ error: 'Este horário já está reservado por outro usuário.' });
    }

    const updated = await pool.query(
      `UPDATE reservations SET booking_period = tsrange($1::timestamp, $2::timestamp) WHERE id = $3 RETURNING *`,
      [safeStart, safeEnd, id]
    );

    // Notificar Reagendamento
    notifyReservationChange(id as string, 'rescheduled', reservation.booking_period);

    res.json({ message: 'Reserva reagendada com sucesso!', reservation: updated.rows[0] });
  } catch (err: any) {
    console.error('Erro ao reagendar:', err);
    res.status(500).json({ error: 'Erro ao reagendar reserva.' });
  }
});

// ROTA 2.0: Consulta pública de reserva por ID (para QR Code) - PÚBLICA
app.get('/api/lookup/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const query = `
      SELECT r.id, r.booking_period, r.status, r.total_price,
             ro.name as room_name,
             u.name as user_name
      FROM reservations r
      JOIN rooms ro ON r.room_id = ro.id
      JOIN users u ON r.user_id = u.id
      WHERE r.id = $1
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar reserva.' });
  }
});

// ROTA 2.1: Obter reservas do usuário - PROTEGIDA
app.get('/api/reservations/:userId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;

  if (req.user?.id !== userId && !req.user?.is_admin) {
    return res.status(403).json({ error: 'Acesso negado às reservas de outro usuário.' });
  }

  try {
    const query = `
      SELECT r.*, ro.name as room_name, ro.description as room_description
      FROM reservations r
      JOIN rooms ro ON r.room_id = ro.id
      WHERE r.user_id = $1
      ORDER BY lower(r.booking_period) ASC
    `;
    const result = await pool.query(query, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar reservas.' });
  }
});

// ROTA 2.2: Obter todas as reservas (Admin) - PROTEGIDA (ADMINS SOMENTE)
app.get('/api/admin/reservations', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const query = `
      SELECT r.*, ro.name as room_name, u.name as user_name, u.email as user_email
      FROM reservations r
      JOIN rooms ro ON r.room_id = ro.id
      JOIN users u ON r.user_id = u.id
      ORDER BY lower(r.booking_period) ASC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar todas as reservas.' });
  }
});

// ROTA 2.2.1: Obter estatísticas de usuários (Admin) - PROTEGIDA (ADMINS SOMENTE)
app.get('/api/admin/stats/users', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { month, year } = req.query;
    
    let dateFilter = '';
    const params: any[] = [];
    
    if (month && year) {
      dateFilter = ` AND EXTRACT(MONTH FROM lower(r.booking_period)) = $1 AND EXTRACT(YEAR FROM lower(r.booking_period)) = $2`;
      params.push(parseInt(month as string), parseInt(year as string));
    } else if (year) {
      dateFilter = ` AND EXTRACT(YEAR FROM lower(r.booking_period)) = $1`;
      params.push(parseInt(year as string));
    }

    const query = `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        COUNT(r.id) as total_reservations,
        COALESCE(SUM(CASE WHEN r.status = 'confirmed' THEN r.total_price ELSE 0 END), 0) as total_revenue
      FROM users u
      LEFT JOIN reservations r ON u.id = r.user_id ${dateFilter}
      GROUP BY u.id, u.name, u.email
      ORDER BY total_revenue DESC
    `;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar estatísticas de usuários.' });
  }
});

// ROTA 2.3: Cancelar reserva (Admin) - PROTEGIDA (ADMINS SOMENTE)
app.patch('/api/admin/reservations/:id/cancel', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE reservations SET status = $1 WHERE id = $2', ['cancelled', id]);
    
    // Notificar Cancelamento por Admin
    notifyReservationChange(id as string, 'cancelled');

    res.json({ message: 'Reserva cancelada com sucesso.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao cancelar reserva.' });
  }
});

// ROTA 2.4: Criar reserva manual ignorando saldos (Admin) - PROTEGIDA (ADMINS SOMENTE)
app.post('/api/admin/reservations/manual', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { room_id, user_id, start_time, end_time } = req.body;

  if (!room_id || !user_id || !start_time || !end_time) {
    return res.status(400).json({ error: 'Faltam parâmetros obrigatórios.' });
  }

  let safeStartTime = start_time;
  if (start_time.includes(' ')) {
    safeStartTime = start_time.replace(' ', 'T') + '-03:00';
  } else if (!start_time.includes('T')) {
    safeStartTime = start_time + 'T00:00:00-03:00';
  } else if (!start_time.includes('-03:00') && !start_time.endsWith('Z')) {
    safeStartTime = start_time + '-03:00';
  }

  const requestDate = new Date(safeStartTime);
  const now = new Date();

  if (requestDate.getTime() < now.getTime()) { 
    return res.status(400).json({ error: 'Não é possível agendar em horários passados.' });
  }

  try {
     // Verifica colisão
     const confCheck = await pool.query(
        `SELECT id FROM reservations 
         WHERE room_id = $1 
         AND status = 'confirmed'
         AND tsrange($2, $3) && booking_period`, 
        [room_id, start_time, end_time]
     );
     
     if (confCheck.rows.length > 0) {
       return res.status(400).json({ error: 'Horário já ocupado por outra reserva confirmada.' });
     }

     const result = await pool.query(`
        INSERT INTO reservations (room_id, user_id, booking_period, total_price, status)
        VALUES ($1, $2, tsrange($3, $4), 0, 'confirmed')
        RETURNING *
     `, [room_id, user_id, start_time, end_time]);
     
     // Notificar Reserva Manual
     notifyReservationChange(result.rows[0].id, 'new');

     res.status(201).json(result.rows[0]);
  } catch (err: any) {
     console.error(err);
     if (err.code === '23P01') {
       return res.status(400).json({ error: 'Horário inválido ou no passado.' });
     }
     res.status(500).json({ error: 'Erro ao criar reserva manual.' });
  }
});

// ─── ADMIN DATA MANAGEMENT (DEBUG) ───────────────────────────────────────

// USUÁRIOS
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT id, name, email, phone, is_admin, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar usuários.' });
  }
});

// SALDOS DE USUÁRIOS
app.get('/api/admin/users-balances', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const query = `
      SELECT 
        u.id as user_id, 
        u.name as user_name, 
        u.email as user_email,
        r.name as room_name,
        ut.hourly_tickets,
        ut.shift_tickets
      FROM users u
      JOIN user_tickets ut ON u.id = ut.user_id
      JOIN rooms r ON ut.room_id = r.id
      WHERE ut.hourly_tickets > 0 OR ut.shift_tickets > 0
      ORDER BY u.name ASC, r.name ASC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar saldos dos usuários.' });
  }
});

app.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, email, is_admin, phone } = req.body;
  try {
    const result = await pool.query(
      'UPDATE users SET name = $1, email = $2, is_admin = $3, phone = $4 WHERE id = $5 RETURNING id, name, email, is_admin, phone',
      [name, email, is_admin, phone, id as string]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao editar usuário.' });
  }
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'Usuário excluído.', id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir usuário.' });
  }
});

// CRÉDITOS VIRTUAIS (ADMIN)
app.post('/api/admin/add-tickets', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { userId, roomId, hourlyTickets, shiftTickets } = req.body;
  if (!userId || !roomId) {
    return res.status(400).json({ error: 'Faltam parâmetros userId ou roomId.' });
  }

  const hours = parseInt(hourlyTickets) || 0;
  const shifts = parseInt(shiftTickets) || 0;

  try {
    const check = await pool.query('SELECT * FROM user_tickets WHERE user_id = $1 AND room_id = $2', [userId, roomId]);
    if (check.rows.length > 0) {
      await pool.query(
        'UPDATE user_tickets SET hourly_tickets = hourly_tickets + $1, shift_tickets = shift_tickets + $2 WHERE user_id = $3 AND room_id = $4',
        [hours, shifts, userId, roomId]
      );
    } else {
      await pool.query(
        'INSERT INTO user_tickets (user_id, room_id, hourly_tickets, shift_tickets) VALUES ($1, $2, $3, $4)',
        [userId, roomId, hours, shifts]
      );
    }
    res.json({ message: 'Saldos adicionados com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao adicionar saldos virtuais.' });
  }
});

// LIBERAÇÃO DE HORÁRIOS PARA SALAS BLOQUEADAS
app.get('/api/admin/released_slots', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { roomId } = req.query;
  try {
    let query = 'SELECT * FROM released_slots ORDER BY date DESC, start_time ASC';
    let params: any[] = [];
    if (roomId) {
      query = 'SELECT * FROM released_slots WHERE room_id = $1 ORDER BY date DESC, start_time ASC';
      params = [roomId];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar horários liberados.' });
  }
});

app.post('/api/admin/released_slots', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { room_id, date, start_time, end_time } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO released_slots (room_id, date, start_time, end_time) VALUES ($1, $2, $3, $4) RETURNING *',
      [room_id, date, start_time, end_time]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao liberar horário.' });
  }
});

app.delete('/api/admin/released_slots/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM released_slots WHERE id = $1', [id]);
    res.json({ message: 'Horário bloqueado novamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao remover liberação.' });
  }
});

// SALAS (CRUD COMPLETO)
app.post('/api/admin/rooms', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, description, hourly_rate, shift_rate, capacity, photo1, photo2, photo3 } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO rooms (name, description, hourly_rate, shift_rate, capacity, photo1, photo2, photo3) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [name, description, hourly_rate, shift_rate, capacity, photo1, photo2, photo3]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar sala.' });
  }
});

app.put('/api/admin/rooms/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, description, hourly_rate, shift_rate, capacity, photo1, photo2, photo3 } = req.body;
  try {
    const result = await pool.query(
      'UPDATE rooms SET name = $1, description = $2, hourly_rate = $3, shift_rate = $4, capacity = $5, photo1 = $6, photo2 = $7, photo3 = $8 WHERE id = $9 RETURNING *',
      [name, description, hourly_rate, shift_rate, capacity, photo1, photo2, photo3, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao editar sala.' });
  }
});

app.delete('/api/admin/rooms/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM rooms WHERE id = $1', [id]);
    res.json({ message: 'Sala excluída.', id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir sala.' });
  }
});

// RESERVAS (HARD CRUD)
app.delete('/api/admin/reservations/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM reservations WHERE id = $1', [id]);
    res.json({ message: 'Reserva excluída.', id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir reserva.' });
  }
});

app.put('/api/admin/reservations/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { room_id, user_id, booking_period, status, total_price } = req.body;
  try {
    const existing = await pool.query('SELECT status, booking_period FROM reservations WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Reserva não encontrada.' });
    
    const oldStatus = existing.rows[0].status;
    const oldPeriod = existing.rows[0].booking_period;

    const result = await pool.query(
      'UPDATE reservations SET room_id = $1, user_id = $2, booking_period = $3, status = $4, total_price = $5 WHERE id = $6 RETURNING *',
      [room_id as string, user_id as string, booking_period as string, status as string, total_price as string, id as string]
    );

    // Detecção de mudanças para notificação
    if (status === 'cancelled' && oldStatus !== 'cancelled') {
        notifyReservationChange(id as string, 'cancelled');
    } else if (status === 'confirmed' && oldStatus !== 'confirmed') {
        notifyReservationChange(id as string, 'new');
    } else if (booking_period !== oldPeriod && status === 'confirmed') {
        notifyReservationChange(id as string, 'rescheduled', oldPeriod);
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao editar reserva.' });
  }
});

// ─── AUTHENTICATION ──────────────────────────────────────────────────────
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { name, email, password, phone, cpf, cro, address } = req.body;
  try {
    const existingUserCheck = await pool.query("SELECT id, is_phone_verified FROM users WHERE email = $1", [email]);
    let user;

    if (existingUserCheck.rows.length > 0) {
      const existingUser = existingUserCheck.rows[0];
      if (existingUser.is_phone_verified) {
        return res.status(400).json({ error: 'E-mail já está em uso.' });
      }

      // Overwrite the unverified user
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);
      const updatedUser = await pool.query(
        "UPDATE users SET name = $1, password_hash = $2, phone = $3, cpf = $5, cro = $6, address = $7 WHERE email = $4 RETURNING id, name, email, phone, cpf, cro, address, is_phone_verified",
        [name, password_hash, phone, email, cpf, cro, address]
      );
      user = updatedUser.rows[0];

      // Exclui códigos velhos pendentes do usuário sobrescrito
      await pool.query("DELETE FROM verification_codes WHERE user_id = $1", [user.id]);
    } else {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);
      const newUser = await pool.query(
        "INSERT INTO users (name, email, password_hash, phone, cpf, cro, address, is_phone_verified) VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE) RETURNING id, name, email, phone, cpf, cro, address, is_phone_verified",
        [name, email, password_hash, phone, cpf, cro, address]
      );
      user = newUser.rows[0];
    }

    // Trigger initial verification code
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires_at = new Date(Date.now() + 15 * 60000); // 15 minutes

      await pool.query(
        "INSERT INTO verification_codes (user_id, code, expires_at) VALUES ($1, $2, $3)",
        [user.id, code, expires_at]
      );

      // Send via Evolution API
      const cleanPhone = phone.replace(/\D/g, '');
      const fullNumber = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

      await fetch(`${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.EVOLUTION_API_KEY || ''
        },
        body: JSON.stringify({
          number: fullNumber,
          text: `Olá! Seu código de verificação para a · L I V · Odontologia é: *${code}*`
        })
      });
    } catch (waError) {
      console.error('Erro ao enviar WhatsApp inicial:', waError);
    }

    res.json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ROTA: Reenviar Código de Verificação
app.post('/api/auth/send-verification', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  try {
    const userResult = await pool.query("SELECT id, name, phone FROM users WHERE id = $1", [userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });

    const user = userResult.rows[0];
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires_at = new Date(Date.now() + 15 * 60000);

    // Limpar códigos antigos
    await pool.query("DELETE FROM verification_codes WHERE user_id = $1", [userId]);

    await pool.query(
      "INSERT INTO verification_codes (user_id, code, expires_at) VALUES ($1, $2, $3)",
      [userId, code, expires_at]
    );

    const cleanPhone = user.phone.replace(/\D/g, '');
    const fullNumber = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    await fetch(`${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.EVOLUTION_API_KEY || ''
      },
      body: JSON.stringify({
        number: fullNumber,
        text: `Olá! Seu código de verificação para a · L I V · Odontologia é: *${code}*`
      })
    });

    res.json({ message: 'Código enviado com sucesso!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao enviar código' });
  }
});

// ROTA: Verificar Código
app.post('/api/auth/verify-phone', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { code } = req.body;

  try {
    const result = await pool.query(
      "SELECT * FROM verification_codes WHERE user_id = $1 AND code = $2 AND expires_at > NOW()",
      [userId, code]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Código inválido ou expirado' });
    }

    await pool.query("UPDATE users SET is_phone_verified = TRUE WHERE id = $1", [userId]);
    await pool.query("DELETE FROM verification_codes WHERE user_id = $1", [userId]);

    res.json({ message: 'Telefone verificado com sucesso!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao verificar código' });
  }
});

// ROTA 3.5: Perfil do Usuário e Tickets (Carteira)
app.get('/api/users/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    const userQuery = await pool.query(`
      SELECT id, name, email, phone, cpf, cro, address, is_admin 
      FROM users WHERE id = $1
    `, [userId]);

    if (userQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const ticketsQuery = await pool.query(`
      SELECT ut.room_id, r.name as room_name, ut.hourly_tickets, ut.shift_tickets 
      FROM user_tickets ut
      JOIN rooms r ON ut.room_id = r.id
      WHERE ut.user_id = $1
    `, [userId]);

    const user = userQuery.rows[0];
    user.tickets = ticketsQuery.rows; // Array de {room_id, room_name, hourly_tickets, shift_tickets}

    res.json(user);
  } catch (error) {
    console.error('Erro ao buscar perfil do usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// ROTA 4: Login de Usuário
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (user.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.rows[0].id }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
    res.json({
      token, user: {
        id: user.rows[0].id,
        name: user.rows[0].name,
        email: user.rows[0].email,
        phone: user.rows[0].phone,
        is_admin: user.rows[0].is_admin,
        is_phone_verified: user.rows[0].is_phone_verified
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── MERCADO PAGO INTEGRATION ───────────────────────────────────────────

// ROTA 5.1: Criar Preferência de Pagamento
app.post('/api/payments/create-preference', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { reservation_id, title, unit_price, quantity } = req.body;

  try {
    const preference = new Preference(client);
    const response = await preference.create({
      body: {
        items: [
          {
            id: reservation_id,
            title: title || 'Reserva de Sala - LIV',
            unit_price: Number(unit_price),
            quantity: Number(quantity) || 1,
            currency_id: 'BRL'
          }
        ],
        notification_url: `${process.env.NEXT_PUBLIC_API_URL}/api/payments/webhook`,
        back_urls: {
          success: `${process.env.NEXT_PUBLIC_APP_URL}/reservations`,
          failure: `${process.env.NEXT_PUBLIC_APP_URL}/reservations`,
          pending: `${process.env.NEXT_PUBLIC_APP_URL}/reservations`,
        },
        auto_return: 'approved',
        payment_methods: {
          excluded_payment_types: [
            { id: 'credit_card' },
            { id: 'debit_card' },
            { id: 'ticket' }, 
            { id: 'digital_currency' },
            { id: 'digital_wallet' }
          ],
          installments: 1
        },
        metadata: {
          reservation_id: reservation_id
        }
      }
    });

    res.json({ id: response.id, init_point: response.init_point });
  } catch (error) {
    console.error('Erro MP Preference:', error);
    res.status(500).json({ error: 'Erro ao criar preferência de pagamento' });
  }
});

app.post('/api/payments/create-pix', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { reservation_id, title, unit_price } = req.body;

  try {
    const userRes = await pool.query('SELECT name, email, cpf FROM users WHERE id = $1', [(req as any).user.id]);
    const payment = new Payment(client); // Assuming 'client' is the Mercado Pago client instance
    
    // Fallbacks para campos obrigatórios do MP caso usuário não os tenha
    const userEmail = userRes.rows[0]?.email || 'teste@teste.com.br';
    const userName = userRes.rows[0]?.name || 'Usuário';
    const userCpf = userRes.rows[0]?.cpf ? userRes.rows[0].cpf.replace(/\D/g, '') : '00000000000'; // Fallback só para tentar não dar 400 em usuários legado
    
    const response = await payment.create({
      body: {
        transaction_amount: Number(unit_price),
        description: title,
        payment_method_id: 'pix',
        payer: {
          email: userEmail,
          first_name: userName,
          identification: {
            type: 'CPF',
            number: userCpf
          }
        },
        metadata: {
          reservation_id: reservation_id
        }
      }
    });

    const pixData = response.point_of_interaction?.transaction_data;
    if (pixData) {
      res.json({
        qr_code: pixData.qr_code,
        qr_code_base64: pixData.qr_code_base64,
        payment_id: response.id
      });
    } else {
      res.status(500).json({ error: 'Erro ao extrair dados do PIX' });
    }
  } catch (error) {
    console.error('Erro de Criação PIX Direto:', error);
    res.status(500).json({ error: 'Erro ao gerar pagamento PIX' });
  }
});

// ROTA 5.1.5: Criar Pagamento PIX Direto MercadoPago (Compra de Pacotes)
app.post('/api/payments/packages', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { title, unit_price, room_id, shift_tickets, hourly_tickets } = req.body;
  const userId = req.user?.id;

  try {
    const userRes = await pool.query('SELECT name, email, cpf FROM users WHERE id = $1', [userId]);
    const payment = new Payment(client);
    
    // Fallbacks para campos obrigatórios do MP caso usuário não os tenha
    const userEmail = userRes.rows[0]?.email || 'teste@teste.com.br';
    const userName = userRes.rows[0]?.name || 'Usuário';
    const userCpf = userRes.rows[0]?.cpf ? userRes.rows[0].cpf.replace(/\D/g, '') : '00000000000';
    
    const response = await payment.create({
      body: {
        transaction_amount: Number(unit_price),
        description: title,
        payment_method_id: 'pix',
        payer: {
          email: userEmail,
          first_name: userName,
          identification: {
            type: 'CPF',
            number: userCpf
          }
        },
        metadata: {
          is_package: true,
          user_id: userId,
          room_id: room_id,
          shift_tickets: Number(shift_tickets) || 0,
          hourly_tickets: Number(hourly_tickets) || 0
        }
      }
    });

    const pixData = response.point_of_interaction?.transaction_data;
    if (pixData) {
      res.json({
        qr_code: pixData.qr_code,
        qr_code_base64: pixData.qr_code_base64,
        payment_id: response.id
      });
    } else {
      res.status(500).json({ error: 'Erro ao extrair dados do PIX' });
    }
  } catch (error) {
    console.error('Erro de Criação PIX Pacote:', error);
    res.status(500).json({ error: 'Erro ao gerar pagamento PIX do pacote' });
  }
});

// ROTA 5.2: Webhook do Mercado Pago
app.post('/api/payments/webhook', async (req: Request, res: Response) => {
  const { action, data } = req.body;

  // Mercado Pago envia o ID do pagamento quando ação é 'payment.created' ou similar
  if (action === 'payment.created' || action === 'payment.updated' || req.query.type === 'payment') {
    const paymentId = data?.id || req.query['data.id'];

    try {
      // Buscar detalhes do pagamento no Mercado Pago
      const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`
        }
      });
      const paymentData = await paymentResponse.json();

      if (paymentData.status === 'approved') {
        const metadata = paymentData.metadata;
        
        if (metadata?.is_package) {
          // Fluxo de Compra de Pacotes / Tickets
          const userId = metadata.user_id;
          const roomId = metadata.room_id;
          const shiftTickets = Number(metadata.shift_tickets) || 0;
          const hourlyTickets = Number(metadata.hourly_tickets) || 0;
          
          await pool.query(`
            INSERT INTO user_tickets (user_id, room_id, hourly_tickets, shift_tickets)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, room_id) DO UPDATE 
            SET hourly_tickets = user_tickets.hourly_tickets + EXCLUDED.hourly_tickets,
                shift_tickets = user_tickets.shift_tickets + EXCLUDED.shift_tickets
          `, [userId, roomId, hourlyTickets, shiftTickets]);
          
          console.log(`✅ Webhook MP: Pacote Integrado! Usuário ID: ${userId} recebeu +${shiftTickets} Turnos e +${hourlyTickets} Horas no Consultório ID: ${roomId}`);
        
        } else if (metadata?.reservation_id) {
          // Fluxo Convencional de Locação Direta (Avulso Checkout)
          const reservation_id = metadata.reservation_id;

          // 1. Atualizar Status da Reserva
          await pool.query(
            'UPDATE reservations SET status = $1 WHERE id = $2',
            ['confirmed', reservation_id]
          );

          // 2. Registrar/Atualizar Pagamento
          await pool.query(`
            INSERT INTO payments (reservation_id, gateway_transaction_id, payment_status, amount_paid)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (gateway_transaction_id) 
            DO UPDATE SET payment_status = $3, updated_at = NOW()`,
            [reservation_id, paymentId.toString(), 'succeeded', paymentData.transaction_amount]
          );

          console.log(`✅ Webhook MP: Pagamento Direto Aprovado para Locação ${reservation_id}`);

          // Notificar Nova Reserva após confirmação de pagamento
          notifyReservationChange(reservation_id, 'new');
        }
      }
    } catch (error) {
      console.error('Erro Webhook MP:', error);
    }
  }

  // Sempre responder 200 para o Mercado Pago não tentar reenviar infinitamente
  res.sendStatus(200);
});

// Cleanup: Cancelar reservas pendentes há mais de 20 minutos (com aviso via WhatsApp)
setInterval(async () => {
  try {
    // Busca reservas expiradas 
    const expiredReservations = await pool.query(`
      SELECT r.id, u.phone
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      WHERE r.status = 'pending' 
      AND r.created_at < NOW() - INTERVAL '20 minutes'
      AND r.cancellation_notice_sent = FALSE
    `);

    for (const res of expiredReservations.rows) {
      if (res.phone) {
        const cleanPhone = res.phone.replace(/\D/g, '');
        const fullNumber = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
        const text = 'Olá! ⏰ O prazo de 20 minutos para o pagamento expirou e sua reserva de sala na *· LIV · Odontologia* foi cancelada automaticamente pelo sistema.\n\nFique à vontade para acessar o aplicativo e agendar um novo horário quando desejar!';

        try {
          const waRes = await fetch(`${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.EVOLUTION_API_KEY || ''
            },
            body: JSON.stringify({
              number: fullNumber,
              text: text
            })
          });
          if (!waRes.ok) throw new Error(`HTTP ${waRes.status}`);
          console.log(`✅ Aviso de cancelamento WhatsApp enviado para a reserva ${res.id}`);
        } catch (waError) {
          console.error(`❌ Erro ao enviar aviso de cancelamento WA para a reserva ${res.id}:`, waError);
        }
      }

      // 2. Atualiza o status para cancelado e marca o aviso como enviado
      await pool.query(`
        UPDATE reservations 
        SET status = 'cancelled', cancellation_notice_sent = TRUE 
        WHERE id = $1
      `, [res.id]);

      // Notificar ambos via sistema central (Usuário e Clínica)
      notifyReservationChange(res.id as string, 'cancelled');
    }

    if (expiredReservations.rowCount && expiredReservations.rowCount > 0) {
      console.log(`🧹 Cleanup: ${expiredReservations.rowCount} reserva(s) expirada(s) processada(s) e cancelada(s).`);
    }
  } catch (err) {
    console.error('❌ Erro no cleanup de reservas:', err);
  }
}, 60000); // Roda a cada 1 minuto

// ─── TICKET PACKAGES (E-COMMERCE DINÂMICO) ──────────────────────────────────────────────────────

// ROTA PÚBLICA / AUTHENTICADA: Listar pacotes ativos
app.get('/api/packages', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`SELECT * FROM ticket_packages WHERE is_active = TRUE ORDER BY price ASC`);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar pacotes.' });
  }
});

// ADMIN: Criar pacote
app.post('/api/admin/packages', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { room_id, title, type, qty, price, description } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO ticket_packages (room_id, title, type, qty, price, description) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [room_id, title, type, qty, price, description]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar pacote.' });
  }
});

// ADMIN: Atualizar pacote
app.put('/api/admin/packages/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { title, type, qty, price, description, is_active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE ticket_packages 
       SET title = $1, type = $2, qty = $3, price = $4, description = $5, is_active = $6 
       WHERE id = $7 RETURNING *`,
      [title, type, qty, price, description, is_active !== undefined ? is_active : true, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao editar pacote.' });
  }
});

// ADMIN: Deletar pacote
app.delete('/api/admin/packages/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM ticket_packages WHERE id = $1', [id]);
    res.json({ message: 'Pacote deletado com sucesso.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao deletar pacote.' });
  }
});

// Payment Reminder: Enviar WhatsApp após 10 minutos
setInterval(async () => {
  try {
    const result = await pool.query(`
      SELECT r.id, u.phone, ro.name as room_name, 
        to_char(lower(r.booking_period) AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') as res_date,
        to_char(lower(r.booking_period) AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') as start_time,
        to_char(upper(r.booking_period) AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') as end_time
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      JOIN rooms ro ON r.room_id = ro.id
      WHERE r.status = 'pending' 
        AND r.payment_reminder_sent = FALSE 
        AND r.created_at < NOW() - INTERVAL '10 minutes'
    `);

    for (const res of result.rows) {
      if (res.phone) {
        const cleanPhone = res.phone.replace(/\D/g, '');
        const fullNumber = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
        const link = `${process.env.FRONTEND_URL}/reservations`;
        const text = `Olá! Notamos que sua reserva na *${res.room_name}* no dia ${res.res_date} às ${res.start_time} - ${res.end_time} ainda está pendente. ⏳\n\nFaltam apenas 10 minutos para o cancelamento automático. Para garantir sua sala, confirme a reserva realizando o pagamento agora mesmo.\n\n🔗 *Link Seguro para Pagamento:*\n${link}`;

        try {
          const waRes = await fetch(`${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.EVOLUTION_API_KEY || ''
            },
            body: JSON.stringify({
              number: fullNumber,
              text: text
            })
          });
          
          if (!waRes.ok) {
            const errTxt = await waRes.text();
            throw new Error(`Resposta Evolution API: HTTP ${waRes.status} - ${errTxt}`);
          }

          // Marcar como enviado
          await pool.query("UPDATE reservations SET payment_reminder_sent = TRUE WHERE id = $1", [res.id]);
          console.log(`✅ Lembrete de pagamento WhatsApp enviado para a reserva ${res.id}`);
        } catch (waError) {
          console.error(`❌ Erro ao enviar lembrete WA para a reserva ${res.id}:`, waError);
        }
      }
    }
  } catch (err) {
    console.error('❌ Erro no envio de lembretes de pagamento:', err);
  }
}, 60000); // Roda a cada 1 minuto

// Cleanup: Remover contas inativas/não-verificadas há mais de 24 horas
setInterval(async () => {
  try {
    const oldUsers = await pool.query(`
      SELECT id FROM users 
      WHERE is_phone_verified = FALSE 
      AND created_at < NOW() - INTERVAL '24 hours'
    `);

    if (oldUsers.rowCount && oldUsers.rowCount > 0) {
      const userIds = oldUsers.rows.map(u => u.id);
      await pool.query('DELETE FROM verification_codes WHERE user_id = ANY($1)', [userIds]);

      const result = await pool.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
      console.log(`🧹 Cleanup: ${result.rowCount} conta(s) inativa(s) e não verificada(s) deletada(s).`);
    }
  } catch (err) {
    console.error('❌ Erro no cleanup de contas abandonadas:', err);
  }
}, 60 * 60 * 1000); // Roda a cada 1 hora

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
