'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { motion } from 'framer-motion';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'history'>('info');
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showPixModal, setShowPixModal] = useState<any>(null);
  const [copied, setCopied] = useState(false);
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
        const resUser = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/users/me`, {
          headers: { 'Authorization': `Bearer ${parsedNode.token || ''}` }
        });
        
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

  useEffect(() => {
    if (activeTab === 'history' && user?.token) {
      const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/payments/history`, {
            headers: { 'Authorization': `Bearer ${user.token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setHistory(data);
          }
        } catch (err) {
          console.error('Erro ao buscar histórico', err);
        } finally {
          setLoadingHistory(false);
        }
      };
      fetchHistory();
    }
  }, [activeTab, user?.token]);

  if (!user || rooms.length === 0) return null;

  const mappedTickets = rooms.map(room => {
    const ticket = user.tickets?.find((t: any) => t.room_id === room.id) || { hourly_tickets: 0, shift_tickets: 0 };
    return {
      ...room,
      hourly_tickets: ticket.hourly_tickets,
      shift_tickets: ticket.shift_tickets,
    };
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#34c759';
      case 'pending': return '#ff9500'; // Laranja para Aguardando
      case 'expired': 
      case 'cancelled': return '#ff3b30'; // Vermelho para Cancelado/Expirado
      default: return 'rgba(0,0,0,0.4)';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved': return 'Pagamento Realizado';
      case 'pending': return 'Aguardando Pagamento';
      case 'expired': return 'Pagamento Expirado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  // Componente interno para o Timer Regressivo
  const Countdown = ({ expiresAt }: { expiresAt: string }) => {
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [isExpired, setIsExpired] = useState(false);

    useEffect(() => {
      const timer = setInterval(() => {
        const now = new Date().getTime();
        const end = new Date(expiresAt).getTime();
        const diff = end - now;

        if (diff <= 0) {
          setTimeLeft('00:00');
          setIsExpired(true);
          clearInterval(timer);
        } else {
          const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const s = Math.floor((diff % (1000 * 60)) / 1000);
          setTimeLeft(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        }
      }, 1000);
      return () => clearInterval(timer);
    }, [expiresAt]);

    if (isExpired) return <span style={{ color: '#ff3b30', fontWeight: 700 }}>EXPIRADO</span>;

    return (
      <span style={{ fontSize: '13px', color: '#ff9500', fontWeight: 600 }}>
        Expira em: <strong style={{ fontSize: '15px' }}>{timeLeft}</strong>
      </span>
    );
  };

  return (
    <>
      <Header />
      <main className="main-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', paddingBottom: '100px' }}>
        <section style={{ marginBottom: '40px', textAlign: 'center', width: '100%' }}>
          <h1 style={{ fontSize: '48px', fontWeight: 700, letterSpacing: '-0.04em', marginBottom: '12px', color: 'black' }}>
            Meu Perfil.
          </h1>
          <p style={{ fontSize: '20px', color: 'rgba(0,0,0,0.5)' }}>
            Gerencie seus dados e acompanhe seus pacotes por consultório.
          </p>
        </section>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '48px', padding: '6px', background: 'rgba(0,0,0,0.03)', borderRadius: '16px' }}>
          <button 
            onClick={() => setActiveTab('info')}
            style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', background: activeTab === 'info' ? 'white' : 'transparent', fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.3s', boxShadow: activeTab === 'info' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none' }}
          >
            Dados & Pacotes
          </button>
          <button 
           onClick={() => setActiveTab('history')}
           style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', background: activeTab === 'history' ? 'white' : 'transparent', fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.3s', boxShadow: activeTab === 'history' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none' }}
          >
            Histórico de Compras
          </button>
        </div>

        <div style={{ width: '100%', maxWidth: '1000px' }}>
          {activeTab === 'info' ? (
            <div style={{ display: 'flex', flexDirection: 'row', gap: '32px', width: '100%', flexWrap: 'wrap' }}>
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
                     Comprar Novos Pacotes
                   </button>
                </div>
              </motion.div>

              {/* Pacotes por Consultório */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', gap: '24px' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, marginLeft: '8px', color: 'rgba(0,0,0,0.6)' }}>Pacotes por Consultório</h3>
                  
                  {mappedTickets.map((room) => (
                    <div key={room.id} style={{ background: 'white', borderRadius: '16px', padding: '20px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                           <h4 style={{ fontSize: '16px', fontWeight: 600 }}>{room.name}</h4>
                           <div style={{ padding: '4px 8px', background: 'rgba(0,122,255,0.05)', color: 'var(--accent)', borderRadius: '6px', fontSize: '10px', fontWeight: 700 }}>ATIVO</div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', fontSize: '14px', color: 'rgba(0,0,0,0.5)' }}>
                           <div style={{ flex: 1, background: '#f9f9f9', padding: '12px', borderRadius: '12px' }}>
                             <span style={{ fontSize: '10px', display: 'block', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Turnos</span>
                             <strong style={{ color: 'black', fontSize: '18px' }}>{room.shift_tickets}</strong>
                           </div>
                           <div style={{ flex: 1, background: '#f9f9f9', padding: '12px', borderRadius: '12px' }}>
                              <span style={{ fontSize: '10px', display: 'block', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Horas</span>
                              <strong style={{ color: 'black', fontSize: '18px' }}>{room.hourly_tickets}</strong>
                           </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          ) : (
            /* Histórico de Compras */
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(0,0,0,0.4)' }}>Carregando histórico...</div>
              ) : history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px', background: 'white', borderRadius: '24px', border: '1px solid var(--border)' }}>
                   <div style={{ fontSize: '40px', marginBottom: '16px' }}>🧾</div>
                   <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Nenhuma compra encontrada</h3>
                   <p style={{ color: 'rgba(0,0,0,0.4)' }}>Você ainda não realizou nenhuma compra de saldo.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {history.map((order) => (
                    <div 
                      key={order.id} 
                      style={{ 
                        background: 'white', 
                        borderRadius: '20px', 
                        padding: '24px', 
                        border: '1px solid var(--border)', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        gap: '20px'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: getStatusColor(order.current_status), textTransform: 'uppercase' }}>
                            {getStatusLabel(order.current_status)}
                          </span>
                          {order.current_status === 'pending' && order.pix_expires_at && (
                             <>
                               <span style={{ color: 'rgba(0,0,0,0.2)' }}>•</span>
                               <Countdown expiresAt={order.pix_expires_at} />
                             </>
                          )}
                          <span style={{ color: 'rgba(0,0,0,0.2)' }}>•</span>
                          <span style={{ fontSize: '13px', color: 'rgba(0,0,0,0.4)' }}>
                            {new Date(order.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <h4 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>{order.title || 'Compra de Saldo'}</h4>
                        <p style={{ fontSize: '14px', color: 'rgba(0,0,0,0.5)' }}>Para o {order.room_name || 'Consultório selecionado'}</p>
                      </div>
                      
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ fontSize: '20px', fontWeight: 800 }}>R$ {Number(order.amount_paid).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        {order.current_status === 'pending' && (
                          <button 
                            onClick={() => setShowPixModal(order)}
                            style={{ 
                              background: '#007aff', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' 
                            }}
                          >
                            <span>QR Code</span> ➔
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </main>

      {/* Modal de PIX Re-tentativa */}
      {showPixModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setShowPixModal(null)}>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            style={{ background: 'white', borderRadius: '32px', padding: '40px', maxWidth: '440px', width: '100%', textAlign: 'center' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>Finalize seu Pagamento</h3>
            <p style={{ color: 'rgba(0,0,0,0.5)', marginBottom: '32px' }}>Escaneie o QR Code abaixo ou copie o código PIX para pagar.</p>
            
            <div style={{ background: '#f5f5f5', padding: '24px', borderRadius: '24px', marginBottom: '32px', display: 'inline-block' }}>
               <img src={`data:image/png;base64,${showPixModal.qr_code_64}`} alt="QR Code PIX" style={{ width: '220px', height: '220px' }} />
            </div>

            <button 
              onClick={() => {
                navigator.clipboard.writeText(showPixModal.qr_code);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              style={{ width: '100%', padding: '16px', background: copied ? '#34c759' : 'black', color: 'white', border: 'none', borderRadius: '16px', fontWeight: 600, fontSize: '16px', cursor: 'pointer', transition: 'all 0.3s' }}
            >
              {copied ? 'Código Copiado! ✓' : 'Copiar Chave PIX'}
            </button>
            <button onClick={() => setShowPixModal(null)} style={{ marginTop: '16px', background: 'transparent', border: 'none', color: 'rgba(0,0,0,0.3)', fontWeight: 600, cursor: 'pointer' }}>Fechar</button>
          </motion.div>
        </div>
      )}
    </>
  );
}
