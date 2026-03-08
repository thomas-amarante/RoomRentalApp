'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function Verify() {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [user, setUser] = useState<any>(null);
    const router = useRouter();

    useEffect(() => {
        const storedUser = localStorage.getItem('roomrental_user');
        if (!storedUser) {
            router.push('/login');
            return;
        }
        const userData = JSON.parse(storedUser);
        setUser(userData);

        if (userData.is_phone_verified) {
            router.push('/');
        }
    }, []);

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (code.length !== 6) {
            setError('O código deve ter 6 dígitos');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/verify-phone`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token || ''}`
                },
                body: JSON.stringify({ code }),
            });

            const data = await res.json();

            if (res.ok) {
                // Atualizar localStorage
                const updatedUser = { ...user, is_phone_verified: true };
                localStorage.setItem('roomrental_user', JSON.stringify(updatedUser));
                setMessage('Telefone verificado com sucesso!');
                setTimeout(() => router.push('/'), 2000);
            } else {
                setError(data.error || 'Código inválido');
            }
        } catch (err) {
            setError('Erro de conexão');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setResending(true);
        setError('');
        setMessage('');

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/send-verification`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${user.token || ''}`
                }
            });

            if (res.ok) {
                setMessage('Novo código enviado para seu WhatsApp!');
            } else {
                setError('Erro ao reenviar código');
            }
        } catch (err) {
            setError('Erro de conexão');
        } finally {
            setResending(false);
        }
    };

    if (!user) return null;

    return (
        <main style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--secondary)'
        }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                    width: '100%',
                    maxWidth: '400px',
                    padding: '40px',
                    background: 'white',
                    borderRadius: '24px',
                    textAlign: 'center',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.05)'
                }}>
                <div style={{ fontSize: '40px', marginBottom: '20px' }}>📱</div>
                <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>Verifique seu celular</h1>
                <p style={{ color: 'rgba(0,0,0,0.5)', fontSize: '14px', marginBottom: '32px' }}>
                    Enviamos um código de 6 dígitos para o WhatsApp:<br />
                    <strong>{user.phone}</strong>
                </p>

                <form onSubmit={handleVerify}>
                    <input
                        type="text"
                        maxLength={6}
                        placeholder="000000"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                        style={{
                            width: '100%',
                            padding: '16px',
                            fontSize: '24px',
                            textAlign: 'center',
                            letterSpacing: '8px',
                            fontWeight: 700,
                            borderRadius: '12px',
                            border: '2px solid #eee',
                            marginBottom: '16px',
                            outline: 'none'
                        }}
                    />

                    {error && <p style={{ color: '#ff3b30', fontSize: '14px', marginBottom: '16px' }}>{error}</p>}
                    {message && <p style={{ color: '#34c759', fontSize: '14px', marginBottom: '16px' }}>{message}</p>}

                    <button
                        type="submit"
                        disabled={loading || code.length !== 6}
                        className="primary-btn"
                        style={{
                            width: '100%',
                            padding: '16px',
                            fontWeight: 700,
                            opacity: (loading || code.length !== 6) ? 0.5 : 1
                        }}
                    >
                        {loading ? 'Verificando...' : 'Confirmar Código'}
                    </button>
                </form>

                <button
                    onClick={handleResend}
                    disabled={resending}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent)',
                        marginTop: '24px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}
                >
                    {resending ? 'Enviando...' : 'Não recebeu? Reenviar código'}
                </button>

                <div style={{ marginTop: '32px' }}>
                    <button
                        onClick={() => {
                            localStorage.removeItem('roomrental_user');
                            router.push('/login');
                        }}
                        style={{ background: 'none', border: 'none', color: 'rgba(0,0,0,0.3)', cursor: 'pointer', fontSize: '12px' }}
                    >
                        Sair e usar outra conta
                    </button>
                </div>
            </motion.div>
        </main>
    );
}
