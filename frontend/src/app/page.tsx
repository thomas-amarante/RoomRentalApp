'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/Header';

interface Room {
  id: string;
  name: string;
  description: string;
  hourly_rate: number;
  shift_rate: number;
  capacity: number;
  next_availability: string | null;
}

function formatNextAvailability(dateString: string | null) {
  if (!dateString) return 'Consultar disponibilidade';

  // O DB retorna um Timestamp Sem Timezone (ex: "2026-03-25T07:00:00.000Z")
  // Precisamos garantir que o JS leia isso considerando que FOI gerado no horário de Brasília (-03:00)
  // Caso contrário, o browser diminui 3 horas achando que a string é UTC.
  const isZULU = dateString.endsWith('Z');
  const safeDateStr = isZULU ? dateString.slice(0, -1) + '-03:00' : dateString + '-03:00';

  const date = new Date(safeDateStr);
  const now = new Date();

  const isToday = date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const isTomorrow = new Date(now.setDate(now.getDate() + 1)).getDate() === date.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const timeString = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return `Hoje às ${timeString}h`;
  } else if (isTomorrow) {
    return `Amanhã às ${timeString}h`;
  } else {
    // Ex: "Segunda, 14/08 às 09:00"
    const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' });
    const dayMonth = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    // Capitalize first letter of weekday
    const capWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1).replace('.', '');
    return `${capWeekday}, ${dayMonth} às ${timeString}h`;
  }
}

