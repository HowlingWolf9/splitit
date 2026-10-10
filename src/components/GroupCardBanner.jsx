import React from 'react';
import { Plane, ClipboardList, Home, Heart, Sparkles, Users, Layers, Briefcase, Coffee } from 'lucide-react';

// Render icon function
const renderGroupIcon = (icon, type, iconSize) => {
    const iconKey = (icon || type || '').toLowerCase();
    const props = { size: iconSize, color: "#ffffff", strokeWidth: 2.4 };
    if (iconKey === 'plane' || iconKey === 'trip') return <Plane {...props} />;
    if (iconKey === 'clipboard' || iconKey === 'project') return <ClipboardList {...props} />;
    if (iconKey === 'home' || iconKey === 'apartment') return <Home {...props} />;
    if (iconKey === 'heart' || iconKey === 'couple') return <Heart {...props} />;
    if (iconKey === 'sparkles' || iconKey === 'event') return <Sparkles {...props} />;
    if (iconKey === 'briefcase' || iconKey === 'work') return <Briefcase {...props} />;
    if (iconKey === 'coffee' || iconKey === 'food') return <Coffee {...props} />;
    if (iconKey === 'nongroup' || iconKey === 'layers') return <Layers {...props} />;
    return <Users {...props} />;
};

export default function GroupCardBanner({ type = 'other', icon = 'users', color = '#10b981', size = 68 }) {

    // Themed facet gradient configurations
    const getFacetStyle = () => {
        const key = (type || '').toLowerCase();
        if (key === 'trip') {
            return {
                primary: '#10b981',
                secondary: '#059669',
                dark: '#047857',
                light: '#34d399',
            };
        }
        if (key === 'project') {
            return {
                primary: '#f97316',
                secondary: '#ea580c',
                dark: '#c2410c',
                light: '#fb923c',
            };
        }
        if (key === 'home') {
            return {
                primary: '#3b82f6',
                secondary: '#2563eb',
                dark: '#1d4ed8',
                light: '#60a5fa',
            };
        }
        if (key === 'couple') {
            return {
                primary: '#ec4899',
                secondary: '#db2777',
                dark: '#be185d',
                light: '#f472b6',
            };
        }
        if (key === 'event') {
            return {
                primary: '#8b5cf6',
                secondary: '#7c3aed',
                dark: '#6d28d9',
                light: '#a78bfa',
            };
        }
        if (key === 'nongroup') {
            return {
                primary: '#10b981',
                secondary: '#f97316',
                dark: '#8b5cf6',
                light: '#06b6d4',
                multi: true
            };
        }
        // Fallback or custom color
        return {
            primary: color || '#14b8a6',
            secondary: '#0f766e',
            dark: '#115e59',
            light: '#2dd4bf'
        };
    };

    const palette = getFacetStyle();

    return (
        <div
            style={{
                width: `${size}px`,
                height: `${size * 1.3}px`,
                minWidth: `${size}px`,
                borderRadius: '12px',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                background: palette.dark,
            }}
        >
            {/* Geometric faceted background */}
            <svg
                width="100%"
                height="100%"
                viewBox="0 0 100 130"
                preserveAspectRatio="none"
                style={{ position: 'absolute', top: 0, left: 0 }}
            >
                {palette.multi ? (
                    // Multicolor faceted diamond for Non-group
                    <>
                        {/* Top Left facet - Teal */}
                        <polygon points="0,0 100,0 50,55 0,35" fill="#14b8a6" opacity="0.9" />
                        {/* Top Right facet - Orange */}
                        <polygon points="100,0 100,75 50,55" fill="#ea580c" opacity="0.95" />
                        {/* Center Diamond facet - Amber */}
                        <polygon points="50,55 100,75 50,110 0,85" fill="#f59e0b" opacity="0.85" />
                        {/* Bottom facet - Purple */}
                        <polygon points="0,35 50,55 0,85" fill="#06b6d4" opacity="0.95" />
                        <polygon points="0,85 50,110 100,75 100,130 0,130" fill="#7c3aed" opacity="0.9" />
                    </>
                ) : (
                    // Dynamic angled facets
                    <>
                        <polygon points="0,0 100,0 60,65 0,45" fill={palette.light} opacity="0.85" />
                        <polygon points="100,0 100,90 60,65" fill={palette.primary} opacity="0.95" />
                        <polygon points="0,45 60,65 0,100" fill={palette.secondary} opacity="0.9" />
                        <polygon points="0,100 60,65 100,90 100,130 0,130" fill={palette.dark} opacity="1" />
                        <polygon points="30,70 100,90 40,130" fill={palette.primary} opacity="0.5" />
                    </>
                )}
            </svg>

            {/* Glowing Icon Container */}
            <div
                style={{
                    position: 'relative',
                    zIndex: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
                }}
            >
                {renderGroupIcon(icon, type, size * 0.44)}
            </div>
        </div>
    );
}
