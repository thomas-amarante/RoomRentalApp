'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface ReservationDetails {
    id: string;
    room_name: string;
    user_name: string;
    booking_period: string;
    status: string;
    total_price: number;
}

function formatPeriod(booking_period: string): { date: string; start: string; end: string } {
    try {
        const cleanStr = booking_period.replace(/["[\)]/g, '');
        const [start, end] = cleanStr.split(',');
        const startDate = new Date(start);
        const endDate = new Date(end);
        return {
            date: startDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
            start: startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            end: endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        };
    } catch {
        return { date: '-', start: '-', end: '-' };
    }
}

export default function LookupPage() {
    const params = useParams();
    const id = params?.id as string;
    const [reservation, setReservation] = useState<ReservationDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!id) return;
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/lookup/${id}`)
            .then(res => {
                if (!res.ok) throw new Error('not found');
                return res.json();
            })
            .then(data => {
                setReservation(data);
                setLoading(false);
            })
            .catch(() => {
                setNotFound(true);
                setLoading(false);
            });
    }, [id]);

    const isConfirmed = reservation?.status === 'confirmed';

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #f5f7ff 0%, #ffffff 100%)',
            padding: '24px',
            fontFamily: '-apple-system, system-ui, sans-serif'
        }}>
            {loading ? (
                <div style={{ textAlign: 'center', color: 'rgba(0,0,0,0.3)', fontSize: '16px' }}>
                    Verificando agendamento...
                </div>
            ) : notFound ? (
                <div style={{
                    textAlign: 'center',
                    background: 'white',
                    borderRadius: '28px',
                    padding: '60px 48px',
                    border: '1px solid #f0f0f0',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.06)',
                    maxWidth: '420px',
                    width: '100%'
                }}>
                    <div style={{ fontSize: '64px', marginBottom: '24px' }}>⚠️</div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px', letterSpacing: '-0.03em' }}>
                        Agendamento não encontrado
                    </h1>
                    <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: '15px' }}>
                        O QR Code pode ser inválido ou o agendamento foi removido.
                    </p>
                </div>
            ) : reservation && (
                <div style={{
                    background: 'white',
                    borderRadius: '28px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
                    border: '1px solid #f0f0f0',
                    maxWidth: '420px',
                    width: '100%',
                    overflow: 'hidden'
                }}>
                    {/* Status Banner */}
                    <div style={{
                        background: isConfirmed ? '#34c759' : (reservation.status === 'pending' ? '#ff9500' : '#ff3b30'),
                        padding: '16px 24px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <span style={{ fontSize: '22px' }}>{isConfirmed ? '✓' : (reservation.status === 'pending' ? '⌛' : '✕')}</span>
                        <span style={{
                            color: 'white',
                            fontWeight: 700,
                            fontSize: '13px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em'
                        }}>
                            {isConfirmed ? 'Agendamento Válido' : (reservation.status === 'pending' ? 'Aguardando Pagamento' : 'Agendamento Cancelado')}
                        </span>
                    </div>

                    {/* Content */}
                    <div style={{ padding: '32px 28px' }}>
                        {/* Clinic logo/header */}
                        <p style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#0071e3',
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            marginBottom: '24px'
                        }}>
                            · L I V · ODONTOLOGIA
                        </p>

                        {/* Professional */}
                        <div style={{ marginBottom: '28px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                                Profissional
                            </div>
                            <div style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.02em' }}>
                                {reservation.user_name}
                            </div>
                        </div>

                        <div style={{ borderTop: '1px dashed #e5e5e5', margin: '20px 0' }} />

                        {/* Room */}
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                                Sala
                            </div>
                            <div style={{ fontSize: '18px', fontWeight: 600 }}>
                                {reservation.room_name}
                            </div>
                        </div>

                        {/* Date and Time */}
                        {(() => {
                            const { date, start, end } = formatPeriod(reservation.booking_period);
                            return (
                                <>
                                    <div style={{ marginBottom: '20px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                                            Data
                                        </div>
                                        <div style={{ fontSize: '16px', fontWeight: 600, textTransform: 'capitalize' }}>
                                            {date}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '24px', marginBottom: '20px' }}>
                                        <div>
                                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                                                Entrada
                                            </div>
                                            <div style={{ fontSize: '22px', fontWeight: 700 }}>
                                                {start}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px', color: 'rgba(0,0,0,0.3)', fontSize: '18px' }}>→</div>
                                        <div>
                                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(0,0,0,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                                                Saída
                                            </div>
                                            <div style={{ fontSize: '22px', fontWeight: 700 }}>
                                                {end}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}

                        <div style={{ borderTop: '1px dashed #e5e5e5', margin: '20px 0' }} />

                        {/* ID */}
                        <div style={{ fontSize: '11px', color: 'rgba(0,0,0,0.25)', fontFamily: 'monospace' }}>
                            ID: {reservation.id}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
