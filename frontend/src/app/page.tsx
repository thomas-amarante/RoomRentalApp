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
              // Procurar o primeiro slot que seja > hora atual
              const foundValid = data.find((s: { start: string, end: string }) => parseInt(s.start.split(':')[0]) > currentHour);
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
    return isLocked
      ? availableSlots.map(s => s.start)
      : [
        '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
        '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
        '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
        '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'
      ];
  }, [isLocked, availableSlots]);

  const currentShiftOptions = useMemo(() => {
    return isLocked
      ? availableSlots.map(s => ({ label: `${s.start} - ${s.end} (Libertado)`, value: `${s.start}-${s.end}` }))
      : [
        { label: '07:00 - 12:00', value: '07:00-12:00' },
        { label: '08:00 - 13:00', value: '08:00-13:00' },
        { label: '13:00 - 18:00', value: '13:00-18:00' },
        { label: '14:00 - 19:00', value: '14:00-19:00' },
        { label: '15:00 - 20:00', value: '15:00-20:00' },
        { label: '18:00 - 23:00', value: '18:00-23:00' },
      ];
  }, [isLocked, availableSlots]);

  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('08:00');
  const [shift, setShift] = useState('07:00-12:00');

  // Ajusta automaticamente a hora inicial quando a data ou tipo de sala muda
  useEffect(() => {
    if (!selectedRoom || isLocked) return; // Se for isLocked, o fetch da API já resolve

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

  // Garante que o endTime seja calculado corretamente para salas bloqueadas vs padrão
  useEffect(() => {
    if (bookingType === 'hourly' && startTime) {
      if (isLocked) {
        const slot = availableSlots.find(s => s.start === startTime);
        if (slot) setEndTime(slot.end);
      } else {
        const [hours, minutes] = startTime.split(':').map(Number);
        setEndTime(`${String(hours + 1).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
      }
    }
  }, [startTime, bookingType, isLocked, availableSlots]);

  const handleBooking = async () => {
    if (!selectedRoom || !user) return;

    // Validação Frontend extra no botão "Confirmar"
    if (date === today) {
      const currentHour = new Date().getHours();
      if (bookingType === 'hourly') {
        const selectedHour = parseInt(startTime.split(':')[0]);
        if (selectedHour <= currentHour) {
          alert('Não é possível agendar um horário que já passou ou está em andamento na hora atual.');
          return;
        }
      } else {
        const selectedStartHour = parseInt(shift.split('-')[0].split(':')[0]);
        if (selectedStartHour <= currentHour) {
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
            const roomTicket = user?.tickets?.find((t: any) => t.room_id === selectedRoom.id);
            const hasZeroBalance = !roomTicket || (roomTicket.shift_tickets === 0 && roomTicket.hourly_tickets === 0);

            return (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => !isBooking && (setSelectedRoom(null), setBookingSuccess(false))}>
                <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="modal-content" onClick={(e) => e.stopPropagation()}>
                  {hasZeroBalance ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', position: 'relative' }}>
                      <ZeroBalanceRedirect />
                      <div style={{ fontSize: '48px', marginBottom: '24px' }}>💳</div>
                      <h2 style={{ fontSize: '28px', marginBottom: '12px', fontWeight: 700, letterSpacing: '-0.02em' }}>Saldo R$ 0.00</h2>
                      <p style={{ fontSize: '16px', color: 'rgba(0,0,0,0.6)', marginBottom: '32px', lineHeight: 1.5 }}>
                        Você precisa adicionar saldo na sua conta para agendar a <strong>{selectedRoom.name}</strong>.<br /><br />
                        Estamos te redirecionando para a loja...
                      </p>
                      <button className="primary-btn" style={{ width: '100%', padding: '16px', fontSize: '16px' }} onClick={() => router.push('/account')}>
                        Comprar Saldos Agora
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

                      <div className="input-group" style={{ marginBottom: '20px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Data</label>
                        <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} min={today} />
                      </div>

                      {bookingType === 'hourly' ? (
                        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Horário de Início</label>
                            <select className="input-field" value={startTime} onChange={(e) => setStartTime(e.target.value)}>
                              {currentHourlyOptions.map((hour) => {
                                const isPastTime = date === today && parseInt(hour.split(':')[0]) <= new Date().getHours();
                                return <option key={hour} value={hour} disabled={isPastTime}>{hour}</option>;
                              })}
                              {currentHourlyOptions.length === 0 && <option value="" disabled>Nenhum horário disponível hoje</option>}
                            </select>
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Fim</label>
                            <input type="time" className="input-field" value={endTime} readOnly />
                          </div>
                        </div>
                      ) : (
                        <div className="input-group" style={{ marginBottom: '20px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Turno</label>
                          <select className="input-field" value={shift} onChange={(e) => setShift(e.target.value)}>
                            {currentShiftOptions.map((opt) => {
                              // Nova Regra: O usuário não pode agendar um turno que já começou (startHour <= atual).
                              const startHour = parseInt(opt.value.split('-')[0].split(':')[0]);
                              const isPastTime = date === today && startHour <= new Date().getHours();
                              return <option key={opt.value} value={opt.value} disabled={isPastTime}>{opt.label}</option>;
                            })}
                            {currentShiftOptions.length === 0 && <option value="" disabled>Nenhum turno disponível hoje</option>}
                          </select>
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
