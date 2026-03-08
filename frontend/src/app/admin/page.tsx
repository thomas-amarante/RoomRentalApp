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
  created_at: string;
}

interface Room {
  id?: string;
  name: string;
  description: string;
  hourly_rate: number;
  shift_rate: number;
  capacity: number;
}

interface UserStats {
  id: string;
  name: string;
  email: string;
  total_reservations: string | number;
  total_revenue: string | number;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'reservations' | 'rooms' | 'users'>('reservations');
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'reservations' | 'revenue'>('revenue');
  const [nowUTC, setNowUTC] = useState(new Date());

  // Timer para o countdown no admin
  useEffect(() => {
    const timer = setInterval(() => setNowUTC(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Room Management States
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomForm, setRoomForm] = useState<Room>({
    name: '',
    description: '',
    hourly_rate: 0,
    shift_rate: 0,
    capacity: 1
  });

  // Filter States
  const [selectedProfessional, setSelectedProfessional] = useState<string>('');
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  const router = useRouter();

  const fetchData = async () => {
    const storedUser = localStorage.getItem('roomrental_user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUser(userData);

      if (!userData.is_admin) {
        router.push('/');
        return;
      }

      setLoading(true);
      try {
        // Fetch Reservations
        const resRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/reservations`, {
          headers: { 'Authorization': `Bearer ${userData.token || ''}` }
        });
        const resData = await resRes.json();
        setReservations(resData);

        // Fetch Rooms
        const roomsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/rooms`);
        const roomsData = await roomsRes.json();
        setRooms(roomsData);

        // Fetch User Stats
        const statsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/stats/users`, {
          headers: { 'Authorization': `Bearer ${userData.token || ''}` }
        });
        const statsData = await statsRes.json();
        setUserStats(statsData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    } else {
      router.push('/login');
    }
  };

  useEffect(() => {
    fetchData();
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

  const handleOpenRoomModal = (room?: Room) => {
    if (room) {
      setEditingRoom(room);
      setRoomForm(room);
    } else {
      setEditingRoom(null);
      setRoomForm({ name: '', description: '', hourly_rate: 0, shift_rate: 0, capacity: 1 });
    }
    setIsRoomModalOpen(true);
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingRoom ? 'PUT' : 'POST';
    const url = editingRoom
      ? `${process.env.NEXT_PUBLIC_API_URL}/api/admin/rooms/${editingRoom.id}`
      : `${process.env.NEXT_PUBLIC_API_URL}/api/admin/rooms`;

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token || ''}`
        },
        body: JSON.stringify(roomForm)
      });

      if (res.ok) {
        setIsRoomModalOpen(false);
        fetchData();
      } else {
        alert('Erro ao salvar sala');
      }
    } catch (err) {
      alert('Erro ao conectar ao servidor');
    }
  };

