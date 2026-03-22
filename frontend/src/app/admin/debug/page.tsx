'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface DebugUser {
    id: string;
    name: string;
    email: string;
    phone: string;
    is_admin: boolean;
    created_at: string;
}

interface DebugRoom {
    id: string;
    name: string;
    description: string;
    hourly_rate: number;
    shift_rate: number;
    capacity: number;
}

interface DebugReservation {
    id: string;
    room_id: string;
    user_id: string;
    room_name?: string;
    user_name?: string;
    booking_period: string;
    status: string;
    total_price: number;
    created_at: string;
}

export default function AdminDebug() {
    const [activeTab, setActiveTab] = useState<'users' | 'rooms' | 'reservations'>('users');
    const [users, setUsers] = useState<DebugUser[]>([]);
    const [rooms, setRooms] = useState<DebugRoom[]>([]);
    const [reservations, setReservations] = useState<DebugReservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [adminUser, setAdminUser] = useState<any>(null);
    const router = useRouter();

    // Modal States
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingEntity, setEditingEntity] = useState<any>(null);
    const [editType, setEditType] = useState<'user' | 'room' | 'reservation' | null>(null);

    // Filter
    const [searchUser, setSearchUser] = useState('');

    const fetchData = async () => {
        const storedUser = localStorage.getItem('roomrental_user');
        if (!storedUser) {
            router.push('/login');
            return;
        }

        const userData = JSON.parse(storedUser);
        setAdminUser(userData);

        if (!userData.is_admin) {
            router.push('/');
            return;
        }

        setLoading(true);
        try {
            const headers = { 'Authorization': `Bearer ${userData.token || ''}` };

            const usersRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/users`, { headers });
            if (usersRes.status === 401 || usersRes.status === 403) throw new Error('unauthorized');

            const roomsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/rooms`);
            const reservationsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/reservations`, { headers });

            if (!usersRes.ok || !roomsRes.ok || !reservationsRes.ok) throw new Error('Failed to fetch debug data');

            setUsers(await usersRes.json());
            setRooms(await roomsRes.json());
            setReservations(await reservationsRes.json());
        } catch (err: any) {
            console.error('Fetch error:', err);
            if (err.message === 'unauthorized') {
                localStorage.removeItem('roomrental_user');
                router.push('/login');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleDelete = async (id: string, type: 'users' | 'rooms' | 'reservations') => {
        if (!confirm(`TEM CERTEZA QUE DESEJA EXCLUIR ESTE ITEM PERMANENTEMENTE DO BANCO?`)) return;

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/${type}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${adminUser.token || ''}` }
            });

            if (res.ok) {
                fetchData();
            } else {
                alert('Erro ao excluir');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleToggleAdmin = async (user: DebugUser) => {
        if (!confirm(`Deseja realmente ${user.is_admin ? 'REMOVER' : 'CONCEDER'} permissões de administrador para ${user.name}?`)) return;

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/users/${user.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminUser.token || ''}`
                },
                body: JSON.stringify({ ...user, is_admin: !user.is_admin })
            });

            if (res.ok) {
                fetchData();
            } else {
                alert('Erro ao atualizar permissões.');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleEdit = (entity: any, type: 'user' | 'room' | 'reservation') => {
        setEditingEntity({ ...entity });
        setEditType(type);
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingEntity || !editType) return;

        const typePlural = editType === 'user' ? 'users' : (editType === 'room' ? 'rooms' : 'reservations');

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/${typePlural}/${editingEntity.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminUser.token || ''}`
                },
                body: JSON.stringify(editingEntity)
            });

            if (res.ok) {
                setIsEditModalOpen(false);
                fetchData();
            } else {
                alert('Erro ao salvar alterações');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSaveRow = async (entity: any, type: 'room' | 'reservation') => {
        const typePlural = type === 'room' ? 'rooms' : 'reservations';
        let payload = { ...entity };
        
        // Remove old properties if they exist
        if (type === 'room') {
            delete payload.hourly_rate;
            delete payload.shift_rate;
        }

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/${typePlural}/${entity.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminUser.token || ''}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert('Atualizado com sucesso!');
                fetchData();
            } else {
                alert('Erro ao atualizar.');
            }
        } catch (err) {
            console.error(err);
            alert('Erro de conexão.');
        }
    };

    return (
        <div style={{ background: '#fcfcfc', minHeight: '100vh', padding: '40px' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <Link href="/admin" style={{ textDecoration: 'none', color: 'rgba(0,0,0,0.4)', fontWeight: 600 }}>← Voltar</Link>
                    <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.04em' }}>Painel Debug</h1>
                </div>
            </header>

            <div className="admin-tabs-container" style={{ marginTop: '20px', marginBottom: '32px', width: 'fit-content' }}>
                {(['users', 'rooms', 'reservations'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: '10px 24px', borderRadius: '10px', border: 'none',
                            background: activeTab === tab ? 'black' : 'transparent',
                            color: activeTab === tab ? 'white' : 'rgba(0,0,0,0.4)',
                            fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
                        }}
                    >
                        {tab === 'users' ? 'Usuários' : (tab === 'rooms' ? 'Salas' : 'Reservas')}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', color: 'rgba(0,0,0,0.2)', padding: '100px' }}>Carregando dados estruturais...</div>
            ) : (
                <>
                    {activeTab === 'users' && (
                        <div style={{ marginBottom: '24px' }}>
                            <input
                                type="text"
                                placeholder="🔍 Buscar usuário por nome, e-mail ou telefone..."
                                className="input-field"
                                value={searchUser}
                                onChange={(e) => setSearchUser(e.target.value)}
                                style={{ maxWidth: '400px', background: 'white', border: '1px solid var(--border)' }}
                            />
                        </div>
                    )}

                    <div style={{ border: '1px solid var(--border)', borderRadius: '24px', overflowX: 'auto', background: 'white', width: '100%' }}>
                        {activeTab === 'users' && (
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                                <thead style={{ background: '#f9f9f9', borderBottom: '1px solid #eee' }}>
                                    <tr>
                                        <th style={{ padding: '20px', fontSize: '11px', color: 'rgba(0,0,0,0.4)' }}>DADOS</th>
                                        <th style={{ padding: '20px', fontSize: '11px', color: 'rgba(0,0,0,0.4)' }}>DETALHES</th>
                                        <th style={{ padding: '20px', fontSize: '11px', color: 'rgba(0,0,0,0.4)', textAlign: 'right' }}>AÇÕES</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.filter(u =>
                                        u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
                                        u.email.toLowerCase().includes(searchUser.toLowerCase()) ||
                                        (u.phone && u.phone.includes(searchUser))
                                    ).map(u => (
                                        <tr key={u.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                            <td style={{ padding: '20px' }}>
                                                <div style={{ fontWeight: 700 }}>{u.name}</div>
                                                <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.4)' }}>{u.id}</div>
                                            </td>
                                            <td style={{ padding: '20px' }}>
                                                <div style={{ fontSize: '14px' }}>{u.email}</div>
                                                <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.6)', marginTop: '2px' }}>Tel: {u.phone || 'N/A'}</div>
                                                <div style={{ fontSize: '11px', background: u.is_admin ? '#000' : '#eee', color: u.is_admin ? '#fff' : '#666', padding: '2px 8px', borderRadius: '100px', display: 'inline-block', marginTop: '4px' }}>
                                                    {u.is_admin ? 'ADMIN' : 'USER'}
                                                </div>
                                            </td>
                                            <td style={{ padding: '20px', textAlign: 'right' }}>
                                                <button onClick={() => handleToggleAdmin(u)} style={{ marginRight: '8px', border: 'none', background: 'none', cursor: 'pointer', color: u.is_admin ? 'orange' : 'green', fontSize: '12px', fontWeight: 600 }}>
                                                    {u.is_admin ? 'Remover Admin' : 'Tornar Admin'}
                                                </button>
                                                <button onClick={() => handleEdit(u, 'user')} style={{ marginRight: '8px', border: 'none', background: 'none', cursor: 'pointer', color: 'blue', fontSize: '12px' }}>Editar</button>
                                                <button onClick={() => handleDelete(u.id, 'users')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'red', fontSize: '12px' }}>Excluir</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        {activeTab === 'rooms' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
                                {rooms.map(r => (
                                    <div key={r.id} style={{ border: '1px solid #eee', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#fafafa' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ fontSize: '11px', color: 'rgba(0,0,0,0.4)', fontWeight: 700 }}>ID: {r.id}</div>
                                            <button onClick={() => handleDelete(r.id, 'rooms')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'red', fontSize: '12px', fontWeight: 600 }}>Excluir Sala</button>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                                            <div>
                                                <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.6)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Nome</label>
                                                <input className="input-field" value={r.name} onChange={e => setRooms(rooms.map(rm => rm.id === r.id ? { ...rm, name: e.target.value } : rm))} style={{ background: 'white' }} />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.6)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Capacidade</label>
                                                <input type="number" className="input-field" value={r.capacity} onChange={e => setRooms(rooms.map(rm => rm.id === r.id ? { ...rm, capacity: parseInt(e.target.value) || 1 } : rm))} style={{ background: 'white' }} />
                                            </div>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.6)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Descrição</label>
                                            <textarea className="input-field" value={r.description || ''} onChange={e => setRooms(rooms.map(rm => rm.id === r.id ? { ...rm, description: e.target.value } : rm))} style={{ background: 'white', minHeight: '60px' }} />
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <button onClick={() => handleSaveRow(r, 'room')} style={{ background: 'black', color: 'white', padding: '10px 24px', borderRadius: '12px', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Salvar Alterações</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {activeTab === 'reservations' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
                                {reservations.map(res => (
                                    <div key={res.id} style={{ border: '1px solid #eee', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#fafafa' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ fontSize: '11px', color: 'rgba(0,0,0,0.4)', fontWeight: 700 }}>ID: {res.id} | Criada em: {new Date(res.created_at).toLocaleString()}</div>
                                            <button onClick={() => handleDelete(res.id, 'reservations')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'red', fontSize: '12px', fontWeight: 600 }}>Excluir Reserva</button>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                                            <div>
                                                <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.6)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>User ID</label>
                                                <input className="input-field" value={res.user_id} onChange={e => setReservations(reservations.map(rs => rs.id === res.id ? { ...rs, user_id: e.target.value } : rs))} style={{ background: 'white' }} />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.6)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Room ID</label>
                                                <input className="input-field" value={res.room_id} onChange={e => setReservations(reservations.map(rs => rs.id === res.id ? { ...rs, room_id: e.target.value } : rs))} style={{ background: 'white' }} />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.6)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Período Daterange</label>
                                                <input className="input-field" value={res.booking_period} onChange={e => setReservations(reservations.map(rs => rs.id === res.id ? { ...rs, booking_period: e.target.value } : rs))} style={{ background: 'white' }} />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.6)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Status</label>
                                                <select className="input-field" value={res.status} onChange={e => setReservations(reservations.map(rs => rs.id === res.id ? { ...rs, status: e.target.value } : rs))} style={{ background: 'white' }}>
                                                    <option value="pending">Aguardando Pagamento</option>
                                                    <option value="confirmed">Confirmado</option>
                                                    <option value="cancelled">Cancelado</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.6)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Preço Total (R$)</label>
                                                <input type="number" step="0.01" className="input-field" value={res.total_price} onChange={e => setReservations(reservations.map(rs => rs.id === res.id ? { ...rs, total_price: parseFloat(e.target.value) || 0 } : rs))} style={{ background: 'white' }} />
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.4)', fontWeight: 600 }}>Usuário: {res.user_name} | Sala: {res.room_name}</div>
                                            <button onClick={() => handleSaveRow(res, 'reservation')} style={{ background: 'black', color: 'white', padding: '10px 24px', borderRadius: '12px', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Salvar Alterações</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* EDIT MODAL */}
            <AnimatePresence>
                {isEditModalOpen && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEditModalOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)' }} />
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} style={{ position: 'relative', background: 'white', width: '100%', maxWidth: '500px', borderRadius: '32px', padding: '40px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                            <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '24px' }}>Editar {editType === 'user' ? 'Usuário' : (editType === 'room' ? 'Sala' : 'Reserva')}</h2>
                            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                                {editType === 'user' && (
                                    <>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase' }}>Nome</label>
                                            <input className="input-field" value={editingEntity.name} onChange={e => setEditingEntity({ ...editingEntity, name: e.target.value })} required />
                                        </div>
                                        <div>
                                            <div>
                                                <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase' }}>Email</label>
                                                <input className="input-field" value={editingEntity.email} onChange={e => setEditingEntity({ ...editingEntity, email: e.target.value })} required />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase' }}>Telefone</label>
                                                <input className="input-field" value={editingEntity.phone} onChange={e => setEditingEntity({ ...editingEntity, phone: e.target.value })} required />
                                            </div>
                                        </div>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={editingEntity.is_admin} onChange={e => setEditingEntity({ ...editingEntity, is_admin: e.target.checked })} />
                                            É Administrador?
                                        </label>
                                    </>
                                )}

                                <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                    <button type="submit" style={{ flex: 1, background: 'black', color: 'white', border: 'none', height: '50px', borderRadius: '14px', fontWeight: 700, cursor: 'pointer' }}>Salvar Alterações</button>
                                    <button type="button" onClick={() => setIsEditModalOpen(false)} style={{ flex: 1, background: '#eee', border: 'none', height: '50px', borderRadius: '14px', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
