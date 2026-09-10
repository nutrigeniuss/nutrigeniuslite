// Tipos compartidos del editor de dietas.
// Conviene extender este archivo cuando se separen más bloques de DietCreator,
// para mantener contratos únicos entre impresión, cabecera y editor principal.

export type DietEditorItem = {
  id?: string;
  name?: string;
  unit?: string;
  quantity?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sodium?: number;
  is_recipe?: boolean;
  [key: string]: unknown;
};

export type DietEditorMeal = {
  id: string;
  name: string;
  time?: string;
  notes?: string;
  items: DietEditorItem[];
  [key: string]: unknown;
};