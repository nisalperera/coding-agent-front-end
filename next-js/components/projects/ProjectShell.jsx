'use client';
import Link from 'next/link';
import { useAuth } from '../../hooks/useAuth';
import AppHeader from '../AppHeader';
export default function ProjectShell({ children }) {
    const auth = useAuth();
    const { signedIn, authLoading } = auth;
    return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <AppHeader auth={auth} />

        <nav
            aria-label="Application"
            className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
        >
            <div className="mx-auto flex w-full max-w-5xl flex-wrap gap-5 text-sm font-medium">
                <Link className="hover:underline" href="/">
                    Chat
                </Link>
                <Link className="hover:underline" href="/projects">
                    Projects
                </Link>
                <Link className="hover:underline" href="/settings">
                    General settings
                </Link>
            </div>
        </nav>
        <main id="project-main" className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-8">
            <div className="mx-auto w-full max-w-5xl">
                {authLoading ? <p role="status">Checking your session...</p> : !signedIn ?
                    <section className="rounded-xl border border-slate-300 p-6 dark:border-slate-700"><h1 className="text-xl font-semibold">Sign in to manage projects</h1><p className="my-3">Projects are private to your account.</p><Link className="text-blue-600 underline dark:text-blue-300" href="/login">Sign in</Link></section> : children}
            </div>
        </main>
    </div>;
}
export function ProjectError({ error, onRetry, collection = false }) {
    const status = error?.status;
    const unavailable = [0, 404, 405, 501, 502, 503, 504].includes(status);
    const title = status === 401 ? 'Your session has expired' : status === 403 ? 'Project access denied' :
        !collection && [404, 410].includes(status) ? 'Project unavailable' : unavailable ? 'Project service unavailable' : 'Unable to load projects';
    return <section role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-2 break-words text-sm">{collection && [404, 405, 501].includes(status) ? 'This frontend requires project API support. No project data has been simulated or saved locally.' : error?.message || 'Please try again.'}</p>
        <div className="mt-4 flex gap-4">{status === 401 ? <Link href="/login" className="underline">Sign in</Link> : <button type="button" onClick={onRetry} className="underline">Retry</button>}<Link href="/projects" className="underline">Projects</Link></div>
    </section>;
}
