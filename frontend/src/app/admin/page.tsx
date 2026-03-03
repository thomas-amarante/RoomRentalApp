'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface AdminReservation {
  id: string;
  room_name: string;
  user_name: string;
  user_email: string;
  booking_period: string;
  status: string;
  total_price: number;
}

export default function AdminDashboard() {
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('roomrental_user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUser(userData);

      if (!userData.is_admin) {
        router.push('/');
        return;
      }

      fetch('http://localhost:3001/api/admin/reservations')
        .then(res => res.json())
        .then(data => {
          setReservations(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      router.push('/login');
    }
  }, [router]);

  const handleCancel = async (id: string) => {
    if (!confirm('CANCELAR ESTE AGENDAMENTO CLÍNICO?')) return;

    try {
      const res = await fetch(`http://localhost:3001/api/admin/reservations/${id}/cancel`, {
        method: 'PATCH',
      });

      if (res.ok) {
        setReservations(reservations.map(r => r.id === id ? { ...r, status: 'cancelled' } : r));
      }
    } catch (err) {
      alert('Erro ao cancelar');
    }
  };

  return (
    <>
      <header>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--foreground)', fontWeight: 600, letterSpacing: '0.1em' }}>· L I V · ADMIN</Link>

        <div className="desktop-nav">
          <Link href="/" style={{ textDecoration: 'none', color: 'rgba(0,0,0,0.4)' }}>Salas</Link>
          <Link href="/reservations" style={{ textDecoration: 'none', color: 'rgba(0,0,0,0.4)' }}>Reservas</Link>
          <Link href="/admin" style={{ textDecoration: 'none', color: 'var(--foreground)' }}>Admin</Link>
          <button onClick={() => { localStorage.removeItem('roomrental_user'); router.push('/login'); }} style={{ background: 'transparent', border: 'none', color: 'rgba(0,0,0,0.3)', cursor: 'pointer', fontSize: '13px' }}>Sair</button>
        </div>

        <button className="menu-button" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          <span className="bar"></span>
          <span className="bar"></span>
          <span className="bar"></span>
        </button>
      </header>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="menu-overlay"
            onClick={() => setIsMenuOpen(false)}
          >
            <button className="close-menu-button" onClick={() => setIsMenuOpen(false)}>✕</button>
            <nav className="mobile-nav">
              <Link href="/" onClick={() => setIsMenuOpen(false)}>Salas</Link>
              <Link href="/reservations" onClick={() => setIsMenuOpen(false)}>Reservas</Link>
              <Link href="/admin" onClick={() => setIsMenuOpen(false)}>Admin</Link>
              <button onClick={() => { localStorage.removeItem('roomrental_user'); router.push('/login'); }} >Sair</button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="main-container">
        <section style={{ marginBottom: '60px' }}>
          <h1 style={{ fontSize: '48px', fontWeight: 700, letterSpacing: '-0.04em', marginBottom: '12px', color: 'black' }}>
            Controle Clínico.
          </h1>
          <p style={{ fontSize: '20px', color: '#ff3b30', fontWeight: 600 }}>
            Visão geral de todos os agendamentos da clínica.
          </p>
        </section>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'rgba(0,0,0,0.2)' }}>Carregando dados...</div>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: '20px', overflow: 'hidden', background: 'white' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', fontSize: '11px', color: 'rgba(0,0,0,0.4)', background: 'var(--secondary)' }}>
                  <th style={{ padding: '20px' }}>PACIENTE / PROFISSIONAL</th>
                  <th style={{ padding: '20px' }}>SALA</th>
                  <th style={{ padding: '20px' }}>PERÍODO</th>
                  <th style={{ padding: '20px' }}>STATUS</th>
                  <th style={{ padding: '20px' }}>AÇÃO</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((res) => (
                  <tr key={res.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '14px', color: 'black' }}>
                    <td style={{ padding: '20px' }}>
                      <div style={{ fontWeight: 600 }}>{res.user_name}</div>
                      <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.4)' }}>{res.user_email}</div>
                    </td>
                    <td style={{ padding: '20px' }}>{res.room_name}</td>
                    <td style={{ padding: '20px', color: 'rgba(0,0,0,0.5)' }}>
                      {res.booking_period.replace(/[\"\[\)]/g, '').replace(',', ' até ')}
                    </td>
                    <td style={{ padding: '20px' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: res.status === 'confirmed' ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)',
                        color: res.status === 'confirmed' ? '#248a3d' : '#ff3b30'
                      }}>
                        {res.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '20px' }}>
                      {res.status === 'confirmed' && (
                        <button
                          onClick={() => handleCancel(res.id)}
                          style={{
                            background: 'transparent',
                            border: '1px solid #ff3b30',
                            color: '#ff3b30',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          CANCELAR
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
