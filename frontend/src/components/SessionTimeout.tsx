'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function SessionTimeout() {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Only enforce timeout if the user is actually on a private/authenticated route
        // and not already on the login page or public lookup page.
        if (pathname === '/login' || pathname.startsWith('/lookup')) {
            return;
        }

        let timeoutId: NodeJS.Timeout;
        const TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes in milliseconds

        const handleLogout = () => {
            // Check if user is actually logged in before showing the alert
            // This prevents the alert from showing to guests who just lingered on the homepage
            const userStr = localStorage.getItem('roomrental_user');
            if (userStr) {
                localStorage.removeItem('roomrental_user');
                alert('Sua sessão expirou por inatividade. Faça login novamente.');
                router.push('/login');
            }
        };

        const resetTimer = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(handleLogout, TIMEOUT_MS);
        };

        // Initialize the timer as soon as the component mounts
        resetTimer();

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

    // This component doesn't render anything visually
    return null;
}
