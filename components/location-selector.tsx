'use client';

import React, { useState } from 'react';
import { usePlacesWidget } from 'react-google-autocomplete';
import { MapPin, Search, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface LocationSelectorProps {
    apiKey: string;
    onLocationSelect: (location: { address: string; lat: number; lng: number } | null, text?: string) => void;
    defaultValue?: string;
}

export function LocationSelector({ apiKey, onLocationSelect, defaultValue }: LocationSelectorProps) {
    const [inputValue, setInputValue] = useState(defaultValue || '');
    const [hasError, setHasError] = useState(false);

    const { ref } = usePlacesWidget({
        apiKey: apiKey,
        onPlaceSelected: (place) => {
            if (place.geometry && place.geometry.location) {
                setHasError(false);
                onLocationSelect({
                    address: place.formatted_address || place.name || '',
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng(),
                });
                setInputValue(place.formatted_address || place.name || '');

                // Force closure of the dropdown by blurring the input
                if (ref && 'current' in ref && ref.current) {
                    (ref.current as HTMLInputElement).blur();
                }
            }
        },
        options: {
            types: ['geocode'],
            componentRestrictions: { country: 'br' },
        },
    });

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            // Fallback to text search if no prediction was selected
            onLocationSelect(null, inputValue);
        }
    };

    return (
        <div className="relative w-full space-y-2">
            <style jsx global>{`
                .pac-container {
                    z-index: 9999 !important;
                    border-radius: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    background-color: #1a1a1a !important;
                    color: white !important;
                    margin-top: 4px;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
                }
                .pac-item {
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                    padding: 8px 12px;
                    color: #ccc !important;
                    cursor: pointer;
                }
                .pac-item:hover {
                    background-color: rgba(255, 255, 255, 0.05) !important;
                }
                .pac-item-query {
                    color: white !important;
                }
            `}</style>

            <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-primary z-10" />
                <Input
                    ref={ref}
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        if (e.target.value === '') setHasError(false);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Busque um endereço ou Enter para busca por texto..."
                    className="pl-9 h-10 w-full bg-background border-muted-foreground/20 focus-visible:ring-primary"
                />
                <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            </div>

            {/* Error Message for API Key issues */}
            <div id="gmaps-error-detector" className="hidden text-[10px] text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                <span>Erro na API do Google Maps. Usando busca por texto.</span>
            </div>

            <script dangerouslySetInnerHTML={{
                __html: `
                // Detect Google Maps errors
                window.gm_authFailure = function() {
                    const err = document.getElementById('gmaps-error-detector');
                    if (err) err.style.display = 'flex';
                };
            ` }} />
        </div>
    );
}
