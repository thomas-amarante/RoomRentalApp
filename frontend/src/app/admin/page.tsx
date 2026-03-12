'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/Header';

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

interface ReleasedSlot {
  id: string;
  room_id: string;
  date: string;
  start_time: string;
  end_time: string;
}

function getSafeDate(dateString: string) {
  if (!dateString) return new Date();
  return new Date(dateString.endsWith('Z') ? dateString.slice(0, -1) + '-03:00' : dateString + '-03:00');
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'reservations' | 'rooms' | 'exclusive_rooms' | 'users' | 'packages' | 'add_balance'>('reservations');
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [releasedSlots, setReleasedSlots] = useState<ReleasedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'reservations' | 'revenue'>('revenue');
  const [nowUTC, setNowUTC] = useState(new Date());

  // Balance Management States
  const [balanceForm, setBalanceForm] = useState({ userId: '', roomId: '', hourlyTickets: 0, shiftTickets: 0 });
  const [isAddingBalance, setIsAddingBalance] = useState(false);
  const [usersBalances, setUsersBalances] = useState<any[]>([]);

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

  // Package Management States
  const [packages, setPackages] = useState<any[]>([]);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<any | null>(null);
  const [packageForm, setPackageForm] = useState({
    room_id: '', title: '', type: 'hourly', qty: 1, price: 0, description: '', is_active: true
  });

  // Filter States
  const [selectedProfessional, setSelectedProfessional] = useState<string>('');
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [packageFilterRoom, setPackageFilterRoom] = useState<string>('');
  const [packageFilterName, setPackageFilterName] = useState<string>('');

  // Manual Booking States
  const [isManualBookingModalOpen, setIsManualBookingModalOpen] = useState(false);
  const [manualBookingForm, setManualBookingForm] = useState({ user_id: '', room_id: '', date: new Date().toISOString().split('T')[0], start_time: '07:00', type: 'hourly', shift: '07:00-11:00' });
  const [manualAvailableSlots, setManualAvailableSlots] = useState<any[]>([]);
  const [isFetchingManualAvailability, setIsFetchingManualAvailability] = useState(false);
  const [isSubmittingManualBooking, setIsSubmittingManualBooking] = useState(false);

  const router = useRouter();

  const fetchData = async () => {
    const storedUser = localStorage.getItem('roomrental_user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);

        if (!userData.is_admin) {
          router.push('/');
          return;
        }

        setLoading(true);

        // Fetch Reservations
        const resRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/reservations`, {
          headers: { 'Authorization': `Bearer ${userData.token || ''}` }
        });
        if (resRes.status === 401 || resRes.status === 403) throw new Error('unauthorized');
        if (!resRes.ok) throw new Error('Failed to fetch reservations');
        const resData = await resRes.json();
        setReservations(resData);

        // Fetch Rooms
        const roomsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/rooms`);
        if (!roomsRes.ok) throw new Error('Failed to fetch rooms');
        const roomsData = await roomsRes.json();
        setRooms(roomsData);

        // Fetch Packages
        const packsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/packages`);
        if (packsRes.ok) setPackages(await packsRes.json());

        // Fetch User Stats
        const statsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/stats/users`, {
          headers: { 'Authorization': `Bearer ${userData.token || ''}` }
        });
        if (!statsRes.ok) throw new Error('Failed to fetch user stats');
        const statsData = await statsRes.json();
        setUserStats(statsData);

        // Fetch User Balances (New)
        const balancesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/users-balances`, {
          headers: { 'Authorization': `Bearer ${userData.token || ''}` }
        });
        if (balancesRes.ok) {
          const balancesData = await balancesRes.json();
          setUsersBalances(balancesData);
        }

        // Fetch Released Slots
        const releasedRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/released_slots`, {
          headers: { 'Authorization': `Bearer ${userData.token || ''}` }
        });
        if (releasedRes.ok) {
          const releasedData = await releasedRes.json();
          setReleasedSlots(releasedData);
        }
      } catch (err: any) {
        console.error('Fetch error:', err);
        if (err.message === 'unauthorized') {
          localStorage.removeItem('roomrental_user');
          router.push('/login');
        }
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

  useEffect(() => {
    const fetchDynamicStats = async () => {
      if (!user?.token) return;
      try {
        let statsUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/admin/stats/users?`;
        if (selectedMonth) statsUrl += `month=${selectedMonth}&`;
        if (selectedYear) statsUrl += `year=${selectedYear}&`;
        
        const res = await fetch(statsUrl, { headers: { 'Authorization': `Bearer ${user.token}` } });
        if (res.ok) setUserStats(await res.json());
      } catch (err) {}
    };
    fetchDynamicStats();
  }, [selectedMonth, selectedYear, user?.token]);

  const handleAddBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanceForm.userId || !balanceForm.roomId) return alert('Selecione um usuário e uma sala');
    if (balanceForm.hourlyTickets === 0 && balanceForm.shiftTickets === 0) return alert('Adicione pelo menos 1 ticket');
    
    setIsAddingBalance(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/add-tickets`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
         body: JSON.stringify(balanceForm)
      });
      if (res.ok) {
        alert('Saldos adicionados com sucesso!');
        setBalanceForm({ userId: '', roomId: '', hourlyTickets: 0, shiftTickets: 0 });
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao adicionar saldos');
      }
    } catch (err) {
       alert('Erro de conexão');
    } finally {
       setIsAddingBalance(false);
    }
  };

  const [releaseForm, setReleaseForm] = useState({ room_id: '', date: '', start_time: '08:00', end_time: '12:00' });

  const handleCreateRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!releaseForm.room_id || !releaseForm.date) return alert('Preencha a sala e a data.');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/released_slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token || ''}` },
        body: JSON.stringify(releaseForm)
      });
      if (res.ok) {
        const newSlot = await res.json();
        setReleasedSlots([newSlot, ...releasedSlots]);
        setReleaseForm({ ...releaseForm, date: '' });
      } else {
        alert('Erro ao liberar horário.');
      }
    } catch { console.error('Error creating release'); }
  };

  const handleDeleteRelease = async (id: string) => {
    if (!confirm('Bloquear este horário novamente? Ele sumirá do aplicativo do cliente.')) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/released_slots/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user.token || ''}` }
      });
      if (res.ok) {
        setReleasedSlots(releasedSlots.filter(s => s.id !== id));
      }
    } catch { console.error('Error deleting release'); }
  };

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

  const handleOpenPackageModal = (pkg?: any) => {
    if (pkg) {
      setEditingPackage(pkg);
      setPackageForm(pkg);
    } else {
      setEditingPackage(null);
      setPackageForm({ room_id: rooms[0]?.id || '', title: '', type: 'hourly', qty: 1, price: 0, description: '', is_active: true });
    }
    setIsPackageModalOpen(true);
  };

  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!packageForm.room_id) return alert('Selecione um consultório.');
    
    try {
      if (editingPackage) {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/packages/${editingPackage.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token || ''}` },
          body: JSON.stringify(packageForm)
        });
        if (res.ok) {
          const updated = await res.json();
          setPackages(packages.map(p => p.id === updated.id ? updated : p));
          setIsPackageModalOpen(false);
        }
      } else {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/packages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token || ''}` },
          body: JSON.stringify(packageForm)
        });
        if (res.ok) {
           const newPkg = await res.json();
           setPackages([...packages, newPkg]);
           setIsPackageModalOpen(false);
        }
      }
    } catch {
      alert('Erro ao salvar pacote');
    }
  };

  const handleDeletePackage = async (id: string) => {
    if (!confirm('Excluir este pacote da loja publicamente?')) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/packages/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user.token || ''}` }
      });
      if (res.ok) setPackages(packages.filter(p => p.id !== id));
    } catch { alert('Erro ao excluir') }
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

  // --- MANUAL BOOKING LOGIC ---
  useEffect(() => {
    if (manualBookingForm.room_id && manualBookingForm.date) {
      setIsFetchingManualAvailability(true);
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/availability?roomId=${manualBookingForm.room_id}&date=${manualBookingForm.date}`)
        .then(res => res.ok ? res.json() : [])
        .then(data => {
            setManualAvailableSlots(Array.isArray(data) ? data : []);
        })
        .finally(() => setIsFetchingManualAvailability(false));
    } else {
        setManualAvailableSlots([]);
    }
  }, [manualBookingForm.room_id, manualBookingForm.date]);

  const manualHourlyOptions = useMemo(() => {
     if (manualAvailableSlots.length > 0) {
        return manualAvailableSlots.map(s => s.start);
     }
     return [
        '07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30',
        '11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30',
        '15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30',
        '19:00','19:30','20:00','20:30','21:00','21:30','22:00'
      ];
  }, [manualAvailableSlots]);

  const manualShiftOptions = useMemo(() => {
     const ALL_SHIFTS = [
        { label: '07:00 - 12:00', value: '07:00-12:00' },
        { label: '08:00 - 13:00', value: '08:00-13:00' },
        { label: '13:00 - 18:00', value: '13:00-18:00' },
        { label: '14:00 - 19:00', value: '14:00-19:00' },
        { label: '15:00 - 20:00', value: '15:00-20:00' },
        { label: '18:00 - 23:00', value: '18:00-23:00' },
     ];

     return ALL_SHIFTS.filter(opt => {
        const [start, end] = opt.value.split('-');
        const startH = parseInt(start.split(':')[0]);
        const endH = parseInt(end.split(':')[0]);
        for (let h = startH; h < endH; h++) {
           const checkTime = `${String(h).padStart(2, '0')}:00`;
           if (!manualAvailableSlots.some(s => s.start === checkTime)) return false;
        }
        return true;
     });
  }, [manualAvailableSlots]);

  const handleCreateManualBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBookingForm.user_id || !manualBookingForm.room_id) return alert('Selecione usuário e sala.');
    
    let start = manualBookingForm.start_time;
    let end = '';
    
    if (manualBookingForm.type === 'hourly') {
        const [hours, minutes] = start.split(':').map(Number);
        end = `${String(hours + 1).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    } else {
        const parts = manualBookingForm.shift.split('-');
        start = parts[0];
        end = parts[1];
    }
    
    setIsSubmittingManualBooking(true);
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/reservations/manual`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
            body: JSON.stringify({
                user_id: manualBookingForm.user_id,
                room_id: manualBookingForm.room_id,
                start_time: `${manualBookingForm.date} ${start}:00`,
                end_time: `${manualBookingForm.date} ${end}:00`
            })
        });
        
        if (res.ok) {
            alert('Reserva manual criada com sucesso!');
            setIsManualBookingModalOpen(false);
            fetchData();
        } else {
            const data = await res.json();
            alert(data.error || 'Erro ao criar reserva.');
        }
    } catch (err) {
        alert('Erro de conexão ao criar reserva');
    } finally {
        setIsSubmittingManualBooking(false);
    }
  };

  return (
    <>
      <Header />

      <main className="main-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', paddingBottom: '100px' }}>
        <section style={{ marginBottom: '40px', textAlign: 'center', width: '100%', maxWidth: '100vw', overflow: 'hidden' }}>
          <h1 style={{ fontSize: '48px', fontWeight: 700, letterSpacing: '-0.04em', marginBottom: '12px', color: 'black' }}>
            {activeTab === 'reservations' ? 'Controle de agendamento' : activeTab === 'rooms' ? 'Gerenciar Salas' : activeTab === 'exclusive_rooms' ? 'Liberações Manuais' : 'Estatísticas de Usuários'}
          </h1>
          <div className="admin-tabs-container">
            <button
              onClick={() => setActiveTab('reservations')}
              style={{
                flexShrink: 0,
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
              onClick={() => setActiveTab('add_balance')}
              style={{
                flexShrink: 0,
                padding: '10px 24px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'add_balance' ? 'black' : 'transparent',
                color: activeTab === 'add_balance' ? 'white' : 'rgba(0,0,0,0.4)',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: activeTab === 'add_balance' ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              Adicionar Saldo
            </button>
            <button
              onClick={() => setActiveTab('rooms')}
              style={{
                flexShrink: 0,
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
              onClick={() => setActiveTab('exclusive_rooms')}
              style={{
                flexShrink: 0,
                padding: '10px 24px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'exclusive_rooms' ? 'black' : 'transparent',
                color: activeTab === 'exclusive_rooms' ? 'white' : 'rgba(0,0,0,0.4)',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: activeTab === 'exclusive_rooms' ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              Exclusivas (Aberturas)
            </button>
            <button
              onClick={() => setActiveTab('users')}
              style={{
                flexShrink: 0,
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
            <button
              onClick={() => setActiveTab('packages')}
              style={{
                flexShrink: 0,
                padding: '10px 24px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'packages' ? 'black' : 'transparent',
                color: activeTab === 'packages' ? 'white' : 'rgba(0,0,0,0.4)',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: activeTab === 'packages' ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              Pacotes (Loja PIX)
            </button>
            <Link
              href="/admin/debug"
              style={{
                flexShrink: 0,
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

                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
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
                    Limpar Filtros
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px', width: '100%' }}>
                  <button
                    onClick={() => setIsManualBookingModalOpen(true)}
                    style={{
                      height: '50px',
                      padding: '0 24px',
                      background: 'black',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      color: 'white'
                    }}
                  >
                    + Nova Reserva Manual
                  </button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', color: 'rgba(0,0,0,0.2)' }}>Carregando dados...</div>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: '20px', overflowX: 'auto', background: 'white', width: '100%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
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
            <div style={{ border: '1px solid var(--border)', borderRadius: '20px', overflowX: 'auto', background: 'white', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
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
        ) : activeTab === 'users' ? (
          <div style={{ width: '100%' }}>
            {/* User Stats Summary Cards */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', width: '100%', flexWrap: 'wrap' }}>
              <div className="metric-card metric-card-dark" style={{ flex: '1 1 45%' }}>
                <div className="metric-title" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px', zIndex: 1 }}>Total de Profissionais</div>
                <div style={{ fontSize: '42px', fontWeight: 700, zIndex: 1, letterSpacing: '-0.02em' }}>{userStats.length}</div>
              </div>
              <div className="metric-card metric-card-glass" style={{ flex: '1 1 45%' }}>
                <div className="metric-title" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Faturamento Global</div>
                <div className="gradient-text" style={{ fontSize: '28px', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.02em' }}>
                  R$ {userStats.reduce((acc, s) => acc + Number(s.total_revenue), 0).toFixed(2)}
                </div>
              </div>
            </div>

            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '20px', letterSpacing: '-0.02em', textAlign: 'center' }}>🏆 Ranking de Performance</h2>

            {/* MONTH / YEAR FILTERS */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
              <select className="input-field" style={{ width: 'auto', minWidth: '150px' }} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                <option value="">Todos os Meses</option>
                <option value="1">Janeiro</option>
                <option value="2">Fevereiro</option>
                <option value="3">Março</option>
                <option value="4">Abril</option>
                <option value="5">Maio</option>
                <option value="6">Junho</option>
                <option value="7">Julho</option>
                <option value="8">Agosto</option>
                <option value="9">Setembro</option>
                <option value="10">Outubro</option>
                <option value="11">Novembro</option>
                <option value="12">Dezembro</option>
              </select>
              <select className="input-field" style={{ width: 'auto', minWidth: '150px' }} value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                <option value="">Todos os Anos</option>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
                <option value="2028">2028</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '24px', textAlign: 'center' }}>
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

            <div style={{ border: '1px solid var(--border)', borderRadius: '20px', overflowX: 'auto', background: 'white', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
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
        ) : activeTab === 'exclusive_rooms' ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div style={{ background: 'white', padding: '24px', borderRadius: '24px', border: '1px solid var(--border)', width: '100%' }}>
              <h3 style={{ marginBottom: '16px', fontWeight: 600 }}>Liberar Novo Horário</h3>
              <form onSubmit={handleCreateRelease} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Sala Restrita</label>
                  <select className="input-field" value={releaseForm.room_id} onChange={e => setReleaseForm({...releaseForm, room_id: e.target.value})} required>
                    <option value="">Selecione a Sala</option>
                    {rooms.filter(r => (r as any).locked_by_default).map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: '1 1 150px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Data</label>
                  <input type="date" className="input-field" value={releaseForm.date} onChange={e => setReleaseForm({...releaseForm, date: e.target.value})} required />
                </div>
                <div style={{ flex: '1 1 100px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Início</label>
                  <input type="time" className="input-field" value={releaseForm.start_time} onChange={e => setReleaseForm({...releaseForm, start_time: e.target.value})} required />
                </div>
                <div style={{ flex: '1 1 100px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Fim</label>
                  <input type="time" className="input-field" value={releaseForm.end_time} onChange={e => setReleaseForm({...releaseForm, end_time: e.target.value})} required />
                </div>
                <button type="submit" className="primary-btn" style={{ padding: '14px 24px' }}>Liberar Acesso</button>
              </form>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: '20px', overflowX: 'auto', background: 'white', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', fontSize: '11px', color: 'rgba(0,0,0,0.4)', background: 'var(--secondary)' }}>
                    <th style={{ padding: '20px' }}>SALA</th>
                    <th style={{ padding: '20px' }}>DATA</th>
                    <th style={{ padding: '20px' }}>HORÁRIO LIBERADO</th>
                    <th style={{ padding: '20px' }}>AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {releasedSlots.map((s) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '14px', color: 'black' }}>
                      <td style={{ padding: '20px', fontWeight: 600 }}>{rooms.find(r => r.id === s.room_id)?.name || 'Desconhecida'}</td>
                      <td style={{ padding: '20px' }}>{new Date(s.date.split('T')[0] + 'T12:00:00-03:00').toLocaleDateString('pt-BR')}</td>
                      <td style={{ padding: '20px', fontWeight: 600, color: 'var(--accent)' }}>{s.start_time.substring(0,5)} até {s.end_time.substring(0,5)}</td>
                      <td style={{ padding: '20px' }}>
                        <button onClick={() => handleDeleteRelease(s.id)} style={{ color: 'red', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Revogar</button>
                      </td>
                    </tr>
                  ))}
                  {releasedSlots.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: 'rgba(0,0,0,0.4)' }}>Nenhum horário liberado nesta sala.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'packages' ? (
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em', color: 'black' }}>Pacotes de Ingressos (Loja)</h2>
                <p style={{ color: 'rgba(0,0,0,0.5)', fontSize: '14px', marginTop: '4px' }}>Gerencie o que é oferecido para compra na página "Comprar Saldos".</p>
              </div>
              <button onClick={() => handleOpenPackageModal()} className="primary-btn">
                + Novo Pacote
              </button>
            </div>

            {/* Filtros de Pacotes */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', background: 'white', padding: '24px', borderRadius: '20px', border: '1px solid var(--border)' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Filtrar por Consultório</label>
                <select className="input-field" value={packageFilterRoom} onChange={(e) => setPackageFilterRoom(e.target.value)}>
                  <option value="">Todos os Consultórios</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Buscar por Nome</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Ex: Avulso, Pacote Ouro" 
                  value={packageFilterName} 
                  onChange={(e) => setPackageFilterName(e.target.value)} 
                />
              </div>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: '20px', overflowX: 'auto', background: 'white', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', fontSize: '11px', color: 'rgba(0,0,0,0.4)', background: 'var(--secondary)' }}>
                    <th style={{ padding: '20px' }}>SALA DESTINO</th>
                    <th style={{ padding: '20px' }}>NOME DO PACOTE</th>
                    <th style={{ padding: '20px' }}>ENTREGA (TURNO/HORA)</th>
                    <th style={{ padding: '20px' }}>PREÇO</th>
                    <th style={{ padding: '20px' }}>AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {packages.filter(pkg => {
                    const matchRoom = packageFilterRoom ? pkg.room_id === packageFilterRoom : true;
                    const matchName = packageFilterName ? pkg.title.toLowerCase().includes(packageFilterName.toLowerCase()) : true;
                    return matchRoom && matchName;
                  }).map((pkg) => (
                    <tr key={pkg.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '14px', color: 'black' }}>
                      <td style={{ padding: '20px', fontWeight: 600 }}>{rooms.find(r => r.id === pkg.room_id)?.name || 'Desconhecida'}</td>
                      <td style={{ padding: '20px' }}>
                        <div style={{ fontWeight: 600 }}>{pkg.title}</div>
                        <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.4)' }}>{pkg.description}</div>
                      </td>
                      <td style={{ padding: '20px', fontWeight: 600, color: 'var(--accent)' }}>{pkg.qty} {pkg.type === 'shift' ? 'Turno(s)' : 'Hora(s)'}</td>
                      <td style={{ padding: '20px', fontWeight: 700, color: '#16a34a' }}>R$ {Number(pkg.price).toFixed(2)}</td>
                      <td style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                           <button onClick={() => handleOpenPackageModal(pkg)} style={{ background: 'var(--secondary)', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>EDITAR</button>
                           <button onClick={() => handleDeletePackage(pkg.id)} style={{ background: 'transparent', border: '1px solid rgba(0,0,0,0.1)', color: 'rgba(0,0,0,0.4)', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>EXCLUIR</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {packages.filter(pkg => {
                    const matchRoom = packageFilterRoom ? pkg.room_id === packageFilterRoom : true;
                    const matchName = packageFilterName ? pkg.title.toLowerCase().includes(packageFilterName.toLowerCase()) : true;
                    return matchRoom && matchName;
                  }).length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'rgba(0,0,0,0.4)' }}>Nenhum pacote encontrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'add_balance' ? (
          <div style={{ padding: '0 20px', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px' }}>Dar Créditos Virtuais</h2>
            <div className="card" style={{ padding: '40px' }}>
              <form onSubmit={handleAddBalance}>
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Usuário Favorecido</label>
                  <select className="input-field" value={balanceForm.userId} onChange={e => setBalanceForm({...balanceForm, userId: e.target.value})} required>
                    <option value="">Selecione um usuário...</option>
                    {userStats.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                </div>
                
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Consultório</label>
                  <select className="input-field" value={balanceForm.roomId} onChange={e => setBalanceForm({...balanceForm, roomId: e.target.value})} required>
                    <option value="">Selecione o consultório...</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Tickets (Horas Avulsas)</label>
                    <input type="number" min="0" className="input-field" value={balanceForm.hourlyTickets} onChange={e => setBalanceForm({...balanceForm, hourlyTickets: parseInt(e.target.value) || 0})} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Tickets (Turnos 4H)</label>
                    <input type="number" min="0" className="input-field" value={balanceForm.shiftTickets} onChange={e => setBalanceForm({...balanceForm, shiftTickets: parseInt(e.target.value) || 0})} />
                  </div>
                </div>

                <button type="submit" className="primary-btn" style={{ width: '100%', padding: '16px', fontSize: '16px' }} disabled={isAddingBalance}>
                  {isAddingBalance ? 'Adicionando Créditos...' : 'Confirmar e Adicionar Saldo'}
                </button>
              </form>
            </div>

            {/* Balances Table */}
            <div className="card" style={{ marginTop: '40px' }}>
              <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Tabela de Saldos (Por Usuário)</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#fafafa', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase' }}>Usuário</th>
                      <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase' }}>E-mail</th>
                      <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase' }}>Consultório</th>
                      <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', textAlign: 'center' }}>Horas</th>
                      <th style={{ padding: '16px 24px', fontSize: '12px', fontWeight: 600, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', textAlign: 'center' }}>Turnos (5h)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersBalances.map((ub, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '16px 24px', fontWeight: 500 }}>{ub.user_name}</td>
                        <td style={{ padding: '16px 24px', color: 'rgba(0,0,0,0.6)' }}>{ub.user_email}</td>
                        <td style={{ padding: '16px 24px', color: 'rgba(0,0,0,0.6)' }}>{ub.room_name}</td>
                        <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                           <span style={{ background: ub.hourly_tickets > 0 ? 'rgba(52, 199, 89, 0.1)' : 'transparent', color: ub.hourly_tickets > 0 ? '#34c759' : 'rgba(0,0,0,0.4)', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
                              {ub.hourly_tickets}
                           </span>
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                           <span style={{ background: ub.shift_tickets > 0 ? 'rgba(52, 199, 89, 0.1)' : 'transparent', color: ub.shift_tickets > 0 ? '#34c759' : 'rgba(0,0,0,0.4)', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
                              {ub.shift_tickets}
                           </span>
                        </td>
                      </tr>
                    ))}
                    {usersBalances.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'rgba(0,0,0,0.4)' }}>
                          Nenhum usuário possui saldo de tickets no momento.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}

        {/* PACKAGE MODAL */}
        <AnimatePresence>
          {isPackageModalOpen && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPackageModalOpen(false)}
                style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)' }}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                style={{ position: 'relative', background: 'white', width: '100%', maxWidth: '500px', borderRadius: '32px', padding: '40px', boxShadow: '0 20px 60px rgba(0,0,0,0.1)', border: '1px solid var(--border)' }}
              >
                <h2 style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.04em', marginBottom: '24px' }}>
                  {editingPackage ? 'Editar Pacote' : 'Cadastrar Pacote'}
                </h2>
                <form onSubmit={handleSavePackage} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Consultório de Destino</label>
                    <select className="input-field" value={packageForm.room_id} onChange={e => setPackageForm({ ...packageForm, room_id: e.target.value })} required>
                      <option value="">Selecione o Consultório</option>
                      {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Título do Pacote</label>
                    <input required className="input-field" value={packageForm.title} onChange={e => setPackageForm({ ...packageForm, title: e.target.value })} placeholder="Ex: Pacote Ouro C1" />
                  </div>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Tipo</label>
                      <select className="input-field" value={packageForm.type} onChange={e => setPackageForm({ ...packageForm, type: e.target.value })} required>
                        <option value="hourly">Horas (Avulso)</option>
                        <option value="shift">Turnos (5h)</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Quantia Entregue</label>
                      <input type="number" required className="input-field" value={packageForm.qty} onChange={e => setPackageForm({ ...packageForm, qty: parseInt(e.target.value) })} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Valor em Reais (R$)</label>
                    <input type="number" step="0.01" required className="input-field" value={packageForm.price} onChange={e => setPackageForm({ ...packageForm, price: parseFloat(e.target.value) })} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Subtítulo Destacado</label>
                    <input className="input-field" value={packageForm.description} onChange={e => setPackageForm({ ...packageForm, description: e.target.value })} placeholder="Ex: Sai R$ 200/turno" />
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                    <button type="submit" style={{ flex: 2, background: 'black', color: 'white', border: 'none', height: '56px', borderRadius: '16px', fontWeight: 600, cursor: 'pointer' }}>
                      {editingPackage ? 'Salvar Alterações' : 'Colocar à Venda'}
                    </button>
                    <button type="button" onClick={() => setIsPackageModalOpen(false)} style={{ flex: 1, background: 'var(--secondary)', color: 'black', border: 'none', height: '56px', borderRadius: '16px', fontWeight: 600, cursor: 'pointer' }}>
                      Cancelar
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

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

        {/* MANUAL BOOKING MODAL */}
        <AnimatePresence>
          {isManualBookingModalOpen && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsManualBookingModalOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)' }} />
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} style={{ position: 'relative', background: 'white', width: '100%', maxWidth: '600px', borderRadius: '32px', padding: '40px', boxShadow: '0 20px 60px rgba(0,0,0,0.1)', border: '1px solid var(--border)' }}>
                <h2 style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.04em', marginBottom: '24px' }}>Criar Reserva Manual</h2>
                <form onSubmit={handleCreateManualBooking} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Usuário / Cliente</label>
                    <select className="input-field" value={manualBookingForm.user_id} onChange={e => setManualBookingForm({...manualBookingForm, user_id: e.target.value})} required>
                      <option value="">Selecione o Usuário</option>
                      {userStats.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                    </select>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Consultório</label>
                    <select className="input-field" value={manualBookingForm.room_id} onChange={e => setManualBookingForm({...manualBookingForm, room_id: e.target.value})} required>
                      <option value="">Selecione a Sala</option>
                      {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Data</label>
                      <input type="date" className="input-field" value={manualBookingForm.date} onChange={e => setManualBookingForm({...manualBookingForm, date: e.target.value})} required min={new Date().toISOString().split('T')[0]} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Tipo</label>
                      <select className="input-field" value={manualBookingForm.type} onChange={e => setManualBookingForm({...manualBookingForm, type: e.target.value})} required>
                        <option value="hourly">Hora Avulsa</option>
                        <option value="shift">Turno (5h)</option>
                      </select>
                    </div>
                  </div>

                  {manualBookingForm.room_id && manualBookingForm.date && (
                    <div style={{ background: 'var(--secondary)', padding: '20px', borderRadius: '16px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Horário (Disponibilidade Real)</label>
                      {isFetchingManualAvailability ? (
                        <div style={{ fontSize: '14px', color: 'rgba(0,0,0,0.5)' }}>Buscando slots da agenda...</div>
                      ) : (
                        manualBookingForm.type === 'hourly' ? (
                          <select className="input-field" value={manualBookingForm.start_time} onChange={e => setManualBookingForm({...manualBookingForm, start_time: e.target.value})} required>
                            {manualHourlyOptions.length > 0 ? manualHourlyOptions.map(opt => <option key={opt} value={opt}>{opt}</option>) : <option disabled>Sem horários</option>}
                          </select>
                        ) : (
                          <select className="input-field" value={manualBookingForm.shift} onChange={e => setManualBookingForm({...manualBookingForm, shift: e.target.value})} required>
                            {manualShiftOptions.length > 0 ? manualShiftOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>) : <option disabled>Sem horários</option>}
                          </select>
                        )
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                    <button type="submit" style={{ flex: 2, background: 'black', color: 'white', border: 'none', height: '56px', borderRadius: '16px', fontWeight: 600, cursor: 'pointer' }} disabled={isSubmittingManualBooking}>
                      {isSubmittingManualBooking ? 'Processando (Criando)' : 'Forçar Confirmação'}
                    </button>
                    <button type="button" onClick={() => setIsManualBookingModalOpen(false)} style={{ flex: 1, background: 'var(--secondary)', color: 'black', border: 'none', height: '56px', borderRadius: '16px', fontWeight: 600, cursor: 'pointer' }}>
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
