export const PHOTO_CATEGORY_ISG = 'ISG' as const;
export const PHOTO_CATEGORY_OPERASYON = 'OPERASYON' as const;

export type WorkOrderPhotoCategory = typeof PHOTO_CATEGORY_ISG | typeof PHOTO_CATEGORY_OPERASYON;

/** Mobile ile aynı kategori başına üst sınır */
export const PHOTO_LIMITS: Record<WorkOrderPhotoCategory, number> = {
  [PHOTO_CATEGORY_ISG]: 10,
  [PHOTO_CATEGORY_OPERASYON]: 30,
};
