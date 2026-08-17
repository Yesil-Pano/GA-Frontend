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
