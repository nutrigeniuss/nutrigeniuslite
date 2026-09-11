import { LITE_PAYMENT } from '@/config/litePayment';

/** Datos de Yape/BCP/CCI — solo en registro o activación de acceso. */
export default function PaymentTransferDetails({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-2 rounded-2xl bg-[#f7f8fc] p-4 text-sm text-slate-600 ${className}`}>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Datos de transferencia</p>
      <div className="flex flex-wrap gap-2">
        {LITE_PAYMENT.plans.map((plan) => (
          <span
            key={plan.months}
            className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/80"
          >
            {plan.label} {plan.priceLabel}
          </span>
        ))}
      </div>
      <p>
        <span className="font-semibold text-slate-800">Yape:</span> {LITE_PAYMENT.yapePhone}
      </p>
      <p>
        <span className="font-semibold text-slate-800">BCP Soles:</span>{' '}
        <span className="font-mono tabular-nums">{LITE_PAYMENT.bcpAccount}</span>
      </p>
      <p>
        <span className="font-semibold text-slate-800">CCI:</span>{' '}
        <span className="font-mono tabular-nums text-[13px]">{LITE_PAYMENT.cci}</span>
      </p>
      <p className="text-xs text-slate-400">A nombre de {LITE_PAYMENT.holderName}</p>
    </div>
  );
}
