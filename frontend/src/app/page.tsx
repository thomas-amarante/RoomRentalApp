'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

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

  const date = new Date(dateString);
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

  const hourlyOptions = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
  const shiftOptions = [
    { label: '08:00 - 12:00', value: '08:00-12:00' },
    { label: '13:00 - 17:00', value: '13:00-17:00' },
    { label: '14:00 - 18:00', value: '14:00-18:00' },
    { label: '15:00 - 19:00', value: '15:00-19:00' },
  ];

  const [startTime, setStartTime] = useState(hourlyOptions[0]);
  const [endTime, setEndTime] = useState('10:00');
  const [shift, setShift] = useState(shiftOptions[0].value);

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
      setUser(userData);
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/rooms`)
        .then(res => res.json())
        .then(data => setRooms(data))
        .catch(() => setLoading(false))
        .finally(() => setLoading(false));
    }
  }, [router]);

  // Garante que o endTime seja sempre 1 hora depois do startTime
  useEffect(() => {
    if (bookingType === 'hourly' && startTime) {
      const [hours] = startTime.split(':').map(Number);
      setEndTime(`${String(hours + 1).padStart(2, '0')}:00`);
    }
  }, [startTime, bookingType]);

  const handleBooking = async () => {
    if (!selectedRoom || !user) return;
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
        setBookingSuccess(true);
        setTimeout(() => {
          router.push('/reservations');
        }, 1500);
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
      <header>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--foreground)', fontWeight: 600, letterSpacing: '0.1em' }}>· L I V · ODONTOLOGIA</Link>

        {/* Desktop Menu */}
        <div className="desktop-nav">
          <Link href="/" style={{ textDecoration: 'none', color: 'var(--foreground)' }}>Salas</Link>
          <Link href="/reservations" style={{ textDecoration: 'none', color: 'rgba(0,0,0,0.4)' }}>Reservas</Link>
          {user.is_admin && <Link href="/admin" style={{ textDecoration: 'none', color: 'var(--accent)', fontWeight: 600 }}>Admin</Link>}
          <button onClick={() => { localStorage.removeItem('roomrental_user'); router.push('/login'); }} style={{ background: 'transparent', border: 'none', color: 'rgba(0,0,0,0.3)', cursor: 'pointer', fontSize: '13px' }}>Sair</button>
        </div>

        {/* Mobile Menu Button */}
        <button className="menu-button" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          <span className="bar"></span>
          <span className="bar"></span>
          <span className="bar"></span>
        </button>
      </header>

      {/* Mobile Menu Overlay */}
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
              {user.is_admin && <Link href="/admin" onClick={() => setIsMenuOpen(false)}>Admin</Link>}
              <button onClick={() => { localStorage.removeItem('roomrental_user'); router.push('/login'); }} >Sair</button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
      <main className="main-container">
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '80px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '56px', fontWeight: 700, marginBottom: '16px', color: 'black' }}>Olá, {user.name.split(' ')[0]}.</h1>
          <p style={{ fontSize: '24px', color: 'rgba(0,0,0,0.5)', maxWidth: '700px', margin: '0 auto' }}>Selecione uma das salas disponíveis para o seu agendamento. Escolha por horários ou turnos de 4 horas.</p>
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
          {selectedRoom && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => !isBooking && (setSelectedRoom(null), setBookingSuccess(false))}>
              <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="modal-content" onClick={(e) => e.stopPropagation()}>
                {bookingSuccess ? (
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
                      <button className={`type-btn ${bookingType === 'shift' ? 'active' : ''}`} onClick={() => setBookingType('shift')}>TURNO (4H)</button>
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
                            {hourlyOptions.map((hour) => {
                              const isPastTime = date === today && parseInt(hour.split(':')[0]) < new Date().getHours() + 1;
                              return <option key={hour} value={hour} disabled={isPastTime}>{hour}</option>;
                            })}
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
                          {shiftOptions.map((opt) => {
                            const endHour = parseInt(opt.value.split('-')[1].split(':')[0]);
                            const isPastTime = date === today && endHour < new Date().getHours();
                            return <option key={opt.value} value={opt.value} disabled={isPastTime}>{opt.label}</option>;
                          })}
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
          )}
        </AnimatePresence>
      </main>
    </>
  );
}
