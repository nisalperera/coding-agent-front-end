'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import Header from './Header';
import IntegrationsModal from './IntegrationsModal';
import { useTheme } from './ThemeProvider';
import { useIntegrationSettings } from '../hooks/useIntegrationSettings';
import { getIntegrationsStatus } from '../lib/integrations';

export default function AppHeader({ auth }) {
    const router = useRouter();
    const theme = useTheme();

    const {
        githubIntegrationEnabled,
        gitlabIntegrationEnabled,
    } = useIntegrationSettings();

    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState({
        integrations: null,
        loading: false,
        error: false,
    });

    const requestVersion = useRef(0);

    const visibility = {
        github: githubIntegrationEnabled,
        gitlab: gitlabIntegrationEnabled,
    };

    const hasVisibleIntegrations =
        githubIntegrationEnabled || gitlabIntegrationEnabled;

    const refreshIntegrations = useCallback(async () => {
        const version = ++requestVersion.current;

        setStatus(current => ({
            ...current,
            loading: true,
            error: false,
        }));

        try {
            const integrations = await getIntegrationsStatus();

            if (version !== requestVersion.current) {
                return;
            }

            setStatus({
                integrations,
                loading: false,
                error: false,
            });
        } catch {
            if (version !== requestVersion.current) {
                return;
            }

            setStatus({
                integrations: null,
                loading: false,
                error: true,
            });
        }
    }, []);

    function closeIntegrations() {
        requestVersion.current += 1;
        setOpen(false);
    }

    function handleUnauthenticated() {
        closeIntegrations();
        router.push('/login');
    }

    return (
        <>
            <Header
                auth={auth}
                theme={theme}
                integrations={
                    auth.signedIn ? status.integrations : null
                }
                integrationVisibility={visibility}
                onOpenIntegrations={() => {
                    if (auth.signedIn && hasVisibleIntegrations) {
                        setOpen(true);
                    }
                }}
            />

            {open && auth.signedIn && hasVisibleIntegrations && (
                <IntegrationsModal
                    open
                    onClose={closeIntegrations}
                    integrations={status.integrations}
                    loading={status.loading}
                    error={status.error}
                    onRefresh={refreshIntegrations}
                    onUnauthenticated={handleUnauthenticated}
                />
            )}
        </>
    );
}
