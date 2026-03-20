'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/Header';
import { QRCodeSVG } from 'qrcode.react';

interface Reservation {
  id: string;
  room_id: string;
  room_name: string;
  room_description: string;
  booking_period: string;
  status: string;
  total_price: number;
  created_at: string;
}

function getSafeDate(dateString: string) {
  if (!dateString) return new Date();
  return new Date(dateString.endsWith('Z') ? dateString.slice(0, -1) + '-03:00' : dateString + '-03:00');
}

export default function Reservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null);
  const [nowUTC, setNowUTC] = useState(new Date());

  // Filters
  const [filterMonth, setFilterMonth] = useState<number | ''>('');
  const [filterYear, setFilterYear] = useState<number | ''>('');
  const [filterValidated, setFilterValidated] = useState(false);
  const [filterCancelled, setFilterCancelled] = useState(false);

  // PIX Modal States
  const [pixData, setPixData] = useState<{qr_code: string, qr_code_base64: string, payment_id: number} | null>(null);
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reschedule Modal States
  const [rescheduleReservation, setRescheduleReservation] = useState<Reservation | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleStartTime, setRescheduleStartTime] = useState('07:00');
  const [rescheduleEndTime, setRescheduleEndTime] = useState('08:00');
  const [rescheduleShift, setRescheduleShift] = useState('07:00-12:00');
  const [rescheduleType, setRescheduleType] = useState<'hourly' | 'shift'>('hourly');
  const [rescheduleSlots, setRescheduleSlots] = useState<{start: string, end: string}[]>([]);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleSuccess, setRescheduleSuccess] = useState(false);

  const router = useRouter();

  // Atualiza o relógio a cada 1 segundo para o countdown preciso
  useEffect(() => {
    const timer = setInterval(() => setNowUTC(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('roomrental_user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      if (!userData.is_phone_verified && !userData.is_admin) {
        router.push('/verify');
        return;
      }
      setUser(userData);
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reservations/${userData.id}`, {
        headers: {
          'Authorization': `Bearer ${userData.token || ''}`
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

  const handlePayment = async (reservation: Reservation) => {
    setPaymentLoading(reservation.id);
    setPixData(null);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/payments/create-pix`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          reservation_id: reservation.id,
          title: `Reserva: ${reservation.room_name}`,
          unit_price: reservation.total_price
        })
      });

      const data = await response.json();
      if (data.qr_code) {
        setPixData(data);
        setIsPixModalOpen(true);
      } else {
        alert('Erro ao iniciar pagamento. Verifique com a administração.');
      }
    } catch (error) {
      console.error(error);
      alert('Erro de conexão com o servidor de pagamentos.');
    } finally {
      setPaymentLoading(null);
    }
  };

  const copyToClipboard = () => {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Buscar disponibilidade quando sala/data do reagendamento muda
  useEffect(() => {
    if (!rescheduleReservation || !rescheduleDate) return;
    const roomId = (rescheduleReservation as any).room_id || '';
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/availability?roomId=${roomId}&date=${rescheduleDate}`)
      .then(r => r.json())
      .then(slots => {
        setRescheduleSlots(slots || []);
        if (slots && slots.length > 0) {
          setRescheduleStartTime(slots[0].start);
          setRescheduleEndTime(slots[0].end);
          setRescheduleShift(`${slots[0].start}-${slots[slots.length > 5 ? 5 : slots.length - 1].start}`);
        }
      })
      .catch(() => {});
  }, [rescheduleReservation, rescheduleDate]);

  const handleReschedule = async () => {
    if (!rescheduleReservation || !user) return;
    setRescheduling(true);
    try {
      let start: string, end: string;
      if (rescheduleType === 'hourly') {
        const [h, m] = rescheduleStartTime.split(':').map(Number);
        start = `${rescheduleDate} ${rescheduleStartTime}:00`;
        end = `${rescheduleDate} ${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
      } else {
        const [s, e] = rescheduleShift.split('-');
        start = `${rescheduleDate} ${s}:00`;
        end = `${rescheduleDate} ${e}:00`;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reservations/${rescheduleReservation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token || ''}` },
        body: JSON.stringify({ start_time: start, end_time: end })
      });

      const data = await res.json();
      if (res.ok) {
        setRescheduleSuccess(true);
        // Refresh reservation list
        const freshRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reservations/${user.id}`, {
          headers: { 'Authorization': `Bearer ${user.token || ''}` }
        });
        if (freshRes.ok) setReservations(await freshRes.json());
        setTimeout(() => { setRescheduleReservation(null); setRescheduleSuccess(false); }, 2000);
      } else {
        alert(data.error || 'Erro ao reagendar.');
      }
    } catch (e) {
      alert('Erro de conexão.');
    } finally {
      setRescheduling(false);
    }
  };

  return (
    <>
      <Header />

      <main className="main-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <section style={{ marginBottom: '60px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '48px', fontWeight: 700, letterSpacing: '-0.04em', marginBottom: '12px', color: 'black' }}>
            Cartões de Acesso.
          </h1>
          <p style={{ fontSize: '20px', color: 'rgba(0,0,0,0.5)' }}>
            Seus agendamentos clínicos em formato digital.
          </p>
        </section>

        {/* Filter Bar */}
        {!loading && reservations.length > 0 && (() => {
          const years = [...new Set(reservations.map(r => {
            try { return new Date(r.booking_period.replace(/["[)]/g, '').split(',')[0]).getFullYear(); } catch { return null; }
          }).filter(Boolean))] as number[];

          const months = [...new Set(reservations.map(r => {
            try { return new Date(r.booking_period.replace(/["[)]/g, '').split(',')[0]).getMonth(); } catch { return null; }
          }).filter(v => v !== null))] as number[];

          const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
          const hasFilters = filterMonth !== '' || filterYear !== '' || filterValidated || filterCancelled;

          return (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '40px', alignItems: 'center' }}>
              {/* Mês */}
              <select
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value === '' ? '' : Number(e.target.value))}
                style={{ padding: '8px 14px', borderRadius: '20px', border: '1px solid rgba(0,0,0,0.12)', background: filterMonth !== '' ? 'black' : 'white', color: filterMonth !== '' ? 'white' : 'black', fontSize: '13px', fontWeight: 600, cursor: 'pointer', outline: 'none' }}
              >
                <option value="">Mês</option>
                {months.sort((a,b) => a-b).map(m => <option key={m} value={m}>{monthNames[m]}</option>)}
              </select>

              {/* Ano */}
              <select
                value={filterYear}
                onChange={e => setFilterYear(e.target.value === '' ? '' : Number(e.target.value))}
                style={{ padding: '8px 14px', borderRadius: '20px', border: '1px solid rgba(0,0,0,0.12)', background: filterYear !== '' ? 'black' : 'white', color: filterYear !== '' ? 'white' : 'black', fontSize: '13px', fontWeight: 600, cursor: 'pointer', outline: 'none' }}
              >
                <option value="">Ano</option>
                {years.sort((a,b) => b-a).map(y => <option key={y} value={y}>{y}</option>)}
              </select>

              {/* Validados */}
              <button
                onClick={() => { setFilterValidated(!filterValidated); if (!filterValidated) setFilterCancelled(false); }}
                style={{ padding: '8px 16px', borderRadius: '20px', border: '1px solid rgba(0,0,0,0.12)', background: filterValidated ? '#16a34a' : 'white', color: filterValidated ? 'white' : 'black', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
              >
                ✓ Validados
              </button>

              {/* Cancelados */}
              <button
                onClick={() => { setFilterCancelled(!filterCancelled); if (!filterCancelled) setFilterValidated(false); }}
                style={{ padding: '8px 16px', borderRadius: '20px', border: '1px solid rgba(0,0,0,0.12)', background: filterCancelled ? '#ff3b30' : 'white', color: filterCancelled ? 'white' : 'rgba(0,0,0,0.7)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
              >
                ✕ Cancelados
              </button>

              {/* Limpar */}
              {hasFilters && (
                <button
                  onClick={() => { setFilterMonth(''); setFilterYear(''); setFilterValidated(false); setFilterCancelled(false); }}
                  style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', background: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.5)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Limpar filtros
                </button>
              )}
            </div>
          );
        })()}

        {loading ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px', width: '100%', maxWidth: '1200px' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: '180px', width: '350px', borderRadius: '24px' }} />
            ))}
          </div>
        ) : reservations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '100px', border: '1px dashed var(--border)', borderRadius: '24px', width: '100%', maxWidth: '600px' }}>
            <p style={{ color: 'rgba(0,0,0,0.4)' }}>Nenhum agendamento ativo.</p>
            <Link href="/" style={{ display: 'inline-block', marginTop: '20px', color: 'var(--accent)', textDecoration: 'none' }}>Ver salas disponíveis →</Link>
          </div>
        ) : (
          <div className="grid-3-col">
            {(() => {
              const now = Date.now();

              const getStartMs = (r: Reservation) => {
                try {
                  const clean = r.booking_period.replace(/["[)]/g, '');
                  const start = clean.split(',')[0];
                  return new Date(start).getTime();
                } catch { return 0; }
              };

              const getEndMs = (r: Reservation) => {
                try {
                  const clean = r.booking_period.replace(/["[)]/g, '');
                  const end = clean.split(',')[1];
                  return new Date(end).getTime();
                } catch { return 0; }
              };

              // Apply filters
              const filtered = reservations.filter(r => {
                const startMs = getStartMs(r);
                const startDate = new Date(startMs);
                if (filterMonth !== '' && startDate.getMonth() !== filterMonth) return false;
                if (filterYear !== '' && startDate.getFullYear() !== filterYear) return false;
                if (filterValidated && r.status !== 'confirmed') return false;
                if (filterCancelled && r.status !== 'cancelled') return false;
                return true;
              });

              // Grupo 1: em andamento / vindouros (não cancelados, horário de fim no futuro)
              const upcoming = filtered
                .filter(r => r.status !== 'cancelled' && getEndMs(r) > now)
                .sort((a, b) => getStartMs(a) - getStartMs(b));

              // Grupo 2: passados não cancelados
              const past = filtered
                .filter(r => r.status !== 'cancelled' && getEndMs(r) <= now)
                .sort((a, b) => getStartMs(b) - getStartMs(a));

              // Grupo 3: cancelados (ao final)
              const cancelled = filtered
                .filter(r => r.status === 'cancelled')
                .sort((a, b) => getStartMs(b) - getStartMs(a));

              const renderCard = (res: Reservation) => (
                <div key={res.id} style={{
                  background: 'white',
                  border: '1px solid var(--border)',
                  borderRadius: '24px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.3s ease',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  width: '100%',
                  opacity: res.status === 'confirmed' ? 1 : 0.8
                }}>
                  {/* Cabeçalho do Ticket */}
                  <div style={{ padding: '24px', borderBottom: '1px dashed var(--border)', position: 'relative' }}>
                    <div style={{
                      fontSize: '11px',
                      color: res.status === 'confirmed' ? 'var(--accent)' : (res.status === 'pending' ? '#ff9500' : '#ff3b30'),
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      marginBottom: '8px',
                      letterSpacing: '0.05em'
                    }}>
                      {(() => {
                        if (res.status === 'confirmed') return '✓ AGENDAMENTO VÁLIDO';
                        if (res.status === 'pending') {
                          const created = new Date(res.created_at);
                          const diffMs = nowUTC.getTime() - created.getTime();
                          const diffSecs = Math.floor(diffMs / 1000);
                          const remainingSecs = (20 * 60) - diffSecs;

                          if (remainingSecs <= 0) return '● RESERVA CANCELADA (TEMPO ESGOTADO)';

                          const mins = Math.floor(remainingSecs / 60);
                          const secs = remainingSecs % 60;
                          return `⌛ PAGAR EM ${mins}:${secs < 10 ? '0' : ''}${secs}`;
                        }
                        return '● AGENDAMENTO CANCELADO';
                      })()}
                    </div>
                    <h3 style={{
                      fontSize: '22px',
                      fontWeight: 700,
                      color: res.status !== 'cancelled' ? 'black' : 'rgba(0,0,0,0.3)',
                      marginBottom: '4px',
                      textDecoration: res.status !== 'cancelled' ? 'none' : 'line-through'
                    }}>
                      {res.room_name}
                    </h3>
                    <div style={{
                      color: res.status !== 'cancelled' ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)',
                      fontSize: '13px',
                      fontWeight: 500,
                      textDecoration: res.status !== 'cancelled' ? 'none' : 'line-through'
                    }} className="mono">
                      {(() => {
                        try {
                          const cleanStr = res.booking_period.replace(/["[)]/g, '');
                          const [start, end] = cleanStr.split(',');
                          if (!start || !end) return cleanStr;

                          const startDate = new Date(start);
                          const endDate = new Date(end);

                          const dateStr = startDate.toLocaleDateString('pt-BR');
                          const startTime = startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                          const endTime = endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                          return `${dateStr} - ${startTime} às ${endTime}`;
                        } catch (e) {
                          return res.booking_period.replace(/["[)]/g, '').replace(',', ' até ');
                        }
                      })()}
                    </div>

                    {/* Círculos das laterais (Estilo Ticket) */}
                    <div style={{ position: 'absolute', bottom: '-10px', left: '-10px', width: '20px', height: '20px', background: 'var(--background)', borderRadius: '50%', border: '1px solid var(--border)' }}></div>
                    <div style={{ position: 'absolute', bottom: '-10px', right: '-10px', width: '20px', height: '20px', background: 'var(--background)', borderRadius: '50%', border: '1px solid var(--border)' }}></div>
                  </div>

                  {/* Corpo do Ticket com QR Code */}
                  <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '10px', color: 'rgba(0,0,0,0.3)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Identificador</div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'black' }} className="mono">
                        {res.id.split('-')[0].toUpperCase()}
                      </div>

                      <div style={{ marginTop: '20px' }}>
                        <div style={{ fontSize: '10px', color: 'rgba(0,0,0,0.3)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Valor</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: 'black' }}>R${res.total_price}</div>
                      </div>
                    </div>

                    <div style={{
                      padding: '12px',
                      background: 'white',
                      border: '1px solid #eee',
                      borderRadius: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {res.status === 'confirmed' ? (
                        <QRCodeSVG
                          value={`${process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')}/lookup/${res.id}`}
                          size={80}
                          level="M"
                          includeMargin={false}
                        />
                      ) : (res.status === 'pending' && (20 * 60 - Math.floor((nowUTC.getTime() - new Date(res.created_at).getTime()) / 1000)) > 0) ? (
                        <button
                          onClick={() => handlePayment(res)}
                          disabled={paymentLoading === res.id}
                          style={{
                            background: 'black',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            padding: '12px 16px',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'opacity 0.2s',
                            opacity: paymentLoading === res.id ? 0.7 : 1
                          }}
                        >
                          {paymentLoading === res.id ? 'Carregando...' : 'Pagar Agora'}
                        </button>
                      ) : (
                        <span style={{ fontSize: '32px', filter: 'grayscale(1)' }}>🔒</span>
                      )}
                    </div>
                  </div>

                  {/* Botão Trocar Horário — apenas em reservas confirmadas futuras com antecedência > 24h */}
                  {res.status === 'confirmed' && getEndMs(res) > now && (
                    <div style={{ padding: '0 24px 20px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '16px' }}>
                      {getStartMs(res) - now > 24 * 60 * 60 * 1000 ? (
                        <button
                          onClick={() => {
                            const getLocalDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
                            setRescheduleReservation({ ...res, room_id: (res as any).room_id } as any);
                            setRescheduleDate(getLocalDate());
                            setRescheduleType('hourly');
                            setRescheduleSuccess(false);
                          }}
                          style={{ width: '100%', background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px', padding: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'black', transition: 'background 0.2s' }}
                          onMouseOver={e => e.currentTarget.style.background = 'rgba(0,0,0,0.08)'}
                          onMouseOut={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
                        >
                          🗓 Trocar Horário
                        </button>
                      ) : (
                        <div style={{ 
                          width: '100%', 
                          background: 'rgba(0,0,0,0.02)', 
                          border: '1px dashed rgba(0,0,0,0.1)', 
                          borderRadius: '12px', 
                          padding: '10px', 
                          fontSize: '11px', 
                          fontWeight: 500, 
                          color: 'rgba(0,0,0,0.4)',
                          textAlign: 'center'
                        }}>
                          Alteração bloqueada (limite de 24h)
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );

              return (
                <>
                  {/* Grupo 1: Em andamento / Próximos */}
                  {upcoming.length > 0 && (
                    <>
                      <div style={{ gridColumn: '1 / -1', fontSize: '12px', fontWeight: 700, color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', paddingBottom: '8px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        🟢 Próximos Agendamentos
                      </div>
                      {upcoming.map(renderCard)}
                    </>
                  )}

                  {/* Grupo 2: Passados */}
                  {past.length > 0 && (
                    <>
                      <div style={{ gridColumn: '1 / -1', fontSize: '12px', fontWeight: 700, color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', paddingBottom: '8px', borderBottom: '1px solid rgba(0,0,0,0.06)', marginTop: upcoming.length > 0 ? '24px' : '0' }}>
                        Histórico
                      </div>
                      {past.map(renderCard)}
                    </>
                  )}

                  {/* Grupo 3: Cancelados */}
                  {cancelled.length > 0 && (
                    <>
                      <div style={{ gridColumn: '1 / -1', fontSize: '12px', fontWeight: 700, color: 'rgba(0,0,0,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', paddingBottom: '8px', borderBottom: '1px solid rgba(0,0,0,0.06)', marginTop: '24px' }}>
                        Cancelados
                      </div>
                      {cancelled.map(renderCard)}
                    </>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </main>

      <AnimatePresence>
        {isPixModalOpen && pixData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.8)',
              backdropFilter: 'blur(10px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              style={{
                background: 'white',
                borderRadius: '32px',
                padding: '40px',
                width: '100%',
                maxWidth: '450px',
                textAlign: 'center',
                boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
                position: 'relative'
              }}
            >
              <button 
                onClick={() => setIsPixModalOpen(false)}
                style={{
                  position: 'absolute', top: '24px', right: '24px',
                  background: 'rgba(0,0,0,0.05)', border: 'none',
                  width: '32px', height: '32px', borderRadius: '50%',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 'bold', color: 'black'
                }}
              >✕</button>
              
              <div style={{ width: '64px', height: '64px', background: 'rgba(52, 199, 89, 0.1)', color: '#34c759', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '28px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="currentColor" fillOpacity="0.2"/>
                  <path d="M16 8L10 16L7 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.02em' }}>Pague via PIX</h2>
              <p style={{ color: 'rgba(0,0,0,0.5)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
                Escaneie o QR Code abaixo no app do seu banco ou copie o código. A aprovação é imediata.
              </p>

              <div style={{ 
                background: 'white', padding: '16px', borderRadius: '24px', 
                border: '2px dashed var(--border)', display: 'inline-block', marginBottom: '24px' 
              }}>
                <img src={`data:image/jpeg;base64,${pixData.qr_code_base64}`} alt="PIX QR Code" style={{ width: '200px', height: '200px' }} />
              </div>

              <div style={{ textAlign: 'left', marginBottom: '8px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)' }}>
                Ou copie o código (Copia e Cola):
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  value={pixData.qr_code} 
                  readOnly 
                  style={{ 
                    flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', 
                    background: 'rgba(0,0,0,0.02)', outline: 'none', fontSize: '13px', color: 'rgba(0,0,0,0.6)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }} 
                />
                <button 
                  onClick={copyToClipboard}
                  style={{ 
                    background: copied ? '#34c759' : 'black', color: 'white', border: 'none', 
                    borderRadius: '12px', padding: '0 20px', fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.2s' 
                  }}
                >
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reschedule Modal */}
      <AnimatePresence>
        {rescheduleReservation && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
            onClick={() => !rescheduling && setRescheduleReservation(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              style={{ background: 'white', borderRadius: '32px', padding: '40px', width: '100%', maxWidth: '480px', position: 'relative' }}
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setRescheduleReservation(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(0,0,0,0.05)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>

              {rescheduleSuccess ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div style={{ fontSize: '64px', marginBottom: '16px', color: '#34c759' }}>✓</div>
                  <h2 style={{ fontSize: '24px', fontWeight: 700 }}>Reagendado!</h2>
                </div>
              ) : (
                <>
                  <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Trocar Horário</h2>
                  <p style={{ fontSize: '14px', color: 'rgba(0,0,0,0.5)', marginBottom: '24px' }}>{rescheduleReservation.room_name}</p>

                  {/* Tipo */}
                  <div style={{ display: 'flex', background: 'rgba(0,0,0,0.04)', borderRadius: '12px', padding: '4px', marginBottom: '20px', gap: '4px' }}>
                    {(['hourly', 'shift'] as const).map(t => (
                      <button key={t} onClick={() => setRescheduleType(t)} style={{ flex: 1, padding: '8px', borderRadius: '10px', border: 'none', background: rescheduleType === t ? 'white' : 'transparent', fontWeight: 600, fontSize: '13px', cursor: 'pointer', boxShadow: rescheduleType === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}>
                        {t === 'hourly' ? 'HORA AVULSA' : 'TURNO (5H)'}
                      </button>
                    ))}
                  </div>

                  {/* Data */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Nova Data</label>
                    <input type="date" value={rescheduleDate} onChange={e => { if (e.target.value) setRescheduleDate(e.target.value); }} min={new Date().toISOString().split('T')[0]} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.12)', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>

                  {/* Horário */}
                  {rescheduleType === 'hourly' ? (
                    <div style={{ marginBottom: '24px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Horário</label>
                      {(() => {
                        const ALL_SLOTS = [
                          '07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30',
                          '11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30',
                          '15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30',
                          '19:00','19:30','20:00','20:30','21:00','21:30','22:00'
                        ];
                        const todayLocal = new Date().toISOString().split('T')[0];
                        const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
                        return (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', maxHeight: '200px', overflowY: 'auto', padding: '2px' }}>
                            {ALL_SLOTS.map(h => {
                              const [hr, mn] = h.split(':').map(Number);
                              const slotMinutes = hr * 60 + mn;
                              const isPast = rescheduleDate === todayLocal && slotMinutes <= nowMinutes;
                              const isAvailable = rescheduleSlots.some(s => s.start === h) && !isPast;
                              const isSelected = rescheduleStartTime === h && isAvailable;
                              return (
                                <button
                                  key={h}
                                  disabled={!isAvailable}
                                  onClick={() => setRescheduleStartTime(h)}
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
                                    lineHeight: 1.3
                                  }}
                                >
                                  {h}{!isAvailable && <><br/><span style={{ fontSize: '9px' }}>Indisponível</span></>}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div style={{ marginBottom: '24px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Turno</label>
                      {(() => {
                        const ALL_SHIFTS = [
                          {l:'07:00 - 12:00',v:'07:00-12:00'},{l:'08:00 - 13:00',v:'08:00-13:00'},{l:'13:00 - 18:00',v:'13:00-18:00'},
                          {l:'14:00 - 19:00',v:'14:00-19:00'},{l:'15:00 - 20:00',v:'15:00-20:00'},{l:'18:00 - 23:00',v:'18:00-23:00'}
                        ];
                        const todayLocal = new Date().toISOString().split('T')[0];
                        const currentHour = new Date().getHours();
                        return (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxHeight: '200px', overflowY: 'auto', padding: '2px' }}>
                            {ALL_SHIFTS.map(opt => {
                              const startHour = parseInt(opt.v.split('-')[0].split(':')[0]);
                              const isPast = rescheduleDate === todayLocal && startHour <= currentHour;
                              // Para reagendamento, precisamos verificar se o turno está disponível na lista de slots
                              // Um turno está disponível se todos os slots de 1h de seu intervalo estão em rescheduleSlots
                              const [sHour, eHour] = opt.v.split('-').map(t => parseInt(t.split(':')[0]));
                              let isAvailable = !isPast;
                              if (isAvailable) {
                                for(let hr = sHour; hr < eHour; hr++) {
                                  if (!rescheduleSlots.some(s => s.start === `${String(hr).padStart(2,'0')}:00`)) {
                                    isAvailable = false;
                                    break;
                                  }
                                }
                              }
                              const isSelected = rescheduleShift === opt.v && isAvailable;
                              return (
                                <button
                                  key={opt.v}
                                  disabled={!isAvailable}
                                  onClick={() => setRescheduleShift(opt.v)}
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
                                  {opt.l}{!isAvailable && <><br/><span style={{ fontSize: '10px' }}>Indisponível</span></>}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} /> Disponível
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} /> Indisponível
                    </div>
                  </div>

                  <button
                    onClick={handleReschedule}
                    disabled={rescheduling || !rescheduleDate}
                    style={{ width: '100%', padding: '16px', background: rescheduling ? 'rgba(0,0,0,0.3)' : 'black', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 700, fontSize: '15px', cursor: rescheduling ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
                  >
                    {rescheduling ? 'Reagendando...' : 'Confirmar novo horário'}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
