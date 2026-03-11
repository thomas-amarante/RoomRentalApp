'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { motion } from 'framer-motion';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      const savedUser = localStorage.getItem('roomrental_user');
      if (!savedUser) {
        router.push('/login');
        return;
      }

      const parsedNode = JSON.parse(savedUser);

      try {
        // Fetch fresh user data with tickets, cpf, cro, address
        const resUser = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/users/me`, {
          headers: { 'Authorization': `Bearer ${parsedNode.token || ''}` }
        });
        
        // Fetch rooms for dynamic pricing calculation
        const resRooms = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/rooms`);
        
        if (resUser.ok && resRooms.ok) {
          const userData = await resUser.json();
          const roomsData = await resRooms.json();
          
          setUser({ ...userData, token: parsedNode.token });
          setRooms(roomsData);
        } else {
          router.push('/login');
        }
      } catch (err) {
        console.error('Erro ao carregar dados do perfil', err);
      }
    };
    fetchData();
  }, [router]);

  if (!user || rooms.length === 0) return null;

  // Calculate Global Balance
  let globalBalance = 0;
  
  const mappedTickets = rooms.map(room => {
    const ticket = user.tickets?.find((t: any) => t.room_id === room.id) || { hourly_tickets: 0, shift_tickets: 0 };
    const roomValue = (ticket.hourly_tickets * room.hourly_rate) + (ticket.shift_tickets * room.shift_rate);
    globalBalance += roomValue;
    return {
      ...room,
      hourly_tickets: ticket.hourly_tickets,
      shift_tickets: ticket.shift_tickets,
      total_value: roomValue
    };
  });

  return (
    <>
      <Header />
      <main className="main-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', paddingBottom: '100px' }}>
        <section style={{ marginBottom: '60px', textAlign: 'center', width: '100%' }}>
          <h1 style={{ fontSize: '48px', fontWeight: 700, letterSpacing: '-0.04em', marginBottom: '12px', color: 'black' }}>
            Meu Perfil.
          </h1>
          <p style={{ fontSize: '20px', color: 'rgba(0,0,0,0.5)' }}>
            Gerencie seus dados e acompanhe seus saldos por consultório.
          </p>
        </section>

        <div style={{ display: 'flex', flexDirection: 'row', gap: '32px', width: '100%', maxWidth: '1000px', flexWrap: 'wrap' }}>
          
          {/* Dados Cadastrais */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            style={{ flex: '1 1 400px', background: 'white', borderRadius: '24px', padding: '40px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid var(--border)' }}
          >
            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px', borderBottom: '1px solid #eee', paddingBottom: '16px' }}>
              Dados Pessoais
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', display: 'block' }}>Nome Completo</span>
                <span style={{ fontSize: '16px', fontWeight: 500 }}>{user.name}</span>
              </div>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', display: 'block' }}>E-mail</span>
                <span style={{ fontSize: '16px', fontWeight: 500 }}>{user.email}</span>
              </div>
              <div style={{ display: 'flex', gap: '24px' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', display: 'block' }}>Telefone</span>
                  <span style={{ fontSize: '16px', fontWeight: 500 }}>{user.phone || 'Não informado'}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', display: 'block' }}>CPF</span>
                  <span style={{ fontSize: '16px', fontWeight: 500 }}>{user.cpf || 'Não informado'}</span>
                </div>
              </div>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', display: 'block' }}>CRO</span>
                <span style={{ fontSize: '16px', fontWeight: 500 }}>{user.cro || 'Não registrado'}</span>
              </div>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', display: 'block' }}>Endereço Completo</span>
                <span style={{ fontSize: '16px', fontWeight: 500, lineHeight: 1.5 }}>{user.address || 'Não registrado'}</span>
              </div>
            </div>
            <div style={{ marginTop: '32px' }}>
               <button onClick={() => router.push('/account')} style={{ width: '100%', background: 'rgba(0,0,0,0.05)', border: 'none', padding: '16px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.1)'} onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}>
                 Comprar Novos Saldos
               </button>
            </div>
          </motion.div>

          {/* Carteira / Saldos */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', gap: '24px' }}
          >
            {/* Saldo Global Card */}
            <div style={{ background: '#1d1d1f', color: 'white', borderRadius: '24px', padding: '40px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -100, right: -100, width: 250, height: 250, background: 'radial-gradient(circle, rgba(22,163,74,0.3) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%' }} />
              
              <span style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7 }}>Saldo Global Estimado</span>
              <div style={{ fontSize: '56px', fontWeight: 700, letterSpacing: '-0.04em', margin: '8px 0 24px 0' }}>
                <span style={{ fontSize: '24px', verticalAlign: 'top', opacity: 0.7, marginRight: '8px' }}>R$</span>
                {globalBalance.toFixed(2)}
              </div>
              
              <div style={{ fontSize: '14px', lineHeight: 1.5, opacity: 0.8 }}>
                {globalBalance === 0 ? 'Você não possui nenhum pacote de turnos ou horas ativas em sua conta no momento.' : 'Este é o valor em reais correspondente aos turnos e horas que você possui em estoque nas salas clínicas.'}
              </div>
            </div>

            {/* Saldos por Consultório */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginLeft: '8px', color: 'rgba(0,0,0,0.6)' }}>Detalhes por Consultório</h3>
              
              {mappedTickets.map((room) => (
                <div key={room.id} style={{ background: 'white', borderRadius: '16px', padding: '20px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>{room.name}</h4>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '14px', color: 'rgba(0,0,0,0.5)' }}>
                       <span><strong style={{ color: 'black' }}>{room.shift_tickets}</strong> Turnos</span>
                       <span><strong style={{ color: 'black' }}>{room.hourly_tickets}</strong> Horas</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#16a34a' }}>R$ {room.total_value.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>

          </motion.div>

        </div>
      </main>
    </>
  );
}
