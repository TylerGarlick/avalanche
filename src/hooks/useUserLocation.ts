'use client';

import { useState, useEffect, useCallback } from 'react';

export interface UserLocation {
  lat: number;
  lng: number;
  accuracy: number | null;
  loading: boolean;
  error: string | null;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'unknown';
}

/**
 * Hook to get user's current location using the browser Geolocation API
 * Falls back to IP-based approximate location if geolocation fails
 */
export function useUserLocation() {
  const [location, setLocation] = useState<UserLocation>({
    lat: 0,
    lng: 0,
    accuracy: null,
    loading: true,
    error: null,
    permissionStatus: 'unknown',
  });

  const requestLocation = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocation((prev) => ({
        ...prev,
        loading: false,
        error: 'Geolocation is not supported by your browser',
        permissionStatus: 'unknown',
      }));
      return;
    }

    // Check permission status if available
    if (navigator.permissions) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        if (result.state === 'denied') {
          setLocation((prev) => ({
            ...prev,
            loading: false,
            error: 'Location permission denied. Please enable location access in your browser settings.',
            permissionStatus: 'denied',
          }));
          return;
        }
        if (result.state === 'granted') {
          setLocation((prev) => ({ ...prev, permissionStatus: 'granted' }));
        }
      } catch {
        // Permissions API not fully supported, continue with geolocation
      }
    }

    // Set loading state
    setLocation((prev) => ({ ...prev, loading: true }));

    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            loading: false,
            error: null,
            permissionStatus: 'granted',
          });
          resolve();
        },
        async (error) => {
          // Fallback to IP-based location
          try {
            const response = await fetch('https://ipapi.co/json/', {
              signal: AbortSignal.timeout(5000),
            });
            if (response.ok) {
              const data = await response.json();
              if (data.latitude && data.longitude) {
                setLocation({
                  lat: data.latitude,
                  lng: data.longitude,
                  accuracy: null,
                  loading: false,
                  error: `Approximate location (${error.message})`,
                  permissionStatus: 'prompt',
                });
                resolve();
                return;
              }
            }
          } catch {
            // IP fallback failed too
          }

          // Use a default Colorado/Utah region center as last resort
          setLocation({
            lat: 39.5,
            lng: -109.5,
            accuracy: null,
            loading: false,
            error: `Could not determine location. Showing all zones. (${error.message})`,
            permissionStatus: 'prompt',
          });
          resolve();
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes
        }
      );
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      await requestLocation();
    };
    if (!cancelled) {
      init();
    }
    return () => {
      cancelled = true;
    };
  }, [requestLocation]);

  return { ...location, refresh: requestLocation };
}
