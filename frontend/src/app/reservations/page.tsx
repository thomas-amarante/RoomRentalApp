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
}

export default function Reservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('roomrental_user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
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
                width: '100%'
              }}>
                {/* Cabeçalho do Ticket */}
                <div style={{ padding: '24px', borderBottom: '1px dashed var(--border)', position: 'relative' }}>
                  <div style={{
                    fontSize: '11px',
                    color: res.status === 'confirmed' ? 'var(--accent)' : '#ff3b30',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    marginBottom: '8px',
                    letterSpacing: '0.05em'
                  }}>
                    {res.status === 'confirmed' ? '✓ AGENDAMENTO VÁLIDO' : '● EXPIRADO/CANCELADO'}
                  </div>
                  <h3 style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    color: res.status === 'confirmed' ? 'black' : 'rgba(0,0,0,0.3)',
                    marginBottom: '4px',
                    textDecoration: res.status === 'confirmed' ? 'none' : 'line-through'
                  }}>
                    {res.room_name}
                  </h3>
                  <div style={{
                    color: res.status === 'confirmed' ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)',
                    fontSize: '13px',
                    fontWeight: 500,
                    textDecoration: res.status === 'confirmed' ? 'none' : 'line-through'
                  }} className="mono">
                    {(() => {
                      try {
                        // Exemplo de formato vindo do banco (Postgres TSRANGE): "[\"2026-03-03 09:00:00\",\"2026-03-03 10:00:00\")"
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
                  <div>
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
                    <QRCodeSVG
                      value={`${process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')}/lookup/${res.id}`}
                      size={80}
                      level="M"
                      includeMargin={false}
                    />
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
