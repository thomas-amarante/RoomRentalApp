'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';

interface Reservation {
  id: string;
  room_name: string;
  room_description: string;
  booking_period: string;
  status: string;
  total_price: number;
  created_at: string;
}

export default function Reservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null);
  const [nowUTC, setNowUTC] = useState(new Date());
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
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/payments/create-preference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          reservation_id: reservation.id,
          title: `Reserva: ${reservation.room_name}`,
          unit_price: reservation.total_price,
          quantity: 1
        })
      });

      const data = await response.json();
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        alert('Erro ao iniciar pagamento. Tente novamente.');
      }
    } catch (error) {
      console.error(error);
      alert('Erro de conexão com o servidor de pagamentos.');
    } finally {
      setPaymentLoading(null);
    }
  };

  return (
    <>
      <header>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--foreground)', fontWeight: 600, letterSpacing: '0.1em' }}>· L I V · ODONTOLOGIA</Link>

        <div className="desktop-nav">
          <Link href="/" style={{ textDecoration: 'none', color: 'rgba(0,0,0,0.4)' }}>Salas</Link>
          <Link href="/reservations" style={{ textDecoration: 'none', color: 'var(--foreground)' }}>Reservas</Link>
          {user?.is_admin && <Link href="/admin" style={{ textDecoration: 'none', color: 'var(--accent)', fontWeight: 600 }}>Admin</Link>}
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
              {user?.is_admin && <Link href="/admin" onClick={() => setIsMenuOpen(false)}>Admin</Link>}
              <button onClick={() => { localStorage.removeItem('roomrental_user'); router.push('/login'); }} >Sair</button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="main-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <section style={{ marginBottom: '60px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '48px', fontWeight: 700, letterSpacing: '-0.04em', marginBottom: '12px', color: 'black' }}>
            Cartões de Acesso.
          </h1>
          <p style={{ fontSize: '20px', color: 'rgba(0,0,0,0.5)' }}>
            Seus agendamentos clínicos em formato digital.
          </p>
        </section>

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
            {reservations.map((res) => (
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
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
