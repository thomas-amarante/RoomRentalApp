'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';

export default function AccountPage() {
  const [user, setUser] = useState<any>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [packages, setPackages] = useState<Record<string, any[]>>({});
  const [activeRoom, setActiveRoom] = useState('');
  const [loadingPix, setLoadingPix] = useState(false);
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_base64: string; payment_id: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const [tickets, setTickets] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const savedUser = localStorage.getItem('roomrental_user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        
        try {
          const [resRooms, resPacks, resMe] = await Promise.all([
            fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/rooms`),
            fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/packages`),
            fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/users/me`, {
              headers: { 'Authorization': `Bearer ${parsedUser.token || ''}` }
            }),
          ]);
          
          if (resRooms.ok && resPacks.ok) {
            const roomsData = await resRooms.json();
            const packsData = await resPacks.json();
            
            setRooms(roomsData);
            if (roomsData.length > 0) setActiveRoom(roomsData[0].id);
            
            const grouped: Record<string, any[]> = {};
            packsData.forEach((p: any) => {
              if (!grouped[p.room_id]) grouped[p.room_id] = [];
              grouped[p.room_id].push({
                title: p.title,
                type: p.type,
                qty: p.qty,
                price: Number(p.price),
                desc: p.description
              });
            });
            setPackages(grouped);
          }

          if (resMe.ok) {
            const meData = await resMe.json();
            setTickets(meData.tickets || []);
          }
        } catch (err) {
          console.error('Erro ao buscar salas/pacotes', err);
        }
      } else {
        router.push('/login');
      }
    };
    fetchData();
  }, [router]);

  const handleBuy = async (pkg: any) => {
    setLoadingPix(true);
    setPixData(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/payments/packages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token || ''}`
        },
        body: JSON.stringify({
          title: pkg.title,
          unit_price: pkg.price,
          room_id: activeRoom,
          shift_tickets: pkg.type === 'shift' ? pkg.qty : 0,
          hourly_tickets: pkg.type === 'hourly' ? pkg.qty : 0
        })
      });

      if (res.ok) {
        const data = await res.json();
        setPixData(data);
      } else {
        alert('Erro ao gerar código de pagamento PIX para sua conta.');
      }
    } catch (err) {
      alert('Erro de Conexão com financeiro');
    } finally {
      setLoadingPix(false);
    }
  };

  const copyToClipboard = () => {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!user) return null;

  return (
    <>
      <Header />
      <main className="main-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', paddingBottom: '100px' }}>
        <section style={{ marginBottom: '60px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '48px', fontWeight: 700, letterSpacing: '-0.04em', marginBottom: '12px', color: 'black' }}>
            Meus Pacotes.
          </h1>
          <p style={{ fontSize: '20px', color: 'rgba(0,0,0,0.5)' }}>
            Compre pacotes de horas e turnos para o seu consultório de preferência.
          </p>
        </section>

        {/* Inventário de Tickets */}
        {tickets.filter(t => t.hourly_tickets > 0 || t.shift_tickets > 0).length > 0 && (
          <div style={{ width: '100%', maxWidth: '1000px', marginBottom: '40px', background: 'rgba(0,0,0,0.02)', borderRadius: '20px', padding: '28px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>Seu Inventário</div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {tickets.filter(t => t.hourly_tickets > 0 || t.shift_tickets > 0).map((t: any) => (
                <div key={t.room_id} style={{ background: 'white', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '16px', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', marginBottom: '4px' }}>{t.room_name}</div>
                  {isMobile ? (
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
                      Saldo disponível
                    </div>
                  ) : (
                    <>
                      {t.hourly_tickets > 0 && <div style={{ fontSize: '15px', fontWeight: 600 }}>🕐 {t.hourly_tickets} hora{t.hourly_tickets !== 1 ? 's' : ''} avulsa{t.hourly_tickets !== 1 ? 's' : ''}</div>}
                      {t.shift_tickets > 0 && <div style={{ fontSize: '15px', fontWeight: 600 }}>📅 {t.shift_tickets} turno{t.shift_tickets !== 1 ? 's' : ''}</div>}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Room Tab Selectors */}
        <div style={{ display: 'flex', gap: '16px', background: 'rgba(0,0,0,0.03)', padding: '6px', borderRadius: '16px', marginBottom: '40px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {rooms.map(room => (
            <button
              key={room.id}
              onClick={() => { setActiveRoom(room.id); setPixData(null); }}
              style={{
                padding: '12px 24px',
                borderRadius: '12px',
                border: 'none',
                background: activeRoom === room.id ? 'black' : 'transparent',
                color: activeRoom === room.id ? 'white' : 'rgba(0,0,0,0.5)',
                fontWeight: 600,
                fontSize: '15px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: activeRoom === room.id ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              {room.name}
            </button>
          ))}
        </div>

        {/* Packages Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', width: '100%', maxWidth: '1000px' }}>
          {packages[activeRoom]?.map((pkg, idx) => (
            <div key={idx} style={{
              background: 'white',
              border: '1px solid var(--border)',
              borderRadius: '24px',
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              boxShadow: pkg.qty >= 8 ? '0 20px 40px rgba(0,0,0,0.08)' : '0 4px 20px rgba(0,0,0,0.02)',
              position: 'relative',
              overflow: 'hidden',
              transform: pkg.qty >= 8 ? 'scale(1.02)' : 'none',
              zIndex: pkg.qty >= 8 ? 2 : 1
            }}>
              {pkg.qty >= 8 && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, background: '#16a34a', color: 'white', fontSize: '12px', fontWeight: 700, padding: '6px', letterSpacing: '0.1em' }}>
                  MAIOR VANTAGEM
                </div>
              )}
              
              <h3 style={{ fontSize: '20px', fontWeight: 700, marginTop: pkg.qty >= 8 ? '16px' : '0', marginBottom: '8px' }}>{pkg.title}</h3>
              <p style={{ fontSize: '14px', color: 'rgba(0,0,0,0.5)', marginBottom: '24px', minHeight: '40px' }}>{pkg.desc}</p>
              
              <div style={{ fontSize: '36px', fontWeight: 800, marginBottom: '32px', letterSpacing: '-0.04em' }}>
                <span style={{ fontSize: '18px', verticalAlign: 'top', color: 'rgba(0,0,0,0.4)' }}>R$</span>
                {pkg.price.toFixed(2)}
              </div>

              <button
                onClick={() => handleBuy(pkg)}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '12px',
                  border: 'none',
                  background: pkg.qty >= 8 ? 'black' : 'rgba(0,0,0,0.05)',
                  color: pkg.qty >= 8 ? 'white' : 'black',
                  fontWeight: 600,
                  fontSize: '15px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  marginTop: 'auto'
                }}
                onMouseOver={(e) => {
                  if (pkg.qty < 8) e.currentTarget.style.background = 'rgba(0,0,0,0.1)';
                }}
                onMouseOut={(e) => {
                  if (pkg.qty < 8) e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
                }}
              >
                Comprar Agora
              </button>
            </div>
          ))}
        </div>

        {/* PIX Modal */}
        <AnimatePresence>
          {(loadingPix || pixData) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(10px)',
                zIndex: 100,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                padding: '24px'
              }}
            >
              <div style={{
                background: 'white',
                padding: '40px',
                borderRadius: '32px',
                boxShadow: '0 40px 80px rgba(0,0,0,0.1)',
                width: '100%',
                maxWidth: '400px',
                textAlign: 'center',
                position: 'relative'
              }}>
                <button 
                  onClick={() => setPixData(null)} 
                  style={{ position: 'absolute', top: '24px', right: '24px', background: 'rgba(0,0,0,0.05)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontWeight: 600 }}
                >
                  ✕
                </button>

                {loadingPix && !pixData ? (
                  <div style={{ padding: '60px 0' }}>
                     <div style={{ width: '40px', height: '40px', border: '3px solid rgba(0,0,0,0.1)', borderTopColor: 'black', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 24px' }} />
                     <h3 style={{ fontSize: '20px', fontWeight: 600 }}>Gerando sua cobrança inteligente...</h3>
                     <p style={{ color: 'rgba(0,0,0,0.5)', marginTop: '8px' }}>Seus turnos já serão creditados automaticamente após o pagamento.</p>
                  </div>
                ) : pixData && (
                  <>
                    <div style={{ width: '40px', height: '40px', background: '#34c759', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', margin: '0 auto 24px' }}>
                      $
                    </div>
                    <h3 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Pague com PIX</h3>
                    <p style={{ color: 'rgba(0,0,0,0.5)', marginBottom: '32px' }}>Escaneie o QRCode ou copie o código PIX.</p>
                    
                    <div style={{ background: 'white', padding: '16px', borderRadius: '24px', border: '2px solid rgba(0,0,0,0.05)', display: 'inline-block', marginBottom: '24px' }}>
                      <QRCodeSVG value={pixData.qr_code} size={200} />
                    </div>

                    <button 
                      onClick={copyToClipboard}
                      style={{
                        width: '100%',
                        padding: '16px',
                        borderRadius: '16px',
                        border: 'none',
                        background: copied ? '#34c759' : 'black',
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '16px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      {copied ? '✓ CÓDIGO COPIADO' : 'COPIAR CÓDIGO PIX'}
                    </button>
                    <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: '13px', marginTop: '16px', lineHeight: 1.5 }}>
                      Em até 3 minutos após o pagamento seus turnos serão creditados na carteira verde do topo e você poderá agendar sem gerar novas cobranças.
                    </p>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}
