import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Shield } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { calcBMI, normalizeSex, bodyFatRFM } from '@/lib/anthropometry';
import { ACTIVITY_LEVELS } from '@/lib/requerimiento/logic';

type Tab = 'medidas' | 'resultados' | 'calorias';

/** Mifflin-St Jeor local: evita armar birth_date solo para un cálculo de sesión. */
function calcMifflin(weight: number | null, height: number | null, age: number | null, sex: 'M' | 'F' | null): number | null {
  if (weight == null || height == null || age == null || !sex) return null;
  const base = 10 * weight + 6.25 * height - 5 * age;
  return Math.round(sex === 'M' ? base + 5 : base - 161);
}

export default function CalculatorPage() {
  const { profile, signOut, admin } = useAuth();
  const [tab, setTab] = useState<Tab>('medidas');
  const [sex, setSex] = useState<'Femenino' | 'Masculino'>('Femenino');
  const [age, setAge] = useState('30');
  const [weight, setWeight] = useState('70');
  const [height, setHeight] = useState('165');
  const [waist, setWaist] = useState('80');
  const [activityIdx, setActivityIdx] = useState(2);

  const normSex = normalizeSex(sex);
  const ageN = Number(age) || null;
  const w = Number(weight) || null;
  const h = Number(height) || null;
  const waistN = Number(waist) || null;

  const bmi = useMemo(() => calcBMI(w, h, ageN), [w, h, ageN]);
  const fat = useMemo(() => bodyFatRFM(h, waistN, normSex), [h, waistN, normSex]);
  const tmb = useMemo(() => calcMifflin(w, h, ageN, normSex), [w, h, ageN, normSex]);
  const act = ACTIVITY_LEVELS[activityIdx] ?? ACTIVITY_LEVELS[2];
  const get = tmb != null && act ? Math.round(tmb * act.factor) : null;

  const inputClass =
    'w-full rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-sm tabular-nums outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10';
  const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-500';

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="ng-display text-xl font-semibold text-slate-950">NutriGenius Lite</p>
          <p className="text-xs text-slate-400">{profile?.full_name || profile?.email || 'Calculadora'}</p>
        </div>
        <div className="flex items-center gap-2">
          {admin ? (
            <Link to="/admin" className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
              <Shield className="h-3.5 w-3.5" /> Maestro
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
          >
            <LogOut className="h-3.5 w-3.5" /> Salir
          </button>
        </div>
      </header>

      <div className="mb-4 flex gap-1.5 overflow-x-auto rounded-full bg-white/80 p-1 ring-1 ring-slate-200/80">
        {([
          ['medidas', 'Medidas'],
          ['resultados', 'Resultados'],
          ['calorias', 'Calorías'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold transition ${
              tab === key ? 'bg-brand-500 text-white shadow-[0_8px_18px_rgba(59,95,235,0.22)]' : 'text-slate-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'medidas' ? (
        <section className="space-y-4 rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <p className="text-sm font-bold text-slate-900">Datos de cálculo</p>
          <div>
            <p className={labelClass}>Sexo</p>
            <div className="flex gap-2">
              {(['Femenino', 'Masculino'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSex(opt)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    sex === opt ? 'bg-brand-500 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="age">Edad (años)</label>
              <input id="age" className={inputClass} value={age} onChange={(e) => setAge(e.target.value)} inputMode="numeric" />
            </div>
            <div>
              <label className={labelClass} htmlFor="weight">Peso (kg)</label>
              <input id="weight" className={inputClass} value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <label className={labelClass} htmlFor="height">Talla (cm)</label>
              <input id="height" className={inputClass} value={height} onChange={(e) => setHeight(e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <label className={labelClass} htmlFor="waist">Cintura (cm)</label>
              <input id="waist" className={inputClass} value={waist} onChange={(e) => setWaist(e.target.value)} inputMode="decimal" />
            </div>
          </div>
        </section>
      ) : null}

      {tab === 'resultados' ? (
        <section className="grid grid-cols-2 gap-3 rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:grid-cols-3">
          <Metric label="IMC" value={bmi.value ?? '—'} hint={bmi.classification} accent={false} />
          <Metric label="% Grasa (RFM)" value={fat.value ?? '—'} hint={fat.detail} accent />
          <Metric label="Peso" value={w ?? '—'} hint="kg" accent={false} />
        </section>
      ) : null}

      {tab === 'calorias' ? (
        <section className="space-y-4 rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div>
            <p className="text-xs font-semibold text-slate-400">VCT estimado</p>
            <p className="mt-1 text-4xl font-extrabold tabular-nums text-coral-500">
              {get ?? '—'}
              {get != null ? <span className="ml-1 text-sm font-semibold text-slate-400">kcal</span> : null}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              TMB Mifflin {tmb ?? '—'} × {act?.label ?? 'actividad'}
            </p>
          </div>
          <div>
            <p className={labelClass}>Nivel de actividad</p>
            <div className="flex flex-wrap gap-2">
              {ACTIVITY_LEVELS.map((level, idx) => (
                <button
                  key={level.label}
                  type="button"
                  onClick={() => setActivityIdx(idx)}
                  className={`rounded-full px-3.5 py-2 text-xs font-semibold ${
                    activityIdx === idx
                      ? 'bg-brand-500 text-white'
                      : 'bg-white text-slate-600 ring-1 ring-slate-200'
                  }`}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Metric({ label, value, hint, accent }: { label: string; value: string | number; hint?: string | null; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-[#f7f8fc] px-3 py-3">
      <p className="text-[11px] font-semibold text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold tabular-nums ${accent ? 'text-coral-500' : 'text-slate-900'}`}>{value}</p>
      {hint ? <p className="mt-1 truncate text-[11px] font-medium text-slate-400">{hint}</p> : null}
    </div>
  );
}
