"use client";
import { useId, useState, useRef, useEffect } from "react";
import { passwordError, passwordPolicy } from "@/domain/password-policy";

export function NewPasswordField({
  label = "New password",
  onChange,
}: {
  label?: string;
  onChange?: (value: string) => void;
}) {
  const id = useId();
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const form = input.current?.form;
    const reset = () => {
      setValue("");
      setTouched(false);
      onChange?.("");
    };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [onChange]);
  const error = touched ? passwordError(value) : "";
  return (
    <label htmlFor={id}>
      {label}
      <input
        ref={input}
        aria-label={label}
        id={id}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={passwordPolicy.minimum}
        maxLength={passwordPolicy.maximum}
        aria-describedby={`${id}-help`}
        aria-invalid={!!error}
        onBlur={() => setTouched(true)}
        onChange={(e) => {
          setValue(e.target.value);
          setTouched(true);
          onChange?.(e.target.value);
        }}
      />
      <small
        id={`${id}-help`}
        className={error ? "field-error" : "field-help"}
        aria-live="polite"
      >
        {error ||
          (value
            ? "Password length meets the requirement."
            : `Use ${passwordPolicy.minimum}–${passwordPolicy.maximum} characters.`)}
      </small>
    </label>
  );
}
