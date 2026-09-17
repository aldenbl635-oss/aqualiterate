import React, { useState, useEffect } from 'react';
import { getSites } from '../services/api';

export function useSite() {
    const [sites, setSites] = useState([]);
    const [activeSiteId, setActiveSiteId] = useState(() => {
        return parseInt(localStorage.getItem('activeSiteId')) || null;
    });

    useEffect(() => {
        getSites().then((data) => {
            setSites(data);
            if (!activeSiteId && data.length > 0) {
                setActiveSiteId(data[0].id);
                localStorage.setItem('activeSiteId', data[0].id);
            }
        }).catch(() => { });
    }, []);

    const selectSite = (id) => {
        setActiveSiteId(id);
        localStorage.setItem('activeSiteId', id);
    };

    return { sites, activeSiteId, selectSite };
}