  const handleDeleteRoom = async (id: string) => {
    if (!confirm('DESEJA EXCLUIR ESTA SALA PERMANENTEMENTE?')) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/rooms/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.token || ''}`
        }
      });

      if (res.ok) {
        setRooms(rooms.filter(r => r.id !== id));
      }
    } catch (err) {
      alert('Erro ao excluir');
    }
  };

  return (
    <>
      <header>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--foreground)', fontWeight: 600, letterSpacing: '0.1em' }}>· L I V · ADMIN</Link>

        <div className="desktop-nav">
          <Link href="/" style={{ textDecoration: 'none', color: 'rgba(0,0,0,0.4)' }}>Salas</Link>
          <Link href="/reservations" style={{ textDecoration: 'none', color: 'rgba(0,0,0,0.4)' }}>Reservas</Link>
          <Link href="/admin" style={{ textDecoration: 'none', color: 'var(--foreground)', fontWeight: 700 }}>Admin</Link>
          <button onClick={() => { localStorage.removeItem('roomrental_user'); router.push('/login'); }} style={{ background: 'transparent', border: 'none', color: 'rgba(0,0,0,0.3)', cursor: 'pointer', fontSize: '13px', marginLeft: '12px' }}>Sair</button>
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
              <Link href="/admin" onClick={() => setIsMenuOpen(false)}>Painel Admin</Link>
              <button onClick={() => { localStorage.removeItem('roomrental_user'); router.push('/login'); }} >Sair</button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="main-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', paddingBottom: '100px' }}>
        <section style={{ marginBottom: '40px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '48px', fontWeight: 700, letterSpacing: '-0.04em', marginBottom: '12px', color: 'black' }}>
            {activeTab === 'reservations' ? 'Controle de agendamento' : activeTab === 'rooms' ? 'Gerenciar Salas' : 'Estatísticas de Usuários'}
          </h1>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', background: 'rgba(0,0,0,0.05)', padding: '6px', borderRadius: '12px' }}>
            <button
              onClick={() => setActiveTab('reservations')}
              style={{
                padding: '10px 24px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'reservations' ? 'black' : 'transparent',
                color: activeTab === 'reservations' ? 'white' : 'rgba(0,0,0,0.4)',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: activeTab === 'reservations' ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              Agendamentos
            </button>
            <button
              onClick={() => setActiveTab('rooms')}
              style={{
                padding: '10px 24px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'rooms' ? 'black' : 'transparent',
                color: activeTab === 'rooms' ? 'white' : 'rgba(0,0,0,0.4)',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: activeTab === 'rooms' ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              Lista de Salas
            </button>
            <button
              onClick={() => setActiveTab('users')}
              style={{
                padding: '10px 24px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'users' ? 'black' : 'transparent',
                color: activeTab === 'users' ? 'white' : 'rgba(0,0,0,0.4)',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: activeTab === 'users' ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              Usuários (Ranking)
            </button>
            <Link
              href="/admin/debug"
              style={{
                padding: '10px 24px',
                borderRadius: '10px',
                border: 'none',
                background: 'transparent',
                color: 'rgba(0,0,0,0.3)',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'none',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.2s'
              }}
            >
              🛠️ Debug
            </Link>
          </div>
        </section>

        {activeTab === 'reservations' ? (
          <>
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
                    <option value="pending">Aguardando Pagamento</option>
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
                      <th style={{ padding: '20px' }}>TEMPO</th>
                      <th style={{ padding: '20px' }}>VALOR</th>
                      <th style={{ padding: '20px' }}>AÇÃO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.filter(res => {
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
                          {(() => {
                            const created = new Date(res.created_at);
                            const diffMs = nowUTC.getTime() - created.getTime();
                            const diffSecs = Math.floor(diffMs / 1000);
                            const remainingSecs = (20 * 60) - diffSecs;
                            const isExpired = res.status === 'pending' && remainingSecs <= 0;

                            return (
                              <span style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 600,
                                background: res.status === 'confirmed' ? 'rgba(52,199,89,0.1)' : (isExpired || res.status === 'cancelled' ? 'rgba(255,59,48,0.1)' : 'rgba(255,149,0,0.1)'),
                                color: res.status === 'confirmed' ? '#248a3d' : (isExpired || res.status === 'cancelled' ? '#ff3b30' : '#ff9500')
                              }}>
                                {res.status === 'confirmed' ? 'CONFIRMADO' : (isExpired ? 'CANCELADO (SEM PAGAMENTO)' : (res.status === 'pending' ? 'AGUARDANDO PAGAMENTO' : 'CANCELADO'))}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ padding: '20px', fontSize: '12px', fontWeight: 600, color: 'rgba(0,0,0,0.4)' }}>
                          {(() => {
                            if (res.status !== 'pending') return '-';
                            const created = new Date(res.created_at);
                            const diffMs = nowUTC.getTime() - created.getTime();
                            const diffSecs = Math.floor(diffMs / 1000);
                            const remainingSecs = (20 * 60) - diffSecs;

                            if (remainingSecs <= 0) return '00:00';
                            const mins = Math.floor(remainingSecs / 60);
                            const secs = remainingSecs % 60;
                            return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
                          })()}
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
          </>
        ) : activeTab === 'rooms' ? (
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
              <button
                onClick={() => handleOpenRoomModal()}
                style={{
                  background: 'black',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>+</span> Adicionar Nova Sala
              </button>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: '20px', overflow: 'hidden', background: 'white', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', fontSize: '11px', color: 'rgba(0,0,0,0.4)', background: 'var(--secondary)' }}>
                    <th style={{ padding: '20px' }}>NOME DA SALA</th>
                    <th style={{ padding: '20px' }}>VALOR/HORA</th>
                    <th style={{ padding: '20px' }}>VALOR/TURNO (4H)</th>
                    <th style={{ padding: '20px' }}>CAPACIDADE</th>
                    <th style={{ padding: '20px' }}>AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={room.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '14px', color: 'black' }}>
                      <td style={{ padding: '20px' }}>
                        <div style={{ fontWeight: 600 }}>{room.name}</div>
                        <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.4)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {room.description}
                        </div>
                      </td>
                      <td style={{ padding: '20px', fontWeight: 600 }}>R$ {Number(room.hourly_rate).toFixed(2)}</td>
                      <td style={{ padding: '20px', fontWeight: 600 }}>R$ {Number(room.shift_rate).toFixed(2)}</td>
                      <td style={{ padding: '20px' }}>{room.capacity} pessoas</td>
                      <td style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleOpenRoomModal(room)}
                            style={{
                              background: 'var(--secondary)',
                              border: 'none',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                          >
                            EDITAR
                          </button>
                          <button
                            onClick={() => room.id && handleDeleteRoom(room.id)}
                            style={{
                              background: 'transparent',
                              border: '1px solid rgba(0,0,0,0.1)',
                              color: 'rgba(0,0,0,0.4)',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                          >
                            EXCLUIR
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{ width: '100%' }}>
            {/* User Stats Summary Cards */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', width: '100%' }}>
              <div style={{ flex: 1, background: 'white', padding: '24px', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px' }}>Total de Profissionais</div>
                <div style={{ fontSize: '32px', fontWeight: 700 }}>{userStats.length}</div>
              </div>
              <div style={{ flex: 1, background: 'white', padding: '24px', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px' }}>Faturamento Global</div>
                <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--accent)' }}>
                  R$ {userStats.reduce((acc, s) => acc + Number(s.total_revenue), 0).toFixed(2)}
                </div>
              </div>
            </div>

            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '20px', letterSpacing: '-0.02em' }}>🏆 Ranking de Performance</h2>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ color: 'rgba(0,0,0,0.5)', fontSize: '14px' }}>
                Classificar profissionais por:
              </div>
              <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.05)', padding: '4px', borderRadius: '10px' }}>
                <button
                  onClick={() => setSortBy('revenue')}
                  style={{
                    padding: '6px 14px', borderRadius: '7px', border: 'none',
                    background: sortBy === 'revenue' ? 'white' : 'transparent',
                    fontWeight: 600, fontSize: '12px', cursor: 'pointer',
                    boxShadow: sortBy === 'revenue' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                  }}
                >
                  Maior Receita
                </button>
                <button
                  onClick={() => setSortBy('reservations')}
                  style={{
                    padding: '6px 14px', borderRadius: '7px', border: 'none',
                    background: sortBy === 'reservations' ? 'white' : 'transparent',
                    fontWeight: 600, fontSize: '12px', cursor: 'pointer',
                    boxShadow: sortBy === 'reservations' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                  }}
                >
                  Mais Reservas
                </button>
              </div>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: '20px', overflow: 'hidden', background: 'white', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', fontSize: '11px', color: 'rgba(0,0,0,0.4)', background: 'var(--secondary)' }}>
                    <th style={{ padding: '20px' }}>PROFISSIONAL</th>
                    <th style={{ padding: '20px' }}>Nº RESERVAS TOTAIS</th>
                    <th style={{ padding: '20px' }}>RECEITA GERADA (PAGO)</th>
                    <th style={{ padding: '20px' }}>STATUS GERAL</th>
                  </tr>
                </thead>
                <tbody>
                  {[...userStats].sort((a, b) => {
                    const valA = sortBy === 'revenue' ? Number(a.total_revenue) : Number(a.total_reservations);
                    const valB = sortBy === 'revenue' ? Number(b.total_revenue) : Number(b.total_reservations);
                    return valB - valA;
                  }).map((s) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '14px', color: 'black' }}>
                      <td style={{ padding: '20px' }}>
                        <div style={{ fontWeight: 600 }}>{s.name}</div>
                        <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.4)' }}>{s.email}</div>
                      </td>
                      <td style={{ padding: '20px', fontWeight: 600 }}>{s.total_reservations}</td>
                      <td style={{ padding: '20px', fontWeight: 600 }}>R$ {Number(s.total_revenue).toFixed(2)}</td>
                      <td style={{ padding: '20px' }}>
                        {Number(s.total_revenue) > 500 ? (
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#34c759' }}>VIP 👑</span>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'rgba(0,0,0,0.3)' }}>ATIVO 🟢</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ROOM MODAL */}
        <AnimatePresence>
          {isRoomModalOpen && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsRoomModalOpen(false)}
                style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)' }}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                style={{
                  position: 'relative',
                  background: 'white',
                  width: '100%',
                  maxWidth: '500px',
                  borderRadius: '32px',
                  padding: '40px',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
                  border: '1px solid var(--border)'
                }}
              >
                <h2 style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.04em', marginBottom: '24px' }}>
                  {editingRoom ? 'Editar Sala' : 'Nova Sala'}
                </h2>
                <form onSubmit={handleSaveRoom} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Nome da Sala</label>
                    <input
                      required
                      className="input-field"
                      value={roomForm.name}
                      onChange={e => setRoomForm({ ...roomForm, name: e.target.value })}
                      placeholder="Ex: Sala Carina Cigolini"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Descrição</label>
                    <textarea
                      className="input-field"
                      style={{ height: '80px', paddingTop: '12px' }}
                      value={roomForm.description}
                      onChange={e => setRoomForm({ ...roomForm, description: e.target.value })}
                      placeholder="Detalhes sobre a sala..."
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Valor/Hora (R$)</label>
                      <input
                        type="number" step="0.01" required
                        className="input-field"
                        value={roomForm.hourly_rate}
                        onChange={e => setRoomForm({ ...roomForm, hourly_rate: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Valor/Turno (R$)</label>
                      <input
                        type="number" step="0.01" required
                        className="input-field"
                        value={roomForm.shift_rate}
                        onChange={e => setRoomForm({ ...roomForm, shift_rate: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Capacidade (Pessoas)</label>
                    <input
                      type="number" required
                      className="input-field"
                      value={roomForm.capacity}
                      onChange={e => setRoomForm({ ...roomForm, capacity: parseInt(e.target.value) })}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                    <button
                      type="submit"
                      style={{ flex: 2, background: 'black', color: 'white', border: 'none', height: '56px', borderRadius: '16px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      {editingRoom ? 'Atualizar Sala' : 'Criar Sala'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsRoomModalOpen(false)}
                      style={{ flex: 1, background: 'var(--secondary)', color: 'black', border: 'none', height: '56px', borderRadius: '16px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}
