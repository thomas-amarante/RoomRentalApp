'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      const savedUser = localStorage.getItem('roomrental_user');
      if (savedUser) {
        const parsedNode = JSON.parse(savedUser);
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/users/me`, {
            headers: { 'Authorization': `Bearer ${parsedNode.token || ''}` }
          });
          if (res.ok) {
            const data = await res.json();
            setUser({ ...data, token: parsedNode.token });
          } else {
            setUser(parsedNode);
          }
        } catch(e) {
          setUser(parsedNode);
        }
      }
    };
    fetchUser();
    const interval = setInterval(fetchUser, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!user) return null;

  const hasTickets = user.tickets && user.tickets.length > 0 && user.tickets.some((t: any) => t.shift_tickets > 0 || t.hourly_tickets > 0);

  const formatTickets = () => {
    if (isMobile) {
      return (
        <button
          onClick={() => setIsBalanceModalOpen(true)}
          style={{
            background: hasTickets ? 'rgba(34, 197, 94, 0.1)' : 'rgba(0,0,0,0.05)',
            color: hasTickets ? '#16a34a' : 'rgba(0,0,0,0.6)',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: hasTickets ? '#22c55e' : 'rgba(0,0,0,0.2)' }} />
          {hasTickets ? 'Saldo disponível' : 'Sem saldo'}
        </button>
      );
    }

    if (!hasTickets) {
      return (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Link href="/account" style={{ textDecoration: 'none', cursor: 'pointer' }}>
            <span style={{
              background: 'rgba(0,0,0,0.05)',
              color: 'rgba(0,0,0,0.6)',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.2s',
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(0,0,0,0.2)' }} />
              Sem saldo
            </span>
          </Link>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {Array.isArray(user.tickets) && user.tickets.map((t: any) => {
          if (t.shift_tickets === 0 && t.hourly_tickets === 0) return null;
          return (
            <span key={t.room_id} style={{
              background: 'rgba(34, 197, 94, 0.1)',
              color: '#16a34a',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
              C{t.room_id === 'c4fd9a5f-3f4a-470d-91eb-e8dbea9a3f96' ? '1' : t.room_id === 'd93d2b37-3720-4298-b70b-aaf8a94acee0' ? '2' : '3'}
              : {t.shift_tickets}T | {t.hourly_tickets}H
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <header>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--foreground)', fontWeight: 600, letterSpacing: '0.1em', marginRight: 'auto' }}>· L I V · ODONTOLOGIA</Link>

        {/* Global Balance Badges */}
        <div style={{ display: 'flex', marginRight: '24px' }}>
          {formatTickets()}
        </div>

        {/* Desktop Menu */}
        <div className="desktop-nav">
          <Link href="/">Alugar</Link>
          <Link href="/reservations">Reservas</Link>
          <Link href="/account" className="action-btn">Comprar Saldos</Link>
          {user.is_admin && <Link href="/admin" style={{ color: 'var(--accent)' }}>Admin</Link>}
          <Link href="/profile">Meu Perfil</Link>
          <button className="logout-btn" onClick={() => { localStorage.removeItem('roomrental_user'); router.push('/login'); }}>Sair</button>
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
              <Link href="/" onClick={() => setIsMenuOpen(false)}>Alugar</Link>
              <Link href="/reservations" onClick={() => setIsMenuOpen(false)}>Reservas</Link>
              <Link href="/account" onClick={() => setIsMenuOpen(false)} style={{ color: '#34d399', fontWeight: 'bold' }}>Comprar Saldos</Link>
              {user.is_admin && <Link href="/admin" onClick={() => setIsMenuOpen(false)} style={{ color: '#60a5fa' }}>Admin</Link>}
              <Link href="/profile" onClick={() => setIsMenuOpen(false)}>Meu Perfil</Link>
              <button onClick={() => { localStorage.removeItem('roomrental_user'); router.push('/login'); }}>Sair</button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Balance Detail Modal (Mobile) */}
      <AnimatePresence>
        {isBalanceModalOpen && (
          <div
            onClick={() => setIsBalanceModalOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end',
              justifyContent: 'center', zIndex: 2000,
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 80 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'white',
                borderRadius: '28px 28px 0 0',
                padding: '32px 24px 40px',
                width: '100%',
                maxWidth: '480px',
                boxShadow: '0 -16px 60px rgba(0,0,0,0.15)'
              }}
            >
              {/* Handle bar */}
              <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'rgba(0,0,0,0.12)', margin: '0 auto 28px' }} />

              {/* Title */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase', marginBottom: '6px' }}>Seus Créditos</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'black' }}>{user.name?.split(' ')[0]}</div>
              </div>

              {/* Room balance cards */}
              {hasTickets ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                  {Array.isArray(user.tickets) && user.tickets.map((t: any) => {
                    const hasRoomTickets = t.shift_tickets > 0 || t.hourly_tickets > 0;
                    return (
                      <div
                        key={t.room_id}
                        style={{
                          background: hasRoomTickets ? 'rgba(34,197,94,0.07)' : 'rgba(0,0,0,0.03)',
                          borderRadius: '18px',
                          padding: '18px 20px',
                          border: hasRoomTickets ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(0,0,0,0.06)',
                        }}
                      >
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
                          {t.room_name || `Consultório ${t.room_id}`}
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <div style={{ flex: 1, background: 'white', borderRadius: '12px', padding: '12px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                            <div style={{ fontSize: '28px', fontWeight: 800, color: t.hourly_tickets > 0 ? '#16a34a' : 'rgba(0,0,0,0.2)' }}>{t.hourly_tickets}</div>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase', marginTop: '4px' }}>Horas avulsas</div>
                          </div>
                          <div style={{ flex: 1, background: 'white', borderRadius: '12px', padding: '12px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                            <div style={{ fontSize: '28px', fontWeight: 800, color: t.shift_tickets > 0 ? '#0051a8' : 'rgba(0,0,0,0.2)' }}>{t.shift_tickets}</div>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase', marginTop: '4px' }}>Turnos (5h)</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{
                  background: 'rgba(0,0,0,0.03)', borderRadius: '18px', padding: '32px',
                  textAlign: 'center', marginBottom: '24px'
                }}>
                  <div style={{ fontSize: '36px', marginBottom: '12px' }}>🪙</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'rgba(0,0,0,0.5)' }}>Você não tem saldo disponível</div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <Link
                  href="/account"
                  onClick={() => setIsBalanceModalOpen(false)}
                  style={{
                    flex: 1, padding: '16px', borderRadius: '16px',
                    background: 'black', color: 'white', fontWeight: 700,
                    fontSize: '14px', textAlign: 'center', textDecoration: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  Comprar Saldo
                </Link>
                <button
                  onClick={() => setIsBalanceModalOpen(false)}
                  style={{
                    flex: 1, padding: '16px', borderRadius: '16px',
                    border: '1px solid rgba(0,0,0,0.12)', background: 'transparent',
                    fontWeight: 700, fontSize: '14px', cursor: 'pointer', color: 'black'
                  }}
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
