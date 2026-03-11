'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

type AuthMode = 'login' | 'register' | 'forgot';

export default function Login() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('+55 ');
  const [cpf, setCpf] = useState('');
  const [cro, setCro] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const endpoint = mode === 'login' ? '/api/auth/login' :
      mode === 'register' ? '/api/auth/register' : '/api/auth/forgot-password';

    const body = mode === 'register' ? { name, email, password, phone: phone.replace(/\D/g, ''), cpf: cpf.replace(/\D/g, ''), cro, address } :
      mode === 'login' ? { email, password } : { email };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        if (mode === 'forgot') {
          setMessage(data.message);
        } else {
          localStorage.setItem('roomrental_user', JSON.stringify({ ...data.user, token: data.token }));
          if (mode === 'register' || !data.user.is_phone_verified) {
            router.push('/verify');
          } else {
            router.push('/');
          }
        }
      } else {
        setError(data.error || 'Erro na operação');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--secondary)'
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '48px',
          background: 'white',
          borderRadius: '28px',
          border: '1px solid #d2d2d7', // Borda original (mais fina)
          boxShadow: '0 20px 40px rgba(0,0,0,0.04)',
          textAlign: 'center'
        }}>
        <div style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '8px' }}>· L I V · ODONTOLOGIA</div>

        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >


            <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
              {mode === 'register' && (
                <>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Nome Completo</label>
                    <input type="text" className="input-field" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>CPF</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="000.000.000-00"
                      value={cpf}
                      onChange={(e) => {
                        let val = e.target.value.replace(/\D/g, '').slice(0, 11);
                        if (val.length > 9) val = val.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
                        else if (val.length > 6) val = val.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
                        else if (val.length > 3) val = val.replace(/(\d{3})(\d{1,3})/, "$1.$2");
                        setCpf(val);
                      }}
                      required
                    />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>CRO (Opcional)</label>
                    <input type="text" className="input-field" placeholder="Ex: 12345/SP" value={cro} onChange={(e) => setCro(e.target.value)} />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Endereço Completo</label>
                    <input type="text" className="input-field" placeholder="Rua, Número, Bairro - Cidade/UF" value={address} onChange={(e) => setAddress(e.target.value)} required />
                  </div>
                </>
              )}

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>E-mail</label>
                <input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>

              {mode !== 'forgot' && (
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Senha</label>
                  <input type="password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
              )}

              {mode === 'register' && (
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Celular (com DDD)</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="+55 (XX) XXXXX-XXXX"
                    value={phone}
                    onChange={(e) => {
                      let val = e.target.value;
                      // Manter o +55 fixo
                      if (!val.startsWith('+55 ')) val = '+55 ';

                      // Extrair apenas os números após o +55
                      const numbers = val.slice(4).replace(/\D/g, '').slice(0, 11);

                      // Aplicar Máscara: +55 (XX) XXXXX-XXXX
                      let formatted = '+55 ';
                      if (numbers.length > 0) {
                        formatted += '(' + numbers.slice(0, 2);
                        if (numbers.length > 2) {
                          formatted += ') ' + numbers.slice(2, 7);
                          if (numbers.length > 7) {
                            formatted += '-' + numbers.slice(7);
                          }
                        }
                      }
                      setPhone(formatted);
                    }}
                    required
                  />
                  <div style={{ fontSize: '10px', color: 'rgba(0,0,0,0.3)', marginTop: '4px' }}>
                    Mínimo de 11 números (ex: 11 98888-7777)
                  </div>
                </div>
              )}

              {error && <p style={{ color: '#ff3b30', fontSize: '13px', marginBottom: '16px', fontWeight: 500 }}>{error}</p>}
              {message && <p style={{ color: '#34c759', fontSize: '13px', marginBottom: '16px', fontWeight: 500 }}>{message}</p>}

              <button
                type="submit"
                className="primary-btn"
                disabled={loading || (mode === 'register' && (phone.replace(/\D/g, '').length < 11 || cpf.replace(/\D/g, '').length < 11))}
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: 600,
                  marginTop: '8px',
                  opacity: (mode === 'register' && (phone.replace(/\D/g, '').length < 11 || cpf.replace(/\D/g, '').length < 11)) ? 0.5 : 1,
                  cursor: (mode === 'register' && (phone.replace(/\D/g, '').length < 11 || cpf.replace(/\D/g, '').length < 11)) ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Aguarde...' : (mode === 'login' ? 'Entrar' : mode === 'register' ? 'Criar Conta' : 'Enviar Link')}
              </button>
            </form>

            <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {mode === 'login' ? (
                <>
                  <button onClick={() => setMode('register')} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                    Não tem uma conta? Cadastre-se agora.
                  </button>
                  <button onClick={() => setMode('forgot')} style={{ background: 'transparent', border: 'none', color: '#ff3b30', cursor: 'pointer', fontSize: '13px' }}>
                    Esqueceu a senha? Clique aqui.
                  </button>
                </>
              ) : (
                <button onClick={() => setMode('login')} style={{ background: 'transparent', border: 'none', color: 'rgba(0,0,0,0.4)', cursor: 'pointer', fontSize: '14px' }}>
                  ← Voltar para o login
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </main>
  );
}
