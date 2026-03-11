'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/Header';
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
  
  // PIX Modal States
  const [pixData, setPixData] = useState<{qr_code: string, qr_code_base64: string, payment_id: number} | null>(null);
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
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
    </>
  );
}
