import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
  type HTMLAttributes,
} from 'react';

type PopoverCtx = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const Ctx = createContext<PopoverCtx | null>(null);

export function Popover({
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = (v: boolean) => {
    onOpenChange?.(v);
    if (controlledOpen === undefined) setUncontrolled(v);
  };
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return (
    <Ctx.Provider value={value}>
      <div className="relative inline-flex">{children}</div>
    </Ctx.Provider>
  );
}

export function PopoverTrigger({
  children,
  asChild: _asChild,
  ...rest
}: HTMLAttributes<HTMLButtonElement> & { asChild?: boolean; children: ReactNode }) {
  const ctx = useContext(Ctx);
  return (
    <button type="button" {...rest} onClick={(e) => { rest.onClick?.(e); ctx?.setOpen(!ctx.open); }}>
      {children}
    </button>
  );
}

export function PopoverContent({
  children,
  className = '',
  align: _align,
  side: _side,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { align?: string; side?: string; children: ReactNode }) {
  const ctx = useContext(Ctx);
  if (!ctx?.open) return null;
  return (
    <div
      className={`absolute z-50 mt-2 min-w-[12rem] rounded-xl border border-slate-200 bg-white p-3 shadow-lg ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
