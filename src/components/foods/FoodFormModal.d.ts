import type { CatalogFoodRecord } from '@/lib/catalogData';
import type { FC } from 'react';

type FoodFormModalProps = {
  food?: CatalogFoodRecord | Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
  nutritionistId?: string;
};

declare const FoodFormModal: FC<FoodFormModalProps>;
export default FoodFormModal;
