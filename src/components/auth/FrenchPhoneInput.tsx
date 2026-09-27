"use client";

interface FrenchPhoneInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  /** Marks the number as refused, for assistive tech. */
  invalid?: boolean;
  /** Id of the element explaining the refusal. */
  describedBy?: string;
  /** `${prefix}-phone` on the input, `${prefix}-country` on the dial-code segment. */
  testIdPrefix?: string;
}

/**
 * One control, two segments: SMS codes only ever leave through a French
 * gateway, so the dial code is stated rather than chosen. The border belongs to
 * the wrapper, not to either segment. Shared by sign-in and the verified
 * phone-number change in Settings › Profile.
 */
export function FrenchPhoneInput({
  id,
  value,
  onChange,
  disabled,
  placeholder,
  autoFocus,
  invalid,
  describedBy,
  testIdPrefix = "login",
}: FrenchPhoneInputProps) {
  return (
    <div
      className="flex focus-within:border-[color:var(--ink)] focus-within:shadow-[var(--shadow-focus)]"
      style={{
        background: "var(--card-paper)",
        border: "1px solid var(--line-2)",
        borderRadius: 10,
      }}
    >
      <span
        data-testid={`${testIdPrefix}-country`}
        className="flex flex-shrink-0 items-center gap-1.5 rounded-l-[9px] pl-3 pr-2.5 text-[13px] font-medium"
        style={{
          background: "var(--paper-2)",
          borderRight: "1px solid var(--line-2)",
          color: "var(--ink-2)",
        }}
      >
        FR
        <span className="num text-[12.5px]" style={{ color: "var(--muted)" }}>
          +33
        </span>
      </span>
      <input
        id={id}
        name="phone"
        data-testid={`${testIdPrefix}-phone`}
        type="tel"
        autoComplete="tel-national"
        inputMode="tel"
        required
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        placeholder={placeholder}
        className="num min-w-0 flex-1 bg-transparent px-3 py-[11px] text-[14px] outline-none"
        style={{ color: "var(--ink)" }}
      />
    </div>
  );
}
