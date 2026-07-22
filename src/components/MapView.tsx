// ga-frontend/src/components/MapView.tsx
import { useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { MIXED_CLUSTER_COLOR } from '../utils/partners';

export interface MapMarker {
  id: string;
  title: string;
  subtitle?: string;
  position: [number, number];
  priority?: string;
  type: 'Saha' | 'Nokta';
  /** Firma rengi (hex). Yoksa varsayılan turuncu / mavi. */
  partnerColor?: string;
  partnerName?: string;
}

/** Türkiye geneli — MainLayout ile aynı varsayılan */
export const DEFAULT_MAP_CENTER: [number, number] = [37.420, 31.848];
const DEFAULT_MAP_ZOOM = 6;
const FOCUS_ZOOM = 14;

interface MapViewProps {
  markers: MapMarker[];
  center?: [number, number];
  focusedMarkerPosition: [number, number] | null;
  /** Sayfa (route) değişince — haritayı varsayılan lat/lng + zoom'a çeker */
  viewResetKey?: string;
}

type PartnerAwareMarker = L.Marker & { __partnerColor?: string };

function MapController({
  focusedPosition,
  viewResetKey,
}: {
  focusedPosition: [number, number] | null;
  viewResetKey?: string;
}) {
  const map = useMap();

  useEffect(() => {
    if (viewResetKey == null) return;
    map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, { animate: false });
  }, [viewResetKey, map]);

  useEffect(() => {
    if (focusedPosition) {
      map.flyTo(focusedPosition, FOCUS_ZOOM, { duration: 1.5 });
    }
  }, [focusedPosition, map]);

  return null;
}

function markerDotHtml(color: string, pulse: boolean) {
  const pulseClass = pulse ? ' animate-pulse' : '';
  return `<div style="background-color:${color}" class="w-4 h-4 rounded-full border-2 border-white shadow-md transition-transform duration-200 hover:scale-125${pulseClass}"></div>`;
}

function clusterHtml(count: number, color: string) {
  const textColor = color === '#000000' ? '#FFFFFF' : '#1A233A';
  return `<div style="background-color:${color};color:${textColor}" class="flex items-center justify-center w-10 h-10 rounded-full font-bold border-2 border-white shadow-2xl text-sm transition-all duration-200 hover:scale-110 active:scale-95">${count}</div>`;
}

function MarkerClusterGroup({ markers }: { markers: MapMarker[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const clusterGroup: L.MarkerClusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      animate: true,
      iconCreateFunction: (cluster: L.MarkerCluster) => {
        const childCount = cluster.getChildCount();
        const childMarkers = cluster.getAllChildMarkers() as PartnerAwareMarker[];
        const colors = childMarkers
          .map((m) => m.__partnerColor)
          .filter((c): c is string => Boolean(c));
        const unique = [...new Set(colors)];
        const color =
          unique.length === 1 ? unique[0] : unique.length > 1 ? MIXED_CLUSTER_COLOR : '#F97316';

        return L.divIcon({
          html: clusterHtml(childCount, color),
          className: 'custom-cluster-icon-layout',
          iconSize: L.point(40, 40),
        });
      },
    });

    markers.forEach((marker) => {
      if (marker.position && marker.position[0] && marker.position[1]) {
        const color =
          marker.partnerColor ||
          (marker.type === 'Saha' ? '#F97316' : '#2563EB');

        const leafletMarker = L.marker(marker.position, {
          icon: L.divIcon({
            html: markerDotHtml(color, marker.type === 'Nokta'),
            className: marker.type === 'Saha' ? 'custom-saha-layout' : 'custom-nokta-layout',
            iconSize: L.point(16, 16),
          }),
        }) as PartnerAwareMarker;

        leafletMarker.__partnerColor = marker.partnerColor || color;

        const partnerBadge = marker.partnerName
          ? `<span class="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-md mt-1" style="background-color:${color}22;color:${color === '#000000' ? '#334155' : color}">${marker.partnerName}</span>`
          : '';

        leafletMarker.bindPopup(`
          <div class="p-1 font-sans text-xs">
            <h4 class="font-bold text-slate-800 text-sm mb-0.5">🎯 ${marker.title}</h4>
            ${marker.subtitle ? `<p class="text-slate-500 font-medium mb-1">${marker.subtitle}</p>` : ''}
            <span class="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
              marker.type === 'Saha' ? 'bg-orange-100 text-brand-orange' : 'bg-blue-100 text-blue-600'
            }">${marker.type === 'Saha' ? 'İŞ EMRİ / EKİP' : 'SAHA NOKTASI'}</span>
            ${partnerBadge}
          </div>
        `);

        clusterGroup.addLayer(leafletMarker);
      }
    });

    map.addLayer(clusterGroup);

    return () => {
      map.removeLayer(clusterGroup);
    };
  }, [markers, map]);

  return null;
}

export default function MapView({
  markers,
  center = DEFAULT_MAP_CENTER,
  focusedMarkerPosition,
  viewResetKey,
}: MapViewProps) {
  return (
    <MapContainer
      center={center}
      zoom={DEFAULT_MAP_ZOOM}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MarkerClusterGroup markers={markers} />

      <MapController
        focusedPosition={focusedMarkerPosition}
        viewResetKey={viewResetKey}
      />
    </MapContainer>
  );
}
