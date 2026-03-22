'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function SessionTimeout() {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Only enforce timeout if the user is actually on a private/authenticated route
        if (pathname === '/login' || pathname.startsWith('/lookup')) {
            return;
        }

        let timeoutId: NodeJS.Timeout;
        const TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes in milliseconds
        let lastWrite = 0;

        const handleLogout = () => {
            const userStr = localStorage.getItem('roomrental_user');
            if (userStr) {
                localStorage.removeItem('roomrental_user');
                localStorage.removeItem('roomrental_last_activity');
                alert('Sua sessão expirou por inatividade. Faça login novamente.');
                router.push('/login');
            }
        };

        const checkAndLogout = () => {
            const lastActivityStr = localStorage.getItem('roomrental_last_activity');
            const lastActivity = lastActivityStr ? parseInt(lastActivityStr, 10) : 0;
            const now = Date.now();
            
            if (now - lastActivity >= TIMEOUT_MS) {
                handleLogout();
            } else {
                // Sincroniza o timer para estourar no restante do tempo exato
                const timeLeft = TIMEOUT_MS - (now - lastActivity);
                timeoutId = setTimeout(checkAndLogout, timeLeft);
            }
        };

        const resetTimer = () => {
            const now = Date.now();
            // Throttling: escreve no localStorage apenas a cada 5 segundos no máximo
            if (now - lastWrite > 5000) {
                localStorage.setItem('roomrental_last_activity', now.toString());
                lastWrite = now;
            }
            clearTimeout(timeoutId);
            timeoutId = setTimeout(checkAndLogout, TIMEOUT_MS);
        };

        const initialCheck = () => {
            const lastActivityStr = localStorage.getItem('roomrental_last_activity');
            const now = Date.now();
            if (lastActivityStr) {
                const lastActivity = parseInt(lastActivityStr, 10);
                if (now - lastActivity >= TIMEOUT_MS) {
                    handleLogout();
                    return false;
                }
            }
            localStorage.setItem('roomrental_last_activity', now.toString());
            lastWrite = now;
            return true;
        };

        // Verifica na montagem se o tempo entre o último acesso estourou
        if (!initialCheck()) {
            return;
        }

        timeoutId = setTimeout(checkAndLogout, TIMEOUT_MS);

        // Setup event listeners to detect user interaction
        const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];

        events.forEach(event => {
            window.addEventListener(event, resetTimer);
        });

        // Cleanup listeners and timeouts when component unmounts
        return () => {
            clearTimeout(timeoutId);
            events.forEach(event => {
                window.removeEventListener(event, resetTimer);
            });
        };
    }, [router, pathname]);

    return null;
}
