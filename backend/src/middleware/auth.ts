import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

export interface AuthRequest extends Request {
    user?: {
        id: string;
        name: string;
        email: string;
        is_admin: boolean;
    };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };

        // Buscar o usuário no banco para garantir que ele ainda existe e tem is_admin atualizado
        const userResult = await pool.query('SELECT id, name, email, is_admin FROM users WHERE id = $1', [decoded.id]);

        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Usuário não encontrado.' });
        }

        req.user = userResult.rows[0];
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Token inválido ou expirado.' });
    }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({ error: 'Acesso restrito para administradores.' });
    }
    next();
};
