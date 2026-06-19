// ga-frontend/src/components/MapView.tsx
import { useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Kümeleme kütüphanesinin CSS ve JS dosyalarını haritaya bağlıyoruz
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';

export interface MapMarker {
  id: string;
  title: string;
  subtitle?: string;
  position: [number, number];
  priority?: string;
  type: 'Saha' | 'Nokta';
}

interface MapViewProps {
  markers: MapMarker[];
  center: [number, number];
  focusedMarkerPosition: [number, number] | null;
}

// Haritayı dinamik olarak uçuran (FlyTo) kamera kontrolcüsü
function MapController({ focusedPosition }: { focusedPosition: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (focusedPosition) {
      map.flyTo(focusedPosition, 14, { duration: 1.5 });
    }
  }, [focusedPosition, map]);
  return null;
}

// 🌀 TEAMER STİLİ: AKILLI KÜMELEME (CLUSTERING) MOTORU
function MarkerClusterGroup({ markers }: { markers: MapMarker[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Kümeleme grubunu ve ayarlarını tanımlıyoruz
    const clusterGroup: L.MarkerClusterGroup = L.markerClusterGroup({
  showCoverageOnHover: false, // Hover olunca etrafındaki alanı çizmesin (UX temizliği)
  spiderfyOnMaxZoom: true,    // En dip yakınlaşmada üst üste binen noktaları örümcek ağı gibi açsın
  animate: true,              // Yumuşak geçiş animasyonları aktif
  
  // 💡 ÇÖZÜM: any yerine orijinal "L.MarkerCluster" tipini veriyoruz
  iconCreateFunction: (cluster: L.MarkerCluster) => {
    const childCount = cluster.getChildCount();
    
    // Videodaki o parlayan kurumsal Teamer Turuncusu yuvarlak sayı rozeti
    return L.divIcon({
      html: `<div class="flex items-center justify-center w-10 h-10 rounded-full bg-brand-orange text-brand-navy font-bold border-2 border-white shadow-2xl text-sm transition-all duration-200 hover:scale-110 active:scale-95">${childCount}</div>`,
      className: 'custom-cluster-icon-layout',
      iconSize: L.point(40, 40)
    });
  }
});

    // 📍 SAHA / İŞ EMRİ NOKTALARI İÇİN MİNİMALİST TURUNCU DAİRE İKONU
    const customSahaIcon = L.divIcon({
      html: `<div class="w-4 h-4 rounded-full bg-brand-orange border-2 border-white shadow-md transition-transform duration-200 hover:scale-125"></div>`,
      className: 'custom-saha-layout',
      iconSize: L.point(16, 16)
    });

    // 📍 İSTASYON / LOKASYON NOKTALARI İÇİN PARLAYAN MAVİ HALKA İKONU
    const customNoktaIcon = L.divIcon({
      html: `<div class="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-lg animate-pulse transition-transform duration-200 hover:scale-125"></div>`,
      className: 'custom-nokta-layout',
      iconSize: L.point(16, 16)
    });

    // Sadece prop olarak gelen canlı markers listesini döngüye alıyoruz (Hayalet veri yok!)
    markers.forEach(marker => {
      if (marker.position && marker.position[0] && marker.position[1]) {
        const leafletMarker = L.marker(marker.position, {
          icon: marker.type === 'Saha' ? customSahaIcon : customNoktaIcon
        });

        // Bilgi Balonu (Tooltip/Popup) Tasarımı
        leafletMarker.bindPopup(`
          <div class="p-1 font-sans text-xs">
            <h4 class="font-bold text-slate-800 text-sm mb-0.5">🎯 ${marker.title}</h4>
            ${marker.subtitle ? `<p class="text-slate-500 font-medium mb-1">${marker.subtitle}</p>` : ''}
            <span class="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
              marker.type === 'Saha' ? 'bg-orange-100 text-brand-orange' : 'bg-blue-100 text-blue-600'
            }">${marker.type === 'Saha' ? 'İŞ EMRİ / EKİP' : 'SAHA NOKTASI'}</span>
          </div>
        `);

        clusterGroup.addLayer(leafletMarker);
      }
    });

    map.addLayer(clusterGroup);

    // Temizlik: Bileşen ekrandan gidince hafıza sızıntısını (memory leak) önlemek için katmanı kaldır
    return () => {
      map.removeLayer(clusterGroup);
    };
  }, [markers, map]);

  return null;
}

export default function MapView({ markers, center, focusedMarkerPosition }: MapViewProps) {
  return (
    <MapContainer 
      center={center} 
      zoom={6} 
      style={{ height: '100%', width: '100%' }}
      zoomControl={false} // Varsayılan çirkin +/- butonlarını uçurduk şefim
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {/* Akıllı Kümeleme Motoru Katmanı */}
      <MarkerClusterGroup markers={markers} />

      {/* Dinamik Kamera Odaklayıcı Katmanı */}
      <MapController focusedPosition={focusedMarkerPosition} />
    </MapContainer>
  );
}