import { ACCESS_DAY_OPTIONS, type AccessDays } from '@/lib/adminAccess';

type Props = {
  value: AccessDays;
  onChange: (value: AccessDays) => void;
  disabled?: boolean;
};

export default function AccessDurationPicker({ value, onChange, disabled }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {ACCESS_DAY_OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={String(option.value)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={active ? 'ng-pill ng-pill-active' : 'ng-pill ng-pill-idle'}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
