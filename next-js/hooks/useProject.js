'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getProject } from '../lib/projects';

export function useProject(projectId) {
    const [version, setVersion] = useState(0);

    const [state, setState] = useState({
        id: null,
        version: -1,
        project: null,
        loading: true,
        error: null,
    });

    const controller = useRef(null);

    useEffect(() => {
        const current = new AbortController();
        controller.current = current;

        getProject(projectId, current.signal)
            .then(project => {
                if (!current.signal.aborted) {
                    setState({
                        id: projectId,
                        version,
                        project,
                        loading: false,
                        error: null,
                    });
                }
            })
            .catch(error => {
                if (!current.signal.aborted) {
                    setState({
                        id: projectId,
                        version,
                        project: null,
                        loading: false,
                        error,
                    });
                }
            });

        return () => current.abort();
    }, [projectId, version]);

    const reload = useCallback(() => {
        controller.current?.abort();
        setVersion(value => value + 1);
    }, []);

    const replace = useCallback(project => {
        controller.current?.abort();

        setState({
            id: project.id,
            version,
            project,
            loading: false,
            error: null,
        });
    }, [version]);

    const matchesRequest =
        state.id === projectId &&
        state.version === version;

    return {
        project: matchesRequest ? state.project : null,
        loading: matchesRequest ? state.loading : true,
        error: matchesRequest ? state.error : null,
        reload,
        replace,
    };
}
