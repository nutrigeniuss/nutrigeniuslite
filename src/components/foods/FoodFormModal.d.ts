import type { CatalogFoodRecord } from '@/lib/catalogData';
import type { FC } from 'react';

type FoodFormModalProps = {
  food?: CatalogFoodRecord | Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
  nutritionistId?: string;
  /** Si se define, reemplaza saveFood/createFoodRevision (p. ej. Maestro incorporar). */
  onSubmitOverride?: (data: CatalogFoodRecord) => Promise<void>;
  title?: string;
};

declare const FoodFormModal: FC<FoodFormModalProps>;
export default FoodFormModal;
