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

  // Filter States
  const [selectedProfessional, setSelectedProfessional] = useState<string>('');
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

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

      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/reservations`, {
        headers: {
          'Authorization': `Bearer ${userData.token || ''}` // Assume que o token foi salvo junto na response de login no frontend, ou busca de outro lugar
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data.error) throw new Error(data.error);
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/reservations/${id}/cancel`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${user.token || ''}`
        }
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

      <main className="main-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <section style={{ marginBottom: '40px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '48px', fontWeight: 700, letterSpacing: '-0.04em', marginBottom: '12px', color: 'black' }}>
            Controle de agendamento
          </h1>
          <p style={{ fontSize: '20px', color: '#444', fontWeight: 600 }}>
            Visão geral de todos os agendamentos
          </p>
        </section>

        {/* Filters Section */}
        {!loading && (
          <div style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '32px',
            width: '100%',
            flexWrap: 'wrap',
            background: 'white',
            padding: '24px',
            borderRadius: '20px',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
          }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Profissional</label>
              <select className="input-field" value={selectedProfessional} onChange={(e) => setSelectedProfessional(e.target.value)}>
                <option value="">Todos os profissionais</option>
                {Array.from(new Set(reservations.map(r => r.user_name))).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <div style={{ flex: '1 1 200px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Sala</label>
              <select className="input-field" value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)}>
                <option value="">Todas as salas</option>
                {Array.from(new Set(reservations.map(r => r.room_name))).map(room => (
                  <option key={room} value={room}>{room}</option>
                ))}
              </select>
            </div>

            <div style={{ flex: '1 1 200px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Mês</label>
              <select className="input-field" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                <option value="">Todos os meses</option>
                {Array.from(new Set(reservations.map(r => {
                  try {
                    const startStr = r.booking_period.replace(/[\"\[\)]/g, '').split(',')[0];
                    if (!startStr) return '';
                    const d = new Date(startStr);
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // Format: YYYY-MM
                  } catch (e) { return ''; }
                }).filter(Boolean))).sort().map(monthStr => {
                  const [year, month] = monthStr.split('-');
                  const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
                  return <option key={monthStr} value={monthStr}>{monthName.charAt(0).toUpperCase() + monthName.slice(1)}</option>
                })}
              </select>
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Status</label>
              <select className="input-field" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                <option value="">Todos os status</option>
                <option value="confirmed">Confirmado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={() => { setSelectedProfessional(''); setSelectedRoom(''); setSelectedMonth(''); setSelectedStatus(''); }}
                style={{
                  height: '50px',
                  padding: '0 24px',
                  background: 'var(--secondary)',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: 'var(--foreground)'
                }}
              >
                Limpar
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', color: 'rgba(0,0,0,0.2)' }}>Carregando dados...</div>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: '20px', overflow: 'hidden', background: 'white', width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', fontSize: '11px', color: 'rgba(0,0,0,0.4)', background: 'var(--secondary)' }}>
                  <th style={{ padding: '20px' }}>PROFISSIONAL</th>
                  <th style={{ padding: '20px' }}>SALA</th>
                  <th style={{ padding: '20px' }}>PERÍODO</th>
                  <th style={{ padding: '20px' }}>STATUS</th>
                  <th style={{ padding: '20px' }}>VALOR</th>
                  <th style={{ padding: '20px' }}>AÇÃO</th>
                </tr>
              </thead>
              <tbody>
                {reservations.filter(res => {
                  // Apply Filters
                  if (selectedProfessional && res.user_name !== selectedProfessional) return false;
                  if (selectedRoom && res.room_name !== selectedRoom) return false;
                  if (selectedStatus && res.status !== selectedStatus) return false;
                  if (selectedMonth) {
                    try {
                      const startStr = res.booking_period.replace(/[\"\[\)]/g, '').split(',')[0];
                      const d = new Date(startStr);
                      const resMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                      if (resMonth !== selectedMonth) return false;
                    } catch (e) { return false; }
                  }
                  return true;
                }).map((res) => (
                  <tr key={res.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '14px', color: 'black' }}>
                    <td style={{ padding: '20px' }}>
                      <div style={{ fontWeight: 600 }}>{res.user_name}</div>
                      <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.4)' }}>{res.user_email}</div>
                    </td>
                    <td style={{ padding: '20px' }}>{res.room_name}</td>
                    <td style={{ padding: '20px', color: 'rgba(0,0,0,0.5)' }}>
                      {(() => {
                        try {
                          const cleanStr = res.booking_period.replace(/[\"\[\)]/g, '');
                          const [start, end] = cleanStr.split(',');
                          if (!start || !end) return cleanStr;

                          const startDate = new Date(start);
                          const endDate = new Date(end);

                          const dateStr = startDate.toLocaleDateString('pt-BR');
                          const startTime = startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                          const endTime = endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                          return `${dateStr} - ${startTime} às ${endTime}`;
                        } catch (e) {
                          return res.booking_period.replace(/[\"\[\)]/g, '').replace(',', ' até ');
                        }
                      })()}
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
                        {res.status === 'confirmed' ? 'CONFIRMADO' : 'CANCELADO'}
                      </span>
                    </td>
                    <td style={{ padding: '20px', fontWeight: 600 }}>
                      R$ {Number(res.total_price).toFixed(2)}
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
