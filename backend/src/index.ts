
import express, { Request, Response } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ROTA 1: Listar todas as salas (GET /api/rooms)
app.get('/api/rooms', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM rooms ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar salas.' });
  }
});

// ROTA 2: Criar uma Reserva
app.post('/api/reservations', async (req: Request, res: Response) => {
  const { room_id, user_id, start_time, end_time, total_price } = req.body;

  if (new Date(start_time) < new Date()) {
    return res.status(400).json({ error: 'Não é possível agendar em horários passados.' });
  }

  try {
    const query = `
      INSERT INTO reservations (room_id, user_id, booking_period, total_price, status)
      VALUES ($1, $2, tsrange($3, $4), $5, 'confirmed')
      RETURNING *;
    `;
    const values = [room_id, user_id, start_time, end_time, total_price];

    const result = await pool.query(query, values);

    // Simulação de criação de registro de pagamento
    await pool.query(
      'INSERT INTO payments (reservation_id, gateway_transaction_id, payment_status, amount_paid) VALUES ($1, $2, $3, $4)',
      [result.rows[0].id, `pi_${Math.random().toString(36).substr(2, 9)}`, 'succeeded', total_price]
    );

    res.status(201).json({
      message: 'Pagamento processado e reserva confirmada!',
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

// ROTA 2.1: Obter reservas do usuário
app.get('/api/reservations/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const query = `
      SELECT r.*, ro.name as room_name, ro.description as room_description
      FROM reservations r
      JOIN rooms ro ON r.room_id = ro.id
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar reservas.' });
  }
});

// ROTA 2.2: Obter todas as reservas (Admin)
app.get('/api/admin/reservations', async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT r.*, ro.name as room_name, u.name as user_name, u.email as user_email
      FROM reservations r
      JOIN rooms ro ON r.room_id = ro.id
      JOIN users u ON r.user_id = u.id
      ORDER BY r.created_at DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar todas as reservas.' });
  }
});

// ROTA 2.3: Cancelar reserva (Admin)
app.patch('/api/admin/reservations/:id/cancel', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE reservations SET status = $1 WHERE id = $2', ['cancelled', id]);
    res.json({ message: 'Reserva cancelada com sucesso.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao cancelar reserva.' });
  }
});

// ROTA 3: Registro de Usuário
app.post('/api/auth/register', async (req: Request, res: Response) => {

  const { name, email, password } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    const newUser = await pool.query(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, password_hash]
    );
    res.json({ user: newUser.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
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
    res.json({ token, user: { id: user.rows[0].id, name: user.rows[0].name, email: user.rows[0].email, is_admin: user.rows[0].is_admin } });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
