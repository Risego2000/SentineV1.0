import { useContext } from 'react';
import { SentinelContext } from '../context/SentinelContext';

export const useSentinel = () => {
    const context = useContext(SentinelContext);
    if (context === undefined) {
        throw new Error('useSentinel must be used within a SentinelProvider');
    }
    return context;
};
