import { useEffect, useState } from 'react';
import { ChevronRight, Search, Utensils, X } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { normalizeSearchText } from '@/lib/searchText';
import type { DietMeal, DietPlan } from './patientDietTypes';
import { logger, errorMessage } from '@/lib/logger';

type DietCatalogModalProps = {
  onClose: () => void;
  onSelect: (plan: DietPlan) => void | Promise<void>;
};

const calcCalories = (meals: DietMeal[] | undefined): number => {
  let total = 0;

  (meals || []).forEach((meal) => {
    (meal.items || []).forEach((item) => {
      total += (item.calories || 0) * (item.quantity || 1);
    });
  });

  return Math.round(total);
};

export default function DietCatalogModal({ onClose, onSelect }: DietCatalogModalProps) {
  const { user } = useAuth();
  const [plans, setPlans] = useState<DietPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    // El modal consulta solo dietas marcadas como catálogo para no mezclar borradores del paciente.
    const load = async (): Promise<void> => {
      if (!user?.id) {
        setPlans([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from('diet_plans')
        .select('*')
        .eq('nutritionist_id', user.id)
        .eq('is_catalog', true)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        logger.error('Error cargando catálogo de dietas', { error: errorMessage(error) });
        setPlans([]);
        toast({
          title: 'No se pudo cargar el catálogo de dietas',
          description: error.message || 'Intenta nuevamente.',
          variant: 'destructive',
        });
      } else {
        setPlans((data as DietPlan[]) || []);
      }

      setLoading(false);
    };

    void load();
  }, [user?.id]);

  const normalizedSearch = normalizeSearchText(search);
  const filteredPlans = plans.filter(
    (plan) =>
      normalizeSearchText(plan.title).includes(normalizedSearch) || normalizeSearchText(plan.patient_name).includes(normalizedSearch),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden flex flex-col" style={{ maxHeight: '70vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Cargar de catálogo</h3>
            <p className="text-xs text-slate-400 mt-0.5">Selecciona una dieta de Mis Dietas</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
            <X className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              autoFocus
              type="text"
              placeholder="Buscar dieta..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="text-center py-8 text-slate-400 text-sm">Cargando...</div>
          ) : filteredPlans.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              {plans.length === 0 ? 'No tienes dietas guardadas en el catálogo' : 'Sin resultados'}
            </div>
          ) : (
            filteredPlans.map((plan) => {
              const calories = calcCalories(plan.meals);
              const mealCount = plan.meals?.length || 0;

              return (
                <button
                  key={plan.id}
                  onClick={() => void onSelect(plan)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Utensils className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{plan.title}</p>
                    <p className="text-[10px] text-slate-400">
                      {plan.patient_name ? `Para: ${plan.patient_name} · ` : ''}
                      {mealCount} tiempos · ~{calories} kcal/día
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}