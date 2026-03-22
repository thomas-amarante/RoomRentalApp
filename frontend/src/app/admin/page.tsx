'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
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
  photo1?: string;
  photo2?: string;
  photo3?: string;
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
  const [activeTab, setActiveTab] = useState<'reservations' | 'rooms' | 'exclusive_rooms' | 'users' | 'packages' | 'add_balance' | 'inactive_rooms'>('reservations');
  const [reservations, setReservations] = useState<AdminReservation[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [releasedSlots, setReleasedSlots] = useState<ReleasedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'reservations' | 'revenue'>('revenue');
  const [nowUTC, setNowUTC] = useState(new Date());
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarRange, setCalendarRange] = useState<'week' | 'month'>('week');
  const [roomsSubTab, setRoomsSubTab] = useState<'list' | 'exclusive' | 'blocks'>('list');
  const [exclusiveViewMode, setExclusiveViewMode] = useState<'table' | 'calendar'>('table');
  const [selectedDayReservations, setSelectedDayReservations] = useState<AdminReservation[] | null>(null);
  const [selectedDayLabel, setSelectedDayLabel] = useState<string>('');
  const [selectedReservation, setSelectedReservation] = useState<AdminReservation | null>(null);

  // Balance Management States
  const [balanceForm, setBalanceForm] = useState({ userId: '', roomId: '', hourlyTickets: 0, shiftTickets: 0 });
  const [isAddingBalance, setIsAddingBalance] = useState(false);
  const [usersBalances, setUsersBalances] = useState<any[]>([]);
  
  // Pivoted Balances for the table
  const pivotedBalances = useMemo(() => {
    const users: Record<string, any> = {};
    if (Array.isArray(usersBalances)) {
      usersBalances.forEach(ub => {
        if (!users[ub.user_email]) {
          users[ub.user_email] = {
            name: ub.user_name,
            email: ub.user_email,
            rooms: {},
            totalHourly: 0,
            totalShift: 0
          };
        }
        users[ub.user_email].rooms[ub.room_name] = {
          hourly: ub.hourly_tickets,
          shift: ub.shift_tickets
        };
        users[ub.user_email].totalHourly += ub.hourly_tickets;
        users[ub.user_email].totalShift += ub.shift_tickets;
      });
    }
    return Object.values(users).sort((a,b) => a.name.localeCompare(b.name));
  }, [usersBalances]);

  // Timer para o countdown no admin
  useEffect(() => {
    const timer = setInterval(() => setNowUTC(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [isAdminMobile, setIsAdminMobile] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setIsAdminMobile(window.innerWidth < 1024); // Admin table is wider, so we use a larger breakpoint
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsRef.current) {
      const scrollAmount = 200;
      tabsRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Room Management States
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomForm, setRoomForm] = useState<Room>({
    name: '',
    description: '',
    hourly_rate: 0,
    shift_rate: 0,
    capacity: 1,
    photo1: '',
    photo2: '',
    photo3: ''
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

  // Exclusive Rooms Availability
  const [releaseAvailableSlots, setReleaseAvailableSlots] = useState<any[]>([]);
  const [isFetchingReleaseAvailability, setIsFetchingReleaseAvailability] = useState(false);

  // Room Blocks
  const [roomBlocks, setRoomBlocks] = useState<any[]>([]);
  const [blockForm, setBlockForm] = useState({ room_id: '', date: '', start_time: '08:00', end_time: '12:00', reason: '' });

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

        // Fetch Room Blocks
        const blocksRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/blocks`, {
          headers: { 'Authorization': `Bearer ${userData.token || ''}` }
        });
        if (blocksRes.ok) {
          const blocksData = await blocksRes.json();
          setRoomBlocks(blocksData);
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
        alert('Erro ao remover liberação.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockForm.room_id || !blockForm.date || !blockForm.start_time || !blockForm.end_time) return alert('Preencha os campos obrigatórios.');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token || ''}` },
        body: JSON.stringify(blockForm)
      });
      if (res.ok) {
        alert('Sala inativada com sucesso.');
        setBlockForm({ room_id: '', date: '', start_time: '08:00', end_time: '12:00', reason: '' });
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao inativar sala.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão ao criar inativação.');
    }
  };

  const handleDeleteBlock = async (id: string) => {
    if (!confirm('Deseja realmente remover esta inativação?')) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/blocks/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user.token || ''}` }
      });
      if (res.ok) {
        alert('Inativação removida, sala disponível novamente.');
        fetchData();
      } else {
        alert('Erro ao remover inativação.');
      }
    } catch (err) {
      console.error(err);
    }
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
      setRoomForm({
        ...room,
        photo1: room.photo1 || '',
        photo2: room.photo2 || '',
        photo3: room.photo3 || ''
      });
    } else {
      setEditingRoom(null);
      setRoomForm({ name: '', description: '', hourly_rate: 0, shift_rate: 0, capacity: 1, photo1: '', photo2: '', photo3: '' });
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

    } finally {
      setIsRoomModalOpen(false);
      fetchData();
    }
  };

  const [isUploading, setIsUploading] = useState<number | null>(null);
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'photo1' | 'photo2' | 'photo3') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(field === 'photo1' ? 1 : field === 'photo2' ? 2 : 3);
    const formData = new FormData();
    formData.append('photo', file);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token || ''}`
        },
        body: formData
      });

      if (res.ok) {
        const { url } = await res.json();
        setRoomForm(prev => ({ ...prev, [field]: url }));
      } else {
        alert('Erro ao carregar imagem');
      }
    } catch {
      alert('Erro de conexão no upload');
    } finally {
      setIsUploading(null);
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

  useEffect(() => {
    if (releaseForm.room_id && releaseForm.date) {
      setIsFetchingReleaseAvailability(true);
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/availability?roomId=${releaseForm.room_id}&date=${releaseForm.date}`)
        .then(res => res.ok ? res.json() : [])
        .then(data => {
            setReleaseAvailableSlots(Array.isArray(data) ? data : []);
        })
        .finally(() => setIsFetchingReleaseAvailability(false));
    } else {
        setReleaseAvailableSlots([]);
    }
  }, [releaseForm.room_id, releaseForm.date]);

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
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: '1200px', margin: '0 auto 24px', gap: '4px', padding: isAdminMobile ? '0 8px' : '0' }}>
            {isAdminMobile && (
              <button 
                onClick={() => scrollTabs('left')}
                style={{ 
                  flexShrink: 0, 
                  background: 'rgba(0,0,0,0.03)', 
                  border: 'none', 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '20px', 
                  color: 'rgba(0,0,0,0.4)', 
                  cursor: 'pointer' 
                }}
              >
                ‹
              </button>
            )}
            
            <div className="admin-tabs-container" style={{ flex: 1 }} ref={tabsRef}>
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
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 24px',
                  borderRadius: '10px',
                  color: 'rgba(0,0,0,0.3)',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: 500,
                  transition: 'all 0.2s'
                }}
              >
                📟 Debug
              </Link>
            </div>

            {isAdminMobile && (
              <button 
                onClick={() => scrollTabs('right')}
                style={{ 
                  flexShrink: 0, 
                  background: 'rgba(0,0,0,0.03)', 
                  border: 'none', 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '20px', 
                  color: 'rgba(0,0,0,0.4)', 
                  cursor: 'pointer' 
                }}
              >
                ›
              </button>
            )}
          </div>
          <h1 style={{ fontSize: '48px', fontWeight: 700, letterSpacing: '-0.04em', margin: '0 auto', color: 'black' }}>
            {activeTab === 'reservations' ? 'Sala de controle' : 
             activeTab === 'rooms' ? (roomsSubTab === 'list' ? 'Gerenciar Salas' : roomsSubTab === 'exclusive' ? 'Liberações Manuais - Consultório 3' : 'Inativar Salas') : 
             activeTab === 'add_balance' ? 'Gerenciar Créditos' :
             activeTab === 'packages' ? 'Gestão de Pacotes' :
             activeTab === 'users' ? 'Estatísticas de Usuários' :
             'Sala de controle'}
          </h1>
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


                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
                  <button
                    onClick={() => { setSelectedProfessional(''); setSelectedRoom(''); setSelectedMonth(''); }}
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

            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginBottom: '24px', 
              width: '100%', 
              gap: '12px', 
              flexDirection: isAdminMobile ? 'column-reverse' : 'row',
              alignItems: isAdminMobile ? 'stretch' : 'center'
            }}>
                  <div style={{ 
                    display: 'flex', 
                    background: 'rgba(0,0,0,0.05)', 
                    padding: '4px', 
                    borderRadius: '12px',
                    width: isAdminMobile ? '100%' : 'auto'
                  }}>
                    <button
                      onClick={() => setViewMode('table')}
                      style={{
                        flex: isAdminMobile ? 1 : 'none',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        border: 'none',
                        background: viewMode === 'table' ? 'white' : 'transparent',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer',
                        boxShadow: viewMode === 'table' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      📋 Tabela
                    </button>
                    <button
                      onClick={() => setViewMode('calendar')}
                      style={{
                        flex: isAdminMobile ? 1 : 'none',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        border: 'none',
                        background: viewMode === 'calendar' ? 'white' : 'transparent',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer',
                        boxShadow: viewMode === 'calendar' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      🗓️ Calendário
                    </button>
                  </div>
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
            ) : viewMode === 'table' ? (
              <div style={{ border: '1px solid var(--border)', borderRadius: '20px', overflowX: 'auto', background: 'white', width: '100%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', fontSize: '11px', color: 'rgba(0,0,0,0.4)', background: 'var(--secondary)' }}>
                      <th style={{ padding: '20px' }}>PROFISSIONAL</th>
                      <th style={{ padding: '20px' }}>SALA</th>
                      <th style={{ padding: '20px' }}>PERÍODO</th>
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
                              const startDate = getSafeDate(start);
                              const endDate = getSafeDate(end);
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
            ) : (
              <div style={{ width: '100%', background: 'white', borderRadius: isAdminMobile ? '12px' : '24px', border: '1px solid var(--border)', padding: isAdminMobile ? '12px' : '24px', minHeight: '600px', overflowX: 'hidden' }}>
                {/* Calendar Navigation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px', width: isAdminMobile ? '100%' : 'auto', justifyContent: 'center' }}>
                    <button 
                      onClick={() => {
                        const d = new Date(calendarDate);
                        if (calendarRange === 'week') {
                          d.setDate(d.getDate() - 7);
                        } else {
                          d.setMonth(d.getMonth() - 1);
                        }
                        setCalendarDate(d);
                      }}
                      style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                    >
                      ←
                    </button>
                    <button 
                      onClick={() => setCalendarDate(new Date())}
                      style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                    >
                      Hoje
                    </button>
                    <button 
                      onClick={() => {
                        const d = new Date(calendarDate);
                        if (calendarRange === 'week') {
                          d.setDate(d.getDate() + 7);
                        } else {
                          d.setMonth(d.getMonth() + 1);
                        }
                        setCalendarDate(d);
                      }}
                      style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                    >
                      →
                    </button>
                  </div>

                  <h3 style={{ fontSize: '20px', fontWeight: 700, margin: 0, textAlign: 'center', flex: 1 }}>
                    {calendarDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}
                  </h3>

                  <div style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', padding: '4px', borderRadius: '10px' }}>
                    <button
                      onClick={() => setCalendarRange('week')}
                      style={{
                        padding: '6px 14px', borderRadius: '7px', border: 'none',
                        background: calendarRange === 'week' ? 'white' : 'transparent',
                        fontWeight: 600, fontSize: '12px', cursor: 'pointer',
                        boxShadow: calendarRange === 'week' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                      }}
                    >
                      Semana
                    </button>
                    <button
                      onClick={() => setCalendarRange('month')}
                      style={{
                        padding: '6px 14px', borderRadius: '7px', border: 'none',
                        background: calendarRange === 'month' ? 'white' : 'transparent',
                        fontWeight: 600, fontSize: '12px', cursor: 'pointer',
                        boxShadow: calendarRange === 'month' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                      }}
                    >
                      Mês
                    </button>
                  </div>
                </div>

                {calendarRange === 'week' ? (
                  /* Calendar Grid (Week) */
                  <div style={{ width: '100%', overflowX: 'auto', borderRadius: '12px', border: '1px solid #eee' }}>
                    <div style={{ minWidth: isAdminMobile ? '750px' : 'auto' }}>
                      {/* Days Header */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: isAdminMobile ? '50px repeat(7, 100px)' : '80px repeat(7, 1fr)', 
                        borderBottom: '1px solid #eee', 
                        background: '#fafafa',
                        position: 'sticky',
                        top: 0,
                        zIndex: 20
                      }}>
                        <div style={{ padding: '15px' }} />
                        {(() => {
                          const curr = new Date(calendarDate);
                          const day = curr.getDay();
                          const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
                          const monday = new Date(curr.setDate(diff));
                          
                          return Array.from({length: 7}).map((_, i) => {
                            const date = new Date(monday);
                            date.setDate(monday.getDate() + i);
                            const isToday = date.toDateString() === new Date().toDateString();
                            return (
                              <div key={i} style={{ padding: '15px 5px', textAlign: 'center', borderLeft: '1px solid #eee' }}>
                                <div style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(0,0,0,0.3)', textTransform: 'uppercase', marginBottom: '4px' }}>
                                  {date.toLocaleDateString('pt-BR', { weekday: 'short' })}
                                </div>
                                <div style={{ 
                                  fontSize: '16px', 
                                  fontWeight: 700, 
                                  color: isToday ? 'white' : 'black',
                                  background: isToday ? '#0071e3' : 'transparent',
                                  width: '28px',
                                  height: '28px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '50%',
                                  margin: '4px auto 0'
                                }}>
                                  {date.getDate()}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>

                      <div style={{ height: '700px', overflowY: 'auto', position: 'relative', minWidth: isAdminMobile ? '750px' : 'auto' }}>
                        {[7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22].map(hour => (
                          <div key={hour} style={{ display: 'grid', gridTemplateColumns: isAdminMobile ? '50px repeat(7, 100px)' : '80px repeat(7, 1fr)', height: '60px', borderBottom: '1px dotted #eee' }}>
                            <div style={{ fontSize: '11px', color: 'rgba(0,0,0,0.3)', fontWeight: 600, padding: '10px', textAlign: 'right' }}>
                              {String(hour).padStart(2, '0')}:00
                            </div>
                            {[0,1,2,3,4,5,6].map(day => (
                              <div key={day} style={{ borderLeft: '1px solid #eee', position: 'relative' }} />
                            ))}
                          </div>
                        ))}

                        {/* Overlays (Reservations) */}
                        {(() => {
                          const curr = new Date(calendarDate);
                          const day = curr.getDay();
                          const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
                          const weekStart = new Date(curr.setDate(diff));
                          weekStart.setHours(0,0,0,0);
                          const weekEnd = new Date(weekStart);
                          weekEnd.setDate(weekEnd.getDate() + 7);

                          // Pre-compute sub-column positioning for overlapping reservations
                          const weekFiltered = reservations.filter(res => {
                            if (res.status === 'cancelled') return false;
                            if (selectedRoom && res.room_name !== selectedRoom) return false;
                            if (selectedProfessional && res.user_name !== selectedProfessional) return false;
                            const cleanStr = res.booking_period.replace(/[\"\[\)]/g, '');
                            const startStr = cleanStr.split(',')[0];
                            const resDate = getSafeDate(startStr);
                            return resDate >= weekStart && resDate < weekEnd;
                          });

                          // For each reservation, determine how many others overlap (same day+time)
                          const overlapMap = new Map();
                          weekFiltered.forEach(res => {
                            const c = res.booking_period.replace(/[\"\[\)]/g, '');
                            const [s, e] = c.split(',');
                            const rStart = getSafeDate(s);
                            const rEnd   = getSafeDate(e);
                            const rDay   = (rStart.getDay() + 6) % 7;
                            // Find all reservations that overlap this one on the same day
                            const overlapping = weekFiltered.filter(other => {
                              const oc = other.booking_period.replace(/[\"\[\)]/g, '');
                              const [os, oe] = oc.split(',');
                              const oStart = getSafeDate(os);
                              const oEnd   = getSafeDate(oe);
                              const oDay   = (oStart.getDay() + 6) % 7;
                              return oDay === rDay && oStart < rEnd && oEnd > rStart;
                            });
                            // Sort by room name so ordering is deterministic
                            overlapping.sort((a, b) => a.room_name.localeCompare(b.room_name));
                            const subCol = overlapping.findIndex(o => o.id === res.id);
                            overlapMap.set(res.id, { subCol, totalCols: overlapping.length });
                          });

                          return weekFiltered
                             .map(res => {
                               const cleanStr = res.booking_period.replace(/[\"\[\)]/g, '');
                               const [startStr, endStr] = cleanStr.split(',');
                               const start = getSafeDate(startStr);
                               const end = getSafeDate(endStr);

                               const dayIndex = (start.getDay() + 6) % 7; // Monday = 0
                               const startHour = start.getHours() + start.getMinutes() / 60;
                               const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

                               const top = (startHour - 7) * 60;
                               const height = duration * 60;

                               // Overlap-aware positioning
                               const { subCol, totalCols } = overlapMap.get(res.id) || { subCol: 0, totalCols: 1 };
                               const left = isAdminMobile
                                 ? `calc(50px + 100px * ${dayIndex} + ${(100 / totalCols) * subCol}px)`
                                 : `calc(80px + (100% - 80px) / 7 * ${dayIndex} + (100% - 80px) / 7 / ${totalCols} * ${subCol})`;
                               const width = isAdminMobile
                                 ? `${100 / totalCols}px`
                                 : `calc((100% - 80px) / 7 / ${totalCols})`;
                               // Cor por sala (view semanal)
                               const getWeekColor = (name: string) => {
                                 const n = (name || '').toLowerCase();
                                 if (n.includes('carina'))  return { bg: 'rgba(52,199,89,0.12)',  border: '#34c759' };
                                 if (n.includes('1'))        return { bg: 'rgba(0,122,255,0.10)',  border: '#007aff' };
                                 if (n.includes('2'))        return { bg: 'rgba(255,45,135,0.10)', border: '#ff2d87' };
                                 return { bg: 'rgba(52,199,89,0.12)', border: '#34c759' };
                               };
                               const weekColor = res.status !== 'confirmed'
                                 ? { bg: 'rgba(255,149,0,0.10)', border: '#ff9500' }
                                 : getWeekColor(res.room_name);
                               return (
                                 <div
                                   key={res.id}
                                   style={{
                                     position: 'absolute',
                                     top: `${top}px`,
                                     left: left,
                                     width: width,
                                     height: `${height}px`,
                                     padding: '2px',
                                     zIndex: 10
                                   }}
                                 >
                                  <div 
                                    onClick={() => setSelectedReservation(res)}
                                    style={{
                                      background: weekColor.bg,
                                      border: `1px solid ${weekColor.border}`,
                                      borderLeft: `4px solid ${weekColor.border}`,
                                      borderRadius: '6px',
                                      height: '100%',
                                      padding: '6px 8px',
                                      overflow: 'hidden',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s',
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      justifyContent: height < 40 ? 'center' : 'flex-start'
                                    }}
                                    title={`${res.user_name} - ${res.room_name}`}
                                  >
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'black', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {res.user_name}
                                    </div>
                                    {height >= 35 && (
                                      <div style={{ fontSize: '10px', fontWeight: 500, color: 'rgba(0,0,0,0.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {res.room_name}
                                      </div>
                                    )}
                                    {height >= 50 && (
                                      <div style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(0,0,0,0.4)', marginTop: 'auto' }}>
                                        {start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            });
                        })()}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Calendar Grid (Month) */
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: '#eee', border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden' }}>
                      {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
                        <div key={d} style={{ background: '#fafafa', padding: '12px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.3)', textTransform: 'uppercase' }}>
                          {d}
                        </div>
                      ))}
                      {(() => {
                        const year = calendarDate.getFullYear();
                        const month = calendarDate.getMonth();
                        const firstDay = new Date(year, month, 1);
                        const lastDay = new Date(year, month + 1, 0);
                        
                        // Get padding for start of month
                        let startPadding = firstDay.getDay(); // 0 is Sunday
                        startPadding = startPadding === 0 ? 6 : startPadding - 1; // 0 is Monday
                        
                        const days = [];
                        // Prev month days
                        const prevLastDay = new Date(year, month, 0).getDate();
                        for (let i = startPadding - 1; i >= 0; i--) {
                          days.push({ day: prevLastDay - i, month: 'prev' });
                        }
                        // Current month days
                        for (let i = 1; i <= lastDay.getDate(); i++) {
                          days.push({ day: i, month: 'curr' });
                        }
                        // Next month days
                        const remaining = 42 - days.length;
                        for (let i = 1; i <= remaining; i++) {
                          days.push({ day: i, month: 'next' });
                        }

                        return days.map((d, i) => {
                          const dateObj = new Date(year, month + (d.month === 'prev' ? -1 : d.month === 'next' ? 1 : 0), d.day);
                          const isToday = dateObj.toDateString() === new Date().toDateString();
                          
                          const dayReservations = reservations.filter(res => {
                             if (res.status === 'cancelled') return false;
                             if (selectedRoom && res.room_name !== selectedRoom) return false;
                             if (selectedProfessional && res.user_name !== selectedProfessional) return false;
                             const startStr = res.booking_period.replace(/[\"\[\)]/g, '').split(',')[0];
                             const resDate = getSafeDate(startStr);
                             return resDate.toDateString() === dateObj.toDateString();
                          });
                          return (
                            <div 
                              key={i} 
                              onClick={() => {
                                if (dayReservations.length > 0) {
                                  setSelectedDayReservations(dayReservations);
                                  setSelectedDayLabel(dateObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }));
                                }
                              }}
                              style={{ 
                                background: 'white', 
                                minHeight: isAdminMobile ? '60px' : '120px', 
                                padding: isAdminMobile ? '4px' : '8px', 
                                opacity: d.month === 'curr' ? 1 : 0.4,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: isAdminMobile ? 'center' : 'flex-start',
                                position: 'relative',
                                cursor: dayReservations.length > 0 ? 'pointer' : 'default',
                                transition: 'all 0.2s'
                              }}>
                              <div style={{ 
                                fontSize: isAdminMobile ? '12px' : '14px', 
                                fontWeight: 700, 
                                color: isToday ? 'white' : 'black',
                                background: isToday ? 'black' : 'transparent',
                                width: isAdminMobile ? '20px' : '24px',
                                height: isAdminMobile ? '20px' : '24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '50%',
                                marginBottom: isAdminMobile ? '4px' : '8px'
                              }}>
                                {d.day}
                              </div>
                              {isAdminMobile ? (
                                dayReservations.length > 0 && (() => {
                                  const distinctRooms = Array.from(new Set(dayReservations.map(r => r.room_name)));
                                  return (
                                    <div style={{ display: 'flex', gap: '3px', marginTop: '2px' }}>
                                      {distinctRooms.slice(0, 3).map(name => {
                                        const n = name?.toLowerCase() || '';
                                        const dotColor = n.includes('carina') ? '#34c759' : n.includes('1') ? '#007aff' : n.includes('2') ? '#ff2d87' : '#34c759';
                                        return <div key={name} style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor }} />;
                                      })}
                                    </div>
                                  );
                                })()
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
                                  {dayReservations.slice(0, 4).map(res => {
                                    const getRoomColor = (name: string) => {
                                      const n = name?.toLowerCase() || '';
                                      if (n.includes('carina')) return { bg: 'rgba(52,199,89,0.12)',  text: '#248a3d', border: '#34c759' };
                                      if (n.includes('1'))       return { bg: 'rgba(0,122,255,0.10)',  text: '#0051a8', border: '#007aff' };
                                      if (n.includes('2'))       return { bg: 'rgba(255,45,135,0.10)', text: '#b5005e', border: '#ff2d87' };
                                      return { bg: 'rgba(52,199,89,0.12)', text: '#248a3d', border: '#34c759' };
                                    };
                                    const color = res.status !== 'confirmed'
                                      ? { bg: 'rgba(255,149,0,0.10)', text: '#e67e00', border: '#ff9500' }
                                      : getRoomColor(res.room_name);
                                    return (
                                      <div
                                        key={res.id}
                                        onClick={(e) => { e.stopPropagation(); setSelectedReservation(res); }}
                                        style={{
                                          fontSize: '9px',
                                          fontWeight: 600,
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          background: color.bg,
                                          color: color.text,
                                          borderLeft: `2px solid ${color.border}`,
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        {res.user_name.split(' ')[0]}
                                      </div>
                                    );
                                  })}
                                  {dayReservations.length > 4 && (
                                    <div style={{ fontSize: '8px', color: 'rgba(0,0,0,0.4)', textAlign: 'center', fontWeight: 600 }}>
                                      +{dayReservations.length - 4} mais
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
                
                {/* Legend */}
                <div style={{ marginTop: '24px', display: 'flex', gap: '20px', fontSize: '12px', color: 'rgba(0,0,0,0.5)', fontWeight: 600, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(52,199,89,0.2)', border: '1px solid #34c759' }} /> Consultório 3
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(0,122,255,0.15)', border: '1px solid #007aff' }} /> Consultório 1
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(255,45,135,0.15)', border: '1px solid #ff2d87' }} /> Consultório 2
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(255,149,0,0.2)', border: '1px solid #ff9500' }} /> Pendente
                  </div>
                </div>
              </div>
            )}
          </>
        ) : activeTab === 'rooms' ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Submenu for Rooms */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', background: 'rgba(0,0,0,0.05)', padding: '4px', borderRadius: '12px', width: isAdminMobile ? '100%' : 'auto' }}>
              <button
                onClick={() => setRoomsSubTab('list')}
                style={{
                  flex: isAdminMobile ? 1 : 'none',
                  padding: '10px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: roomsSubTab === 'list' ? 'white' : 'transparent',
                  color: roomsSubTab === 'list' ? 'black' : 'rgba(0,0,0,0.4)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: roomsSubTab === 'list' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 0.2s',
                  fontSize: isAdminMobile ? '12px' : '14px'
                }}
              >
                Todas as Salas
              </button>
              <button
                onClick={() => setRoomsSubTab('exclusive')}
                style={{
                  flex: isAdminMobile ? 1 : 'none',
                  padding: '10px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: roomsSubTab === 'exclusive' ? 'white' : 'transparent',
                  color: roomsSubTab === 'exclusive' ? 'black' : 'rgba(0,0,0,0.4)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: roomsSubTab === 'exclusive' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 0.2s',
                  fontSize: isAdminMobile ? '12px' : '14px'
                }}
              >
                Liberações manuais
              </button>
              <button
                onClick={() => setRoomsSubTab('blocks')}
                style={{
                  flex: isAdminMobile ? 1 : 'none',
                  padding: '10px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: roomsSubTab === 'blocks' ? 'white' : 'transparent',
                  color: roomsSubTab === 'blocks' ? 'black' : 'rgba(0,0,0,0.4)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: roomsSubTab === 'blocks' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 0.2s',
                  fontSize: isAdminMobile ? '12px' : '14px'
                }}
              >
                Inativar Salas
              </button>
            </div>

            {roomsSubTab === 'list' ? (
              <div style={{ width: '100%' }}>
                <div style={{ border: '1px solid var(--border)', borderRadius: '20px', overflowX: 'auto', background: 'white', width: '100%' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', fontSize: '11px', color: 'rgba(0,0,0,0.4)', background: 'var(--secondary)' }}>
                        <th style={{ padding: '20px' }}>NOME DA SALA</th>
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
            ) : roomsSubTab === 'exclusive' ? (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <div style={{ background: 'white', padding: '24px', borderRadius: '24px', border: '1px solid var(--border)', width: '100%' }}>
                  <h3 style={{ marginBottom: '16px', fontWeight: 600 }}>Liberar Novo Horário - Sala Consultório 3</h3>
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
                      <input type="date" className="input-field" value={releaseForm.date} onChange={e => { if (e.target.value) setReleaseForm({...releaseForm, date: e.target.value}); }} required />
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Toggle View for Exclusive Slots */}
                  <div style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', padding: '4px', borderRadius: '12px', alignSelf: isAdminMobile ? 'stretch' : 'flex-start' }}>
                    <button
                      onClick={() => setExclusiveViewMode('table')}
                      style={{
                        flex: isAdminMobile ? 1 : 'none',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        border: 'none',
                        background: exclusiveViewMode === 'table' ? 'white' : 'transparent',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer',
                        boxShadow: exclusiveViewMode === 'table' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      📋 Lista
                    </button>
                    <button
                      onClick={() => setExclusiveViewMode('calendar')}
                      style={{
                        flex: isAdminMobile ? 1 : 'none',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        border: 'none',
                        background: exclusiveViewMode === 'calendar' ? 'white' : 'transparent',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer',
                        boxShadow: exclusiveViewMode === 'calendar' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      🗓️ Agenda
                    </button>
                  </div>

                  {exclusiveViewMode === 'table' ? (
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
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    /* Calendar View for Releases */
                    <div style={{ width: '100%', background: 'white', borderRadius: isAdminMobile ? '12px' : '24px', border: '1px solid var(--border)', padding: isAdminMobile ? '12px' : '24px', minHeight: '600px' }}>
                       {/* Simplified Weekly View for Releases */}
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '8px' }}>
                          <button 
                            onClick={() => {
                              const d = new Date(calendarDate);
                              d.setDate(d.getDate() - 7);
                              setCalendarDate(d);
                            }}
                            className="input-field" style={{ width: 'auto', padding: '8px 12px' }}
                          >←</button>
                          <h4 style={{ margin: 0, fontWeight: 700 }}>{calendarDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}</h4>
                          <button 
                            onClick={() => {
                              const d = new Date(calendarDate);
                              d.setDate(d.getDate() + 7);
                              setCalendarDate(d);
                            }}
                            className="input-field" style={{ width: 'auto', padding: '8px 12px' }}
                          >→</button>
                       </div>
                       
                       {/* Grid View for the week */}
                       <div style={{ display: 'grid', gridTemplateColumns: isAdminMobile ? 'repeat(2, 1fr)' : 'repeat(7, 1fr)', gap: '10px' }}>
                          {(() => {
                            const curr = new Date(calendarDate);
                            const day = curr.getDay();
                            const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
                            const monday = new Date(curr.setDate(diff));
                            
                            return Array.from({length: 7}).map((_, i) => {
                              const dayDate = new Date(monday);
                              dayDate.setDate(monday.getDate() + i);
                              const dayStr = dayDate.toISOString().split('T')[0];
                              const dayReleases = releasedSlots.filter(s => s.date.startsWith(dayStr));
                              
                              return (
                                <div key={i} style={{ minHeight: '120px', border: '1px solid #eee', borderRadius: '12px', padding: '12px', background: dayDate.toDateString() === new Date().toDateString() ? 'rgba(0,113,227,0.02)' : 'transparent', borderTop: dayDate.toDateString() === new Date().toDateString() ? '3px solid #0071e3' : '1px solid #eee' }}>
                                  <div style={{ fontSize: '11px', textAlign: 'center', color: dayDate.toDateString() === new Date().toDateString() ? '#0071e3' : 'rgba(0,0,0,0.3)', fontWeight: 800, marginBottom: '8px', textTransform: 'uppercase' }}>
                                    {dayDate.toLocaleDateString('pt-BR', { weekday: 'short' })} {dayDate.getDate()}
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {dayReleases.map(r => (
                                      <div key={r.id} style={{ fontSize: '10px', background: '#0071e3', color: 'white', padding: '6px', borderRadius: '6px', fontWeight: 600, textAlign: 'center' }}>
                                        {r.start_time.substring(0,5)} - {r.end_time.substring(0,5)}
                                      </div>
                                    ))}
                                    {dayReleases.length === 0 && (
                                      <div style={{ fontSize: '10px', color: '#ccc', textAlign: 'center', fontStyle: 'italic', marginTop: '10px' }}>Vazio</div>
                                    )}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                       </div>
                    </div>
                  )}
                </div>
              </div>
            ) : roomsSubTab === 'blocks' ? (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {/* Form to Create Block */}
                <div style={{ background: 'white', padding: '32px', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '24px', letterSpacing: '-0.02em', color: 'black' }}>
                    Nova Inativação
                  </h2>
                  <form onSubmit={handleCreateBlock} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 200px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Sala</label>
                        <select className="input-field" value={blockForm.room_id} onChange={e => setBlockForm({ ...blockForm, room_id: e.target.value })} required>
                          <option value="">Selecione a Sala</option>
                          {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </div>
                      <div style={{ flex: '1 1 200px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Data</label>
                        <input type="date" className="input-field" value={blockForm.date} onChange={e => setBlockForm({ ...blockForm, date: e.target.value })} required />
                      </div>
                      <div style={{ flex: '1 1 150px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Hora Inicial</label>
                        <input type="time" className="input-field" value={blockForm.start_time} onChange={e => setBlockForm({ ...blockForm, start_time: e.target.value })} required />
                      </div>
                      <div style={{ flex: '1 1 150px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Hora Final</label>
                        <input type="time" className="input-field" value={blockForm.end_time} onChange={e => setBlockForm({ ...blockForm, end_time: e.target.value })} required />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Motivo (Opcional)</label>
                      <input type="text" className="input-field" placeholder="Ex: Manutenção do Ar Condicionado" value={blockForm.reason} onChange={e => setBlockForm({ ...blockForm, reason: e.target.value })} />
                    </div>
                    <button type="submit" style={{ alignSelf: 'flex-start', background: 'red', color: 'white', padding: '16px 32px', borderRadius: '16px', border: 'none', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
                      Inativar Sala Neste Período
                    </button>
                  </form>
                </div>

                {/* List of Active Blocks */}
                <div style={{ background: 'white', padding: '32px', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '24px', letterSpacing: '-0.02em', color: 'black' }}>
                    Salas Inativas 
                  </h2>
                  {roomBlocks.length === 0 ? (
                    <div style={{ color: 'rgba(0,0,0,0.4)', fontSize: '14px', fontWeight: 500 }}>Nenhuma sala inativada no momento.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {roomBlocks.map(block => (
                        <div key={block.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', padding: '20px', borderRadius: '16px', border: '1px solid #eee', flexWrap: 'wrap', gap: '12px' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '16px', color: 'black', marginBottom: '4px' }}>{block.room_name}</div>
                            <div style={{ fontSize: '13px', color: 'rgba(0,0,0,0.6)', fontWeight: 500 }}>
                              Data: {new Date(block.date.split('T')[0] + 'T12:00:00-03:00').toLocaleDateString('pt-BR')} | Horário: {block.start_time.substring(0, 5)} - {block.end_time.substring(0, 5)}
                            </div>
                            {block.reason && <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.4)', marginTop: '4px' }}>Motivo: {block.reason}</div>}
                          </div>
                          <button onClick={() => handleDeleteBlock(block.id)} style={{ background: 'white', border: '1px solid var(--border)', padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', color: 'black', fontWeight: 700, fontSize: '12px' }}>
                            Reativar Sala
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
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
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Tickets (Turnos 5H)</label>
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
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 'max-content' }}>
                  <thead>
                    <tr style={{ background: '#fafafa', borderBottom: '1px solid var(--border)' }}>
                      <th rowSpan={2} style={{ padding: '16px 24px', fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', borderRight: '1px solid #eee' }}>Usuário</th>
                      {rooms.map(room => (
                        <th key={room.id} colSpan={2} style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'black', textTransform: 'uppercase', textAlign: 'center', borderRight: '1px solid #eee', background: 'rgba(0,0,0,0.02)' }}>
                          {room.name}
                        </th>
                      ))}
                      <th colSpan={2} style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'black', textTransform: 'uppercase', textAlign: 'center', background: 'rgba(0,0,0,0.05)' }}>
                        TOTAIS GERAIS
                      </th>
                    </tr>
                    <tr style={{ background: '#f5f5f5', borderBottom: '1px solid var(--border)' }}>
                      {rooms.map(room => (
                        <React.Fragment key={`${room.id}-sub`}>
                          <th style={{ padding: '8px 12px', fontSize: '10px', fontWeight: 700, color: 'rgba(0,0,0,0.3)', textAlign: 'center' }}>HORAS</th>
                          <th style={{ padding: '8px 12px', fontSize: '10px', fontWeight: 700, color: 'rgba(0,0,0,0.3)', textAlign: 'center', borderRight: '1px solid #eee' }}>TURNOS</th>
                        </React.Fragment>
                      ))}
                      <th style={{ padding: '8px 12px', fontSize: '10px', fontWeight: 700, color: '#34c759', textAlign: 'center' }}>H. TOTAL</th>
                      <th style={{ padding: '8px 12px', fontSize: '10px', fontWeight: 700, color: '#007aff', textAlign: 'center' }}>T. TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pivotedBalances.map((u) => (
                      <tr key={u.email} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                        <td style={{ padding: '16px 24px', borderRight: '1px solid #eee' }}>
                          <div style={{ fontWeight: 600, fontSize: '14px' }}>{u.name}</div>
                          <div style={{ fontSize: '11px', color: 'rgba(0,0,0,0.4)' }}>{u.email}</div>
                        </td>
                        {rooms.map(room => (
                          <React.Fragment key={`${u.email}-${room.id || room.name}`}>
                            <td style={{ padding: '12px', textAlign: 'center', fontWeight: 600, fontSize: isAdminMobile ? '10px' : '13px', color: (u.rooms[room.name]?.hourly > 0) ? '#34c759' : '#ccc' }}>
                              {u.rooms[room.name]?.hourly || 0}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center', fontWeight: 600, fontSize: isAdminMobile ? '10px' : '13px', color: (u.rooms[room.name]?.shift > 0) ? '#007aff' : '#ccc', borderRight: '1px solid #eee' }}>
                              {u.rooms[room.name]?.shift || 0}
                            </td>
                          </React.Fragment>
                        ))}
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 800, fontSize: isAdminMobile ? '10px' : '14px', background: 'rgba(52, 199, 89, 0.05)', color: '#1a8a3d' }}>
                          {u.totalHourly}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 800, fontSize: isAdminMobile ? '10px' : '14px', background: 'rgba(0, 122, 255, 0.05)', color: '#005bb7' }}>
                          {u.totalShift}
                        </td>
                      </tr>
                    ))}
                    {pivotedBalances.length === 0 && (
                      <tr>
                        <td colSpan={3 + rooms.length * 2} style={{ padding: '60px', textAlign: 'center', color: 'rgba(0,0,0,0.3)', fontWeight: 500 }}>
                          Nenhum saldo encontrado.
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
                      placeholder="Ex: Consultório 3"
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
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Capacidade</label>
                      <input 
                        type="number" 
                        min="1"
                        className="input-field" 
                        value={roomForm.capacity} 
                        onChange={(e) => setRoomForm({...roomForm, capacity: parseInt(e.target.value) || 1})} 
                        required 
                        style={{ background: 'white', border: '1px solid var(--border)' }}
                      />
                    </div>
                  </div>

                  {/* FOTOS */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(0,0,0,0.03)', padding: '16px', borderRadius: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '8px' }}>Fotos do Consultório</div>
                    
                    {['photo1', 'photo2', 'photo3'].map((field, i) => (
                      <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'white', padding: '12px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600 }}>Foto {i + 1}</span>
                          <label style={{ 
                            fontSize: '11px', fontWeight: 700, color: '#007aff', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '4px' 
                          }}>
                            <span style={{ fontSize: '14px' }}>📁</span> 
                            {isUploading === (i + 1) ? 'Carregando...' : 'Carregar Local'}
                            <input 
                              type="file" 
                              accept="image/*" 
                              style={{ display: 'none' }} 
                              onChange={(e) => handlePhotoUpload(e, field as any)} 
                              disabled={isUploading !== null}
                            />
                          </label>
                        </div>
                        <input
                          className="input-field"
                          value={(roomForm as any)[field]}
                          onChange={e => setRoomForm({ ...roomForm, [field]: e.target.value })}
                          placeholder="Link da foto ou carregue um arquivo"
                          style={{ fontSize: '12px', padding: '8px 12px' }}
                        />
                      </div>
                    ))}
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
                      <input type="date" className="input-field" value={manualBookingForm.date} onChange={e => { if (e.target.value) setManualBookingForm({...manualBookingForm, date: e.target.value}); }} required min={new Date().toISOString().split('T')[0]} />
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
                    <div style={{ background: 'var(--secondary)', padding: '24px', borderRadius: '24px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '12px', display: 'block' }}>Horário (Disponibilidade Real)</label>
                      {isFetchingManualAvailability ? (
                        <div style={{ fontSize: '14px', color: 'rgba(0,0,0,0.5)', padding: '20px', textAlign: 'center' }}>Buscando slots da agenda...</div>
                      ) : (
                        manualBookingForm.type === 'hourly' ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', maxHeight: '200px', overflowY: 'auto', padding: '2px' }}>
                            {[
                              '07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30',
                              '11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30',
                              '15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30',
                              '19:00','19:30','20:00','20:30','21:00','21:30','22:00'
                            ].map(h => {
                              const isAvailable = manualAvailableSlots.some(s => s.start === h);
                              const isSelected = manualBookingForm.start_time === h && isAvailable;
                              return (
                                <button
                                  key={h}
                                  type="button"
                                  onClick={() => setManualBookingForm({...manualBookingForm, start_time: h})}
                                  style={{
                                    padding: '8px 4px',
                                    borderRadius: '10px',
                                    border: isSelected ? '2px solid black' : `1px solid ${isAvailable ? 'rgba(22,163,74,0.3)' : 'rgba(239,68,68,0.2)'}`,
                                    background: isSelected ? 'black' : isAvailable ? 'rgba(22,163,74,0.06)' : 'rgba(239,68,68,0.04)',
                                    color: isSelected ? 'white' : isAvailable ? '#16a34a' : '#dc2626',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    transition: 'all 0.15s',
                                    lineHeight: 1.3
                                  }}
                                >
                                  {h}{!isAvailable && <><br/><span style={{ fontSize: '9px' }}>Indisponível</span></>}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            {[
                              { label: '07:00 - 12:00', value: '07:00-12:00' },
                              { label: '08:00 - 13:00', value: '08:00-13:00' },
                              { label: '13:00 - 18:00', value: '13:00-18:00' },
                              { label: '14:00 - 19:00', value: '14:00-19:00' },
                              { label: '15:00 - 20:00', value: '15:00-20:00' },
                              { label: '18:00 - 23:00', value: '18:00-23:00' },
                            ].map(opt => {
                              // Reuso da lógica de disponibilidade de turno
                              const [sHour, eHour] = opt.value.split('-').map(t => parseInt(t.split(':')[0]));
                              let isAvailable = true;
                              for(let hr = sHour; hr < eHour; hr++) {
                                if (!manualAvailableSlots.some(s => s.start === `${String(hr).padStart(2,'0')}:00`)) {
                                  isAvailable = false;
                                  break;
                                }
                              }
                              const isSelected = manualBookingForm.shift === opt.value && isAvailable;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setManualBookingForm({...manualBookingForm, shift: opt.value})}
                                  style={{
                                    padding: '12px 8px',
                                    borderRadius: '12px',
                                    border: isSelected ? '2px solid black' : `1px solid ${isAvailable ? 'rgba(22,163,74,0.3)' : 'rgba(239,68,68,0.2)'}`,
                                    background: isSelected ? 'black' : isAvailable ? 'rgba(22,163,74,0.06)' : 'rgba(239,68,68,0.04)',
                                    color: isSelected ? 'white' : isAvailable ? '#16a34a' : '#dc2626',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    transition: 'all 0.15s',
                                    lineHeight: 1.3
                                  }}
                                >
                                  {opt.label}{!isAvailable && <><br/><span style={{ fontSize: '10px' }}>Indisponível</span></>}
                                </button>
                              );
                            })}
                          </div>
                        )
                      )}
                      
                      <div style={{ display: 'flex', gap: '12px', marginTop: '16px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} /> Disponível (Livre)
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} /> Indisponível (Ocupado)
                        </div>
                      </div>
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

        {/* Day Details Modal */}
        <AnimatePresence>
          {selectedDayReservations && (
            <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', zIndex: 1000 }} onClick={() => setSelectedDayReservations(null)}>
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="modal-content" 
                style={{ width: '90%', maxWidth: '400px', padding: '32px', borderRadius: '32px' }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <div>
                    <h2 style={{ fontSize: '24px', fontWeight: 700 }}>Agendamentos</h2>
                    <p style={{ color: 'rgba(0,0,0,0.4)', fontWeight: 600 }}>{selectedDayLabel}</p>
                  </div>
                  <button onClick={() => setSelectedDayReservations(null)} style={{ background: 'var(--secondary)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>×</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '450px', overflowY: 'auto', paddingRight: '4px' }}>
                  {selectedDayReservations.map(res => {
                    const rangeMatch = res.booking_period.replace(/[\"\[\)]/g, '').split(',');
                    const startStr = rangeMatch[0];
                    const endStr = rangeMatch[1];
                    const start = getSafeDate(startStr);
                    const end = getSafeDate(endStr);
                    
                    return (
                      <div key={res.id} style={{ padding: '16px', background: 'var(--secondary)', borderRadius: '16px', borderLeft: `4px solid ${res.status === 'confirmed' ? '#34c759' : '#ff9500'}` }}>
                        <div style={{ fontWeight: 700, fontSize: '15px' }}>{res.user_name}</div>
                        <div style={{ fontSize: '13px', color: 'rgba(0,0,0,0.5)', marginBottom: '8px' }}>{res.room_name}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, background: 'rgba(0,0,0,0.05)', padding: '4px 8px', borderRadius: '6px' }}>
                            {start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: res.status === 'confirmed' ? '#248a3d' : '#e67e00' }}>
                            {res.status === 'confirmed' ? 'Confirmado' : 'Pendente'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <button onClick={() => setSelectedDayReservations(null)} className="primary-btn" style={{ width: '100%', marginTop: '24px', padding: '16px' }}>
                  Fechar
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Reservation Detail Modal */}
        <AnimatePresence>
          {selectedReservation && (() => {
            const res = selectedReservation;
            const rangeMatch = res.booking_period.replace(/[\"\[\)]/g, '').split(',');
            const start = getSafeDate(rangeMatch[0]);
            const end = getSafeDate(rangeMatch[1]);
            const isConfirmed = res.status === 'confirmed';
            const isPending = res.status === 'pending';
            const statusLabel = isConfirmed ? 'Confirmado' : isPending ? 'Aguardando pagamento' : 'Cancelado';
            const statusColor = isConfirmed ? '#34c759' : isPending ? '#ff9500' : '#ff3b30';
            const statusBg = isConfirmed ? 'rgba(52,199,89,0.10)' : isPending ? 'rgba(255,149,0,0.10)' : 'rgba(255,59,48,0.10)';
            return (
              <div
                onClick={() => setSelectedReservation(null)}
                style={{
                  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', zIndex: 1000, padding: '20px'
                }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    background: 'white', borderRadius: '28px', padding: '32px',
                    width: '100%', maxWidth: '440px',
                    boxShadow: '0 32px 80px rgba(0,0,0,0.18)'
                  }}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase', marginBottom: '6px' }}>Detalhes da Reserva</div>
                      <div style={{ fontSize: '22px', fontWeight: 800, color: 'black', lineHeight: 1.2 }}>{res.user_name}</div>
                      <div style={{ fontSize: '13px', color: 'rgba(0,0,0,0.45)', marginTop: '4px' }}>{res.user_email}</div>
                    </div>
                    <button
                      onClick={() => setSelectedReservation(null)}
                      style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        border: 'none', background: 'rgba(0,0,0,0.06)',
                        cursor: 'pointer', fontSize: '16px', fontWeight: 700,
                        color: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', flexShrink: 0
                      }}
                    >✕</button>
                  </div>

                  {/* Info Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ flex: 1, background: 'var(--secondary)', borderRadius: '16px', padding: '16px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase', marginBottom: '6px' }}>Sala</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'black' }}>{res.room_name}</div>
                      </div>
                      <div style={{ flex: 1, background: 'var(--secondary)', borderRadius: '16px', padding: '16px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase', marginBottom: '6px' }}>Valor</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'black' }}>R$ {Number(res.total_price).toFixed(2)}</div>
                      </div>
                    </div>
                    <div style={{ background: 'var(--secondary)', borderRadius: '16px', padding: '16px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase', marginBottom: '6px' }}>Período</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'black' }}>
                        {start.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </div>
                      <div style={{ fontSize: '13px', color: 'rgba(0,0,0,0.5)', marginTop: '4px' }}>
                        {start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} → {end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div style={{ background: statusBg, borderRadius: '16px', padding: '16px', border: `1px solid ${statusColor}22` }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase', marginBottom: '6px' }}>Status</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor }} />
                        <div style={{ fontSize: '14px', fontWeight: 700, color: statusColor }}>{statusLabel}</div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {isConfirmed && (
                      <button
                        onClick={() => { handleCancel(res.id); setSelectedReservation(null); }}
                        style={{
                          flex: 1, padding: '14px', borderRadius: '14px',
                          border: '1px solid #ff3b30', background: 'transparent',
                          color: '#ff3b30', fontWeight: 700, fontSize: '14px', cursor: 'pointer'
                        }}
                      >
                        Cancelar Reserva
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedReservation(null)}
                      className="primary-btn"
                      style={{ flex: 1, padding: '14px', borderRadius: '14px', fontSize: '14px' }}
                    >
                      Fechar
                    </button>
                  </div>
                </motion.div>
              </div>
            );
          })()}
        </AnimatePresence>

      </main>
    </>
  );
}
