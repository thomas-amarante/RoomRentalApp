'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);
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
            // Preserve token
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
    // Refresh header data every 10 seconds or when window focus
    const interval = setInterval(fetchUser, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!user) return null;

  // Calculando saldos

  const formatTickets = () => {
    const hasTickets = user.tickets && user.tickets.length > 0 && user.tickets.some((t: any) => t.shift_tickets > 0 || t.hourly_tickets > 0);

    if (isMobile) {
      return (
        <span style={{
          background: hasTickets ? 'rgba(34, 197, 94, 0.1)' : 'rgba(0,0,0,0.05)',
          color: hasTickets ? '#16a34a' : 'rgba(0,0,0,0.6)',
          padding: '6px 14px',
          borderRadius: '20px',
          fontSize: '11px',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          whiteSpace: 'nowrap'
        }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: hasTickets ? '#22c55e' : 'rgba(0,0,0,0.2)' }} />
          {hasTickets ? 'Saldo disponível' : 'Sem saldo'}
        </span>
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

        {/* Global Balance Badges (Visible on Desktop and Mobile) */}
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
    </>
  );
}
