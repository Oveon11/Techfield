/// <reference types="@types/google.maps" />

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: typeof google;
  }
}

const GOOGLE_MAPS_API_KEY =
  typeof import.meta.env.VITE_GOOGLE_MAPS_API_KEY === "string" &&
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY.trim().length > 0
    ? import.meta.env.VITE_GOOGLE_MAPS_API_KEY.trim()
    : null;

let mapsLoaderPromise: Promise<void> | null = null;

function loadMapScript() {
  if (window.google?.maps) {
    return Promise.resolve();
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(new Error("Google Maps n’est pas configuré."));
  }

  if (mapsLoaderPromise) {
    return mapsLoaderPromise;
  }

  mapsLoaderPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-maps="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Impossible de charger Google Maps.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.dataset.googleMaps = "true";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=weekly&libraries=marker,places,geometry`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Impossible de charger Google Maps."));
    document.head.appendChild(script);
  });

  return mapsLoaderPromise;
}

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
  disabledMessage?: string;
}

export function MapView({
  className,
  initialCenter = { lat: 37.7749, lng: -122.4194 },
  initialZoom = 12,
  onMapReady,
  disabledMessage = "La carte n’est pas disponible dans cet environnement.",
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      if (!GOOGLE_MAPS_API_KEY) {
        setLoadError(disabledMessage);
        return;
      }

      try {
        await loadMapScript();
        if (!isMounted || !mapContainer.current || !window.google?.maps) {
          return;
        }

        map.current = new window.google.maps.Map(mapContainer.current, {
          zoom: initialZoom,
          center: initialCenter,
          mapTypeControl: true,
          fullscreenControl: true,
          zoomControl: true,
          streetViewControl: true,
        });
        setLoadError(null);
        onMapReady?.(map.current);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : disabledMessage);
      }
    };

    void init();

    return () => {
      isMounted = false;
    };
  }, [disabledMessage, initialCenter, initialZoom, onMapReady]);

  if (loadError) {
    return (
      <div className={cn("flex h-[320px] w-full items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm leading-6 text-muted-foreground", className)}>
        <div className="max-w-md">
          <p className="font-medium text-foreground">Carte indisponible</p>
          <p className="mt-2">{loadError}</p>
          {!GOOGLE_MAPS_API_KEY ? (
            <p className="mt-2">Ajoutez <code>VITE_GOOGLE_MAPS_API_KEY</code> pour activer l’affichage cartographique.</p>
          ) : null}
        </div>
      </div>
    );
  }

  return <div ref={mapContainer} className={cn("h-[500px] w-full rounded-2xl", className)} />;
}
