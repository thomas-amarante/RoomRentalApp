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
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                            <thead style={{ background: '#f9f9f9', borderBottom: '1px solid #eee' }}>
                                <tr>
                                    <th style={{ padding: '20px', fontSize: '11px', color: 'rgba(0,0,0,0.4)' }}>DADOS</th>
                                    <th style={{ padding: '20px', fontSize: '11px', color: 'rgba(0,0,0,0.4)' }}>DETALHES</th>
                                    <th style={{ padding: '20px', fontSize: '11px', color: 'rgba(0,0,0,0.4)', textAlign: 'right' }}>AÇÕES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeTab === 'users' && users
                                    .filter(u =>
                                        u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
                                        u.email.toLowerCase().includes(searchUser.toLowerCase()) ||
                                        (u.phone && u.phone.includes(searchUser))
                                    )
                                    .map(u => (
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
                                                <button onClick={() => handleEdit(u, 'user')} style={{ marginRight: '8px', border: 'none', background: 'none', cursor: 'pointer', color: 'blue', fontSize: '12px' }}>Editar</button>
                                                <button onClick={() => handleDelete(u.id, 'users')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'red', fontSize: '12px' }}>Excluir</button>
                                            </td>
                                        </tr>
                                    ))}

                                {activeTab === 'rooms' && rooms.map(r => (
                                    <tr key={r.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                        <td style={{ padding: '20px' }}>
                                            <div style={{ fontWeight: 700 }}>{r.name}</div>
                                            <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.4)' }}>{r.id}</div>
                                        </td>
                                        <td style={{ padding: '20px' }}>
                                            <div style={{ fontSize: '14px' }}>Hora: R${r.hourly_rate} | Turno: R${r.shift_rate}</div>
                                            <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>Capacidade: {r.capacity}</div>
                                        </td>
                                        <td style={{ padding: '20px', textAlign: 'right' }}>
                                            <button onClick={() => handleEdit(r, 'room')} style={{ marginRight: '8px', border: 'none', background: 'none', cursor: 'pointer', color: 'blue', fontSize: '12px' }}>Editar</button>
                                            <button onClick={() => handleDelete(r.id, 'rooms')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'red', fontSize: '12px' }}>Excluir</button>
                                        </td>
                                    </tr>
                                ))}

                                {activeTab === 'reservations' && reservations.map(res => (
                                    <tr key={res.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                        <td style={{ padding: '20px' }}>
                                            <div style={{ fontWeight: 700 }}>Sala: {res.room_name || res.room_id}</div>
                                            <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.4)' }}>{res.id}</div>
                                        </td>
                                        <td style={{ padding: '20px' }}>
                                            <div style={{ fontSize: '13px' }}>Usuário: {res.user_name || res.user_id}</div>
                                            <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>Status: {res.status.toUpperCase()} | R${res.total_price}</div>
                                        </td>
                                        <td style={{ padding: '20px', textAlign: 'right' }}>
                                            <button onClick={() => handleEdit(res, 'reservation')} style={{ marginRight: '8px', border: 'none', background: 'none', cursor: 'pointer', color: 'blue', fontSize: '12px' }}>Editar</button>
                                            <button onClick={() => handleDelete(res.id, 'reservations')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'red', fontSize: '12px' }}>Excluir</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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

                                {editType === 'room' && (
                                    <>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase' }}>Nome</label>
                                            <input className="input-field" value={editingEntity.name} onChange={e => setEditingEntity({ ...editingEntity, name: e.target.value })} required />
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase' }}>Valor Hora</label>
                                                <input type="number" step="0.01" className="input-field" value={editingEntity.hourly_rate} onChange={e => setEditingEntity({ ...editingEntity, hourly_rate: parseFloat(e.target.value) })} required />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase' }}>Valor Turno</label>
                                                <input type="number" step="0.01" className="input-field" value={editingEntity.shift_rate} onChange={e => setEditingEntity({ ...editingEntity, shift_rate: parseFloat(e.target.value) })} required />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {editType === 'reservation' && (
                                    <>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase' }}>Status</label>
                                            <select className="input-field" value={editingEntity.status} onChange={e => setEditingEntity({ ...editingEntity, status: e.target.value })}>
                                                <option value="pending">Pending</option>
                                                <option value="confirmed">Confirmed</option>
                                                <option value="cancelled">Cancelled</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase' }}>Preço Total</label>
                                            <input type="number" step="0.01" className="input-field" value={editingEntity.total_price} onChange={e => setEditingEntity({ ...editingEntity, total_price: parseFloat(e.target.value) })} required />
                                        </div>
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
