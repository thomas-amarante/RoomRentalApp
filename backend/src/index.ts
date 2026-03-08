
import express, { Request, Response } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { authenticateToken, requireAdmin, AuthRequest } from './middleware/auth';
import { MercadoPagoConfig, Preference } from 'mercadopago';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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

// ROTA 1: Listar todas as salas (GET /api/rooms) - PÚBLICA
app.get('/api/rooms', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT * FROM rooms 
      ORDER BY 
        CASE WHEN name ILIKE '%Carina Cigolini%' THEN 0 ELSE 1 END,
        name
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar salas.' });
  }
});
// ROTA 2: Criar uma Reserva - PROTEGIDA
app.post('/api/reservations', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { room_id, user_id, start_time, end_time, total_price } = req.body;

  // Garantir que o usuário só pode criar reservas para ele mesmo (ou pular se ele for admin testando)
  if (req.user?.id !== user_id && !req.user?.is_admin) {
    return res.status(403).json({ error: 'Operação não permitida.' });
  }

  // Verifica se a data do agendamento é no passado garantindo que estamos comparando no mesmo fuso
  const requestDate = new Date(start_time);
  const now = new Date();

  // Como o start_time vem do front sem fuso explícito (ex "2026-03-25 08:00:00"), 
  // o JS pode criá-lo com um offset diferente do "now". 
  // Vamos remover a checagem rigorosa de timezone do JS e usar valor numérico básico para evitar bloqueio falso.
  if (requestDate.getTime() < now.getTime() - (24 * 60 * 60 * 1000)) { // Dá uma tolerância de 1 dia por causa de fuso horário
    return res.status(400).json({ error: 'Não é possível agendar em horários passados.' });
  }

  try {
    const query = `
      INSERT INTO reservations (room_id, user_id, booking_period, total_price, status)
      VALUES ($1, $2, tsrange($3, $4), $5, 'pending')
      RETURNING *;
    `;
    const values = [room_id, user_id, start_time, end_time, total_price];

    const result = await pool.query(query, values);

    // Nota: Removida a simulação automática de pagamento aqui, 
    // agora será via Mercado Pago nas novas rotas abaixo.

    res.status(201).json({
      message: 'Reserva criada! Aguardando pagamento.',
      reservation: result.rows[0]
    });
  } catch (err: any) {
    if (err.code === '23P01') { // Código para check_violation
      return res.status(400).json({ error: 'Este horário está em conflito ou no passado.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Erro ao processar reserva' });
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
    const query = `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        COUNT(r.id) as total_reservations,
        COALESCE(SUM(CASE WHEN r.status = 'confirmed' THEN r.total_price ELSE 0 END), 0) as total_revenue
      FROM users u
      LEFT JOIN reservations r ON u.id = r.user_id
      GROUP BY u.id, u.name, u.email
      ORDER BY total_revenue DESC
    `;
    const result = await pool.query(query);
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
    res.json({ message: 'Reserva cancelada com sucesso.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao cancelar reserva.' });
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

app.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, email, is_admin, phone } = req.body;
  try {
    const result = await pool.query(
      'UPDATE users SET name = $1, email = $2, is_admin = $3, phone = $4 WHERE id = $5 RETURNING id, name, email, is_admin, phone',
      [name, email, is_admin, phone, id]
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

// SALAS (CRUD COMPLETO)
app.post('/api/admin/rooms', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, description, hourly_rate, shift_rate, capacity } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO rooms (name, description, hourly_rate, shift_rate, capacity) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, description, hourly_rate, shift_rate, capacity]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar sala.' });
  }
});

app.put('/api/admin/rooms/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, description, hourly_rate, shift_rate, capacity } = req.body;
  try {
    const result = await pool.query(
      'UPDATE rooms SET name = $1, description = $2, hourly_rate = $3, shift_rate = $4, capacity = $5 WHERE id = $6 RETURNING *',
      [name, description, hourly_rate, shift_rate, capacity, id]
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
    const result = await pool.query(
      'UPDATE reservations SET room_id = $1, user_id = $2, booking_period = $3, status = $4, total_price = $5 WHERE id = $6 RETURNING *',
      [room_id, user_id, booking_period, status, total_price, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao editar reserva.' });
  }
});

// ─── AUTHENTICATION ──────────────────────────────────────────────────────
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { name, email, password, phone } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    const newUser = await pool.query(
      "INSERT INTO users (name, email, password_hash, phone, is_phone_verified) VALUES ($1, $2, $3, $4, FALSE) RETURNING id, name, email, phone, is_phone_verified",
      [name, email, password_hash, phone]
    );

    const user = newUser.rows[0];

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
        const reservation_id = paymentData.metadata.reservation_id;

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

        console.log(`✅ Pagamento ${paymentId} aprovado para reserva ${reservation_id}`);
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
        const text = 'Olá, sua reserva de sala na · LIV · Odontologia foi cancelada';

        try {
          await fetch(`${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`, {
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
    }

    if (expiredReservations.rowCount && expiredReservations.rowCount > 0) {
      console.log(`🧹 Cleanup: ${expiredReservations.rowCount} reserva(s) expirada(s) processada(s) e cancelada(s).`);
    }
  } catch (err) {
    console.error('❌ Erro no cleanup de reservas:', err);
  }
}, 60000); // Roda a cada 1 minuto

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
        const text = `Olá, confirme a sua reserva na ${res.room_name} no dia ${res.res_date} às ${res.start_time} - ${res.end_time} realizando o pagamento. (${link})`;

        try {
          await fetch(`${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`, {
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

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