export default function Home() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [bookingType, setBookingType] = useState<'hourly' | 'shift'>('hourly');
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

  // Componente Auxiliar para Redirecionamento com Cleanup Seguro
  const ZeroBalanceRedirect = () => {
    useEffect(() => {
      const t = setTimeout(() => router.push('/account'), 4500);
      return () => clearTimeout(t);
    }, []);
    return null;
  };

  // --- Lógica de Data/Hora ---
  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const today = getLocalDateString();
  const [date, setDate] = useState(today);

  const [availableSlots, setAvailableSlots] = useState<{ start: string, end: string }[]>([]);
  const [isFetchingAvailability, setIsFetchingAvailability] = useState(false);

  useEffect(() => {
    if (selectedRoom) {
      setIsFetchingAvailability(true);
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/availability?roomId=${selectedRoom.id}&date=${date}`)
        .then(res => res.json())
        .then(data => {
          setAvailableSlots(data);
          if (data.length > 0) {
            const currentHour = new Date().getHours();
            let firstValidSlot = data[0];

            if (date === today) {
              // Procurar o primeiro slot cujo início ainda não passou
              const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
              const foundValid = data.find((s: { start: string, end: string }) => {
                const [h, m] = s.start.split(':').map(Number);
                return (h * 60 + m) > nowMinutes;
              });
              if (foundValid) firstValidSlot = foundValid;
            }

            setStartTime(firstValidSlot.start);
            setEndTime(firstValidSlot.end);
            setShift(`${firstValidSlot.start}-${firstValidSlot.end}`);
          } else {
            setStartTime(''); setEndTime(''); setShift('');
          }
        })
        .finally(() => setIsFetchingAvailability(false));
    }
  }, [selectedRoom, date, today]);

  const isLocked = selectedRoom && (selectedRoom as any).locked_by_default;

  const currentHourlyOptions = useMemo(() => {
    // Agora tanto salas normais quanto bloqueadas (Carina) retornam o mesmo formato da API:
    // Uma lista de horários de início de 1h disponíveis.
    if (availableSlots.length > 0) {
      return availableSlots.map(s => s.start);
    }
    // Fallback estático caso demore o carregamento ou para salas padrão recém-abertas
    return [
      '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
      '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
      '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
      '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'
    ];
  }, [availableSlots]);

  const currentShiftOptions = useMemo(() => {
    const ALL_SHIFTS = [
      { label: '07:00 - 12:00', value: '07:00-12:00' },
      { label: '08:00 - 13:00', value: '08:00-13:00' },
      { label: '13:00 - 18:00', value: '13:00-18:00' },
      { label: '14:00 - 19:00', value: '14:00-19:00' },
      { label: '15:00 - 20:00', value: '15:00-20:00' },
      { label: '18:00 - 23:00', value: '18:00-23:00' },
    ];

    // Para turnos, mostramos apenas se TODOS os blocos de hora cheia do turno estiverem livres
    return ALL_SHIFTS.filter(opt => {
      const [start, end] = opt.value.split('-');
      const startH = parseInt(start.split(':')[0]);
      const endH = parseInt(end.split(':')[0]);
      
      for (let h = startH; h < endH; h++) {
        const checkTime = `${String(h).padStart(2, '0')}:00`;
        // Se faltar um bloco de hora cheia no meio do turno, ele não está disponível
        if (!availableSlots.some(s => s.start === checkTime)) return false;
      }
      return true;
    });
  }, [availableSlots]);

  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('08:00');
  const [shift, setShift] = useState('07:00-12:00');

  // Ajusta automaticamente a hora inicial quando a data ou tipo de sala muda
  useEffect(() => {
    if (!selectedRoom) return;

    const currentHour = new Date().getHours();

    if (date === today) {
      if (bookingType === 'hourly') {
        const firstValidHour = currentHourlyOptions.find(hour => parseInt(hour.split(':')[0]) > currentHour);
        if (firstValidHour) setStartTime(firstValidHour);
      } else {
        const firstValidShift = currentShiftOptions.find(opt => parseInt(opt.value.split('-')[0].split(':')[0]) > currentHour);
        if (firstValidShift) setShift(firstValidShift.value);
      }
    } else {
      setStartTime(currentHourlyOptions[0] || '07:00');
      setShift(currentShiftOptions[0]?.value || '07:00-12:00');
    }
  }, [date, today, bookingType, currentHourlyOptions, currentShiftOptions, selectedRoom, isLocked]);

  useEffect(() => {
    const storedUser = localStorage.getItem('roomrental_user');
    if (!storedUser) {
      router.push('/login');
    } else {
      const userData = JSON.parse(storedUser);
      if (!userData.is_phone_verified && !userData.is_admin) {
        router.push('/verify');
        return;
      }
      // Set baseline user first
      setUser(userData);

      // Fetch fresh user data (including tickets)
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/me`, {
        headers: { 'Authorization': `Bearer ${userData.token || ''}` }
      })
        .then(res => res.ok ? res.json() : null)
        .then(freshData => {
          if (freshData) setUser({ ...freshData, token: userData.token });
        })
        .catch(console.error);

      // Fetch rooms
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/rooms`)
        .then(res => res.json())
        .then(data => setRooms(data))
        .catch(() => setLoading(false))
        .finally(() => setLoading(false));
    }
  }, [router]);

  // Garante que o endTime seja calculado corretamente
  useEffect(() => {
    if (bookingType === 'hourly' && startTime) {
      // Independentemente de ser bloqueada ou não, um agendamento 'hourly' deve setar o fim exato para 1 hora.
      const [hours, minutes] = startTime.split(':').map(Number);
      setEndTime(`${String(hours + 1).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
    }
  }, [startTime, bookingType]);

  const handleBooking = async () => {
    if (!selectedRoom || !user) return;

    // Validação Frontend extra no botão "Confirmar"
    if (date === today) {
      const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
      if (bookingType === 'hourly') {
        const [sh, sm] = startTime.split(':').map(Number);
        if ((sh * 60 + sm) <= nowMinutes) {
          alert('Não é possível agendar um horário que já passou ou está em andamento na hora atual.');
          return;
        }
      } else {
        const shiftStart = shift.split('-')[0];
        const [sh, sm] = shiftStart.split(':').map(Number);
        if ((sh * 60 + sm) <= nowMinutes) {
          alert('Não é possível agendar um turno que já começou ou já passou na hora atual.');
          return;
        }
      }
    }

    setIsBooking(true);

    let start: string, end: string;

    if (bookingType === 'hourly') {
      start = `${date} ${startTime}:00`;
      end = `${date} ${endTime}:00`;
    } else {
      const [startShift, endShift] = shift.split('-');
      start = `${date} ${startShift}:00`;
      end = `${date} ${endShift}:00`;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reservations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token || ''}`
        },
        body: JSON.stringify({
          room_id: selectedRoom.id,
          user_id: user.id,
          start_time: start,
          end_time: end,
          total_price: bookingType === 'hourly' ? selectedRoom.hourly_rate : selectedRoom.shift_rate
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.paidWithTickets) {
          alert('Horário Marcado! Como você possui pacotes, não foi gerado cobrança. 1 ingresso foi deduzido da sua conta.');
        }
        setBookingSuccess(true);
        setTimeout(() => {
          router.push('/reservations');
        }, 2000);
      } else {
        const data = await response.json();
        alert(data.error || 'Erro ao agendar');
      }
    } catch (err) {
      alert('Erro de conexão');
    } finally {
      setIsBooking(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <Header />
      <main className="main-container">
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '80px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '56px', fontWeight: 700, marginBottom: '16px', color: 'black' }}>Olá, {user.name.split(' ')[0]}.</h1>
          <p style={{ fontSize: '24px', color: 'rgba(0,0,0,0.5)', maxWidth: '700px', margin: '0 auto' }}>Selecione uma das salas disponíveis para o seu agendamento. Escolha por horários ou turnos de 5 horas.</p>
        </motion.section>

        {loading ? (
          <div className="rooms-grid">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton skeleton-card" />)}
          </div>
        ) : (
          <div className="rooms-grid">
            {rooms.map((room, index) => (
              <motion.div key={room.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="room-card" onClick={() => setSelectedRoom(room)}>
                <h3 className="room-card-title">{room.name}</h3>
                <div className="price-tag">
                  A partir de <strong>R${room.hourly_rate}</strong>/hora
                </div>
                <p className="room-card-description">{room.description}</p>
                <div className="room-card-footer">
                  <div className="room-card-availability">
                    <span className="room-card-availability-label">Próxima disponibilidade</span>
                    <span className="room-card-availability-value">
                      {formatNextAvailability(room.next_availability)}
                    </span>
                  </div>
                  <button className="primary-btn">Agendar</button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <AnimatePresence>
          {selectedRoom && (() => {
            // Room IDs da hierarquia
            const CARINA_ID  = '0b5d4bf5-b66b-43bf-9575-0ca9925251f4';
            const CONSUL1_ID = 'c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96';
            const CONSUL2_ID = 'd93d2b37-3720-4298-b70b-aaf8a94acee0';
            const eligibleSources: Record<string, string[]> = {
              [CARINA_ID]:  [CARINA_ID],
              [CONSUL1_ID]: [CONSUL1_ID, CARINA_ID],
              [CONSUL2_ID]: [CONSUL2_ID, CONSUL1_ID, CARINA_ID],
            };
            const eligible = eligibleSources[selectedRoom.id] || [selectedRoom.id];
            const eligibleTickets = (user?.tickets || []).filter((t: any) =>
              eligible.includes(t.room_id) && (
                bookingType === 'shift'
                  ? t.shift_tickets > 0
                  : t.hourly_tickets > 0
              )
            );
            const hasZeroBalance = eligibleTickets.length === 0;

            return (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => !isBooking && (setSelectedRoom(null), setBookingSuccess(false))}>
                <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="modal-content" onClick={(e) => e.stopPropagation()}>
                  {hasZeroBalance ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', position: 'relative' }}>
                      <ZeroBalanceRedirect />
                      <div style={{ fontSize: '48px', marginBottom: '24px' }}>💳</div>
                      <h2 style={{ fontSize: '28px', marginBottom: '12px', fontWeight: 700, letterSpacing: '-0.02em' }}>
                        {bookingType === 'shift' ? 'Sem turnos disponíveis' : 'Sem horas avulsas disponíveis'}
                      </h2>
                      <p style={{ fontSize: '16px', color: 'rgba(0,0,0,0.6)', marginBottom: '32px', lineHeight: 1.5 }}>
                        {bookingType === 'shift'
                          ? <>Você não possui <strong>turnos</strong> para agendar na <strong>{selectedRoom.name}</strong>. Adquira um pacote de turnos.</>
                          : <>Você não possui <strong>horas avulsas</strong> para agendar na <strong>{selectedRoom.name}</strong>. Adquira um pacote de horas.</>
                        }<br /><br />
                        Estamos te redirecionando para a loja...
                      </p>
                      <button className="primary-btn" style={{ width: '100%', padding: '16px', fontSize: '16px' }} onClick={() => router.push('/account')}>
                        Comprar Pacotes
                      </button>
                    </div>
                  ) : bookingSuccess ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      <div style={{ fontSize: '64px', marginBottom: '20px', color: '#34c759' }}>✓</div>
                      <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>Agendado com sucesso!</h2>
                      <p style={{ color: 'rgba(0,0,0,0.4)' }}>Redirecionando para suas reservas...</p>
                    </div>
                  ) : (
                    <>
                      <h2 style={{ fontSize: '28px', marginBottom: '12px', fontWeight: 600 }}>Agendar {selectedRoom.name}</h2>
                      <div className="type-selector">
                        <button className={`type-btn ${bookingType === 'hourly' ? 'active' : ''}`} onClick={() => setBookingType('hourly')}>HORA AVULSA</button>
                        <button className={`type-btn ${bookingType === 'shift' ? 'active' : ''}`} onClick={() => setBookingType('shift')}>TURNO (5H)</button>
                      </div>

                      {/* Saldo disponível para o tipo selecionado */}
                      {(() => {
                        const allEligible = eligibleSources[selectedRoom.id] || [selectedRoom.id];
                        const totalBalance = (user?.tickets || [])
                          .filter((t: any) => allEligible.includes(t.room_id))
                          .reduce((sum: number, t: any) =>
                            sum + (bookingType === 'shift' ? t.shift_tickets : t.hourly_tickets), 0);
                        if (totalBalance <= 0) return null;
                        return (
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            background: 'rgba(22,163,74,0.08)', color: '#16a34a',
                            border: '1px solid rgba(22,163,74,0.2)',
                            borderRadius: '20px', padding: '6px 14px',
                            fontSize: '13px', fontWeight: 600, marginBottom: '20px'
                          }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
                            {bookingType === 'shift'
                              ? `Saldo: ${totalBalance} turno${totalBalance !== 1 ? 's' : ''}`
                              : `Saldo: ${totalBalance} hora${totalBalance !== 1 ? 's' : ''} avulsa${totalBalance !== 1 ? 's' : ''}`
                            }
                          </div>
                        );
                      })()}

                      <div className="input-group" style={{ marginBottom: '20px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Data</label>
                        <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} min={today} />
                      </div>

                      {bookingType === 'hourly' ? (
                        <div style={{ marginBottom: '20px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '10px', display: 'block' }}>Horário de Início</label>
                          {isFetchingAvailability ? (
                            <div style={{ padding: '16px', textAlign: 'center', color: 'rgba(0,0,0,0.3)', fontSize: '13px' }}>Carregando horários...</div>
                          ) : (() => {
                            const ALL_SLOTS = [
                              '07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30',
                              '11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30',
                              '15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30',
                              '19:00','19:30','20:00','20:30','21:00','21:30','22:00'
                            ];
                            const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
                            return (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', maxHeight: '220px', overflowY: 'auto', padding: '2px', borderRadius: '12px' }}>
                                {ALL_SLOTS.map(hour => {
                                  const [h, m] = hour.split(':').map(Number);
                                  const slotMinutes = h * 60 + m;
                                  const isPast = date === today && slotMinutes <= nowMinutes;
                                  const isAvailable = availableSlots.some(s => s.start === hour) && !isPast;
                                  const isSelected = startTime === hour && isAvailable;
                                  return (
                                    <button
                                      key={hour}
                                      disabled={!isAvailable}
                                      onClick={() => setStartTime(hour)}
                                      style={{
                                        padding: '8px 4px',
                                        borderRadius: '10px',
                                        border: isSelected ? '2px solid black' : `1px solid ${isAvailable ? 'rgba(22,163,74,0.3)' : 'rgba(239,68,68,0.2)'}`,
                                        background: isSelected ? 'black' : isAvailable ? 'rgba(22,163,74,0.06)' : 'rgba(239,68,68,0.04)',
                                        color: isSelected ? 'white' : isAvailable ? '#16a34a' : '#dc2626',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor: isAvailable ? 'pointer' : 'not-allowed',
                                        textAlign: 'center',
                                        transition: 'all 0.15s',
                                        lineHeight: 1.3,
                                        opacity: isPast ? 0.4 : 1,
                                      }}
                                    >
                                      {hour}{!isAvailable && <><br/><span style={{ fontSize: '9px', fontWeight: 500 }}>Indisponível</span></>}
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })()}
                          <div style={{ display: 'flex', gap: '12px', marginTop: '10px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} /> Disponível
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} /> Indisponível
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginBottom: '20px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '10px', display: 'block' }}>Turno</label>
                          {(() => {
                            const ALL_SHIFTS = [
                              { label: '07:00 - 12:00', value: '07:00-12:00' },
                              { label: '08:00 - 13:00', value: '08:00-13:00' },
                              { label: '13:00 - 18:00', value: '13:00-18:00' },
                              { label: '14:00 - 19:00', value: '14:00-19:00' },
                              { label: '15:00 - 20:00', value: '15:00-20:00' },
                              { label: '18:00 - 23:00', value: '18:00-23:00' },
                            ];
                            const currentHour = new Date().getHours();
                            return (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxHeight: '200px', overflowY: 'auto', padding: '2px' }}>
                                {ALL_SHIFTS.map(opt => {
                                  const startHour = parseInt(opt.value.split('-')[0].split(':')[0]);
                                  const isPast = date === today && startHour <= currentHour;
                                  const isAvailable = currentShiftOptions.some(s => s.value === opt.value) && !isPast;
                                  const isSelected = shift === opt.value && isAvailable;
                                  return (
                                    <button
                                      key={opt.value}
                                      disabled={!isAvailable}
                                      onClick={() => setShift(opt.value)}
                                      style={{
                                        padding: '12px 8px',
                                        borderRadius: '12px',
                                        border: isSelected ? '2px solid black' : `1px solid ${isAvailable ? 'rgba(22,163,74,0.3)' : 'rgba(239,68,68,0.2)'}`,
                                        background: isSelected ? 'black' : isAvailable ? 'rgba(22,163,74,0.06)' : 'rgba(239,68,68,0.04)',
                                        color: isSelected ? 'white' : isAvailable ? '#16a34a' : '#dc2626',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: isAvailable ? 'pointer' : 'not-allowed',
                                        textAlign: 'center',
                                        transition: 'all 0.15s',
                                        lineHeight: 1.3
                                      }}
                                    >
                                      {opt.label}{!isAvailable && <><br/><span style={{ fontSize: '10px', fontWeight: 500 }}>Indisponível</span></>}
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })()}
                          <div style={{ display: 'flex', gap: '12px', marginTop: '12px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} /> Disponível
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} /> Indisponível
                            </div>
                          </div>
                        </div>
                      )}

                      <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: 'rgba(0,0,0,0.3)', textTransform: 'uppercase', fontWeight: 600 }}>Total</div>
                          <div style={{ fontSize: '24px', fontWeight: 700 }}>R${bookingType === 'hourly' ? selectedRoom.hourly_rate : selectedRoom.shift_rate}</div>
                        </div>
                        <button className="primary-btn" style={{ padding: '14px 40px', fontSize: '15px' }} onClick={handleBooking} disabled={isBooking}>
                          {isBooking ? 'Agendando...' : 'Confirmar'}
                        </button>
                      </div>
                    </>
                  )}
                  <button onClick={() => { setSelectedRoom(null); setBookingSuccess(false); }} style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', opacity: 0.2 }}>✕</button>
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </main>
    </>
  );
}
