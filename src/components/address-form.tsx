"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { emptyAddress, type StructuredAddress } from "@/domain/address";
type Candidate = Pick<
  StructuredAddress,
  "state" | "district" | "postalLocality" | "postalCode"
>;
type Locations = {
  states: string[];
  districts: string[];
  cities: string[];
  localities: {
    pin: string;
    state: string;
    district: string;
    locality: string;
  }[];
};
const countryCodes =
  "AF AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW".split(
    " ",
  );
const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
const countries = countryCodes
  .map((code) => ({ code, name: displayNames.of(code) || code }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function AddressForm({
  title,
  value,
  legacy = "",
  onChange,
  focusId,
  errors = {},
}: {
  title: string;
  value?: StructuredAddress;
  legacy?: string;
  onChange: (value: StructuredAddress) => void;
  focusId?: string;
  errors?: Record<string, string>;
}) {
  const id = useId(),
    address = value || emptyAddress;
  const [editing, setEditing] = useState(!!value || !legacy);
  const [lookup, setLookup] = useState<{
    key: string;
    data?: Locations;
    error?: string;
  }>();
  const [retry, setRetry] = useState(0);
  const [pinState, setPinState] = useState<{
    busy?: boolean;
    message?: string;
    candidates?: Candidate[];
  }>({});
  const pinRequest = useRef<AbortController | null>(null);
  const latestAddress = useRef(address);
  const automaticPin = useRef(
    value?.state && value?.district && value?.postalLocality
      ? value.postalCode
      : "",
  );
  useEffect(() => {
    latestAddress.current = address;
  }, [address]);
  const key = new URLSearchParams({
    state: address.state,
    district: address.district,
  }).toString();
  useEffect(() => {
    if (address.country !== "IN" || !editing) return;
    const controller = new AbortController();
    fetch(`/api/member/locations?${key}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw Error(data.error || "Unable to load locations.");
        if (!controller.signal.aborted) setLookup({ key, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setLookup({ key, error: error.message });
      });
    return () => controller.abort();
  }, [key, address.country, editing, retry]);
  useEffect(() => () => pinRequest.current?.abort(), []);
  const current = lookup?.key === key ? lookup : undefined;
  const data = current?.data,
    loading = !current && address.country === "IN";
  function change(field: keyof StructuredAddress, text: string) {
    if (field !== "line1" && field !== "line2") {
      pinRequest.current?.abort();
      setPinState({});
    }
    let next = { ...address, [field]: text };
    if (field === "country")
      next = {
        ...emptyAddress,
        country: text,
        line1: address.line1,
        line2: address.line2,
      };
    if (field === "state")
      next = {
        ...next,
        district: "",
        city: "",
        postalLocality: "",
        postalCode: "",
      };
    if (field === "district")
      next = { ...next, city: "", postalLocality: "", postalCode: "" };
    if (
      field === "postalLocality" &&
      !data?.localities.some(
        (r) => r.locality === text && r.pin === address.postalCode,
      )
    )
      next = { ...next, postalCode: "" };
    if (field === "postalCode" && address.country === "IN")
      next = { ...next, state: "", district: "", city: "", postalLocality: "" };
    onChange(next);
  }
  const resolvePin = useCallback(async () => {
    const requested = latestAddress.current;
    pinRequest.current?.abort();
    const controller = new AbortController();
    pinRequest.current = controller;
    setPinState({ busy: true, message: "Looking up postal localities…" });
    try {
      const response = await fetch(
        `/api/member/locations?pin=${encodeURIComponent(requested.postalCode)}`,
        { signal: controller.signal },
      );
      const result: Locations & { error?: string } = await response.json();
      if (!response.ok) throw Error(result.error || "PIN lookup failed.");
      if (controller.signal.aborted) return;
      const candidates: Candidate[] = result.localities.map((r) => ({
        state: r.state,
        district: r.district,
        postalLocality: r.locality,
        postalCode: r.pin,
      }));
      if (candidates.length === 1) {
        onChange({ ...latestAddress.current, city: "", ...candidates[0] });
        setPinState({
          message:
            "State, District and postal locality filled from PIN. Review these details.",
        });
      } else {
        const states = [...new Set(candidates.map((c) => c.state))],
          districts = [...new Set(candidates.map((c) => c.district))];
        if (states.length === 1 && districts.length === 1)
          onChange({
            ...latestAddress.current,
            state: states[0],
            district: districts[0],
            city: "",
            postalLocality: "",
          });
        setPinState({
          candidates,
          message: candidates.length
            ? "This PIN serves multiple postal localities. Choose your locality below."
            : "No postal locality found for this PIN. Check the number and try again.",
        });
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setPinState({
          message:
            error instanceof Error
              ? error.message
              : "PIN lookup failed. Try again.",
        });
    }
  }, [onChange]);
  useEffect(() => {
    if (
      !editing ||
      address.country !== "IN" ||
      !/^[1-9]\d{5}$/.test(address.postalCode)
    ) {
      automaticPin.current = "";
      return;
    }
    if (automaticPin.current === address.postalCode) return;
    automaticPin.current = address.postalCode;
    if (address.state && address.district && address.postalLocality) return;
    void resolvePin();
  }, [
    address.country,
    address.postalCode,
    address.state,
    address.district,
    address.postalLocality,
    editing,
    resolvePin,
  ]);
  function input(
    field: keyof StructuredAddress,
    label: string,
    compact = false,
  ) {
    const error =
      errors[field] ||
      (field === "postalCode" &&
      address.country === "IN" &&
      address.postalCode &&
      !/^[1-9]\d{5}$/.test(address.postalCode)
        ? "Enter a six-digit PIN."
        : "");
    return (
      <label
        className={compact ? "" : "form-span"}
        htmlFor={
          field === "line1" ? focusId || `${id}-${field}` : `${id}-${field}`
        }
      >
        {label}
        <input
          id={
            field === "line1" ? focusId || `${id}-${field}` : `${id}-${field}`
          }
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-${field}-error` : undefined}
          value={address[field]}
          maxLength={field === "line1" || field === "line2" ? 200 : 120}
          autoComplete={
            field === "line1"
              ? "address-line1"
              : field === "line2"
                ? "address-line2"
                : field === "postalCode"
                  ? "postal-code"
                  : "off"
          }
          inputMode={
            field === "postalCode" && address.country === "IN"
              ? "numeric"
              : undefined
          }
          onChange={(e) => change(field, e.target.value)}
        />
        {error && (
          <small id={`${id}-${field}-error`} className="field-error">
            {error}
          </small>
        )}
      </label>
    );
  }
  function select(
    field: "state" | "district" | "city" | "postalLocality",
    label: string,
    options: string[],
    enabled: boolean,
  ) {
    return (
      <label htmlFor={`${id}-${field}`}>
        {label}
        <select
          id={`${id}-${field}`}
          value={address[field]}
          aria-invalid={!!errors[field]}
          aria-describedby={errors[field] ? `${id}-${field}-error` : undefined}
          disabled={!enabled || loading || !!current?.error}
          onChange={(e) => change(field, e.target.value)}
        >
          <option value="">
            {!enabled
              ? `Choose ${field === "district" ? "State" : "District"} first`
              : loading
                ? "Loading…"
                : options.length
                  ? "Select…"
                  : "No matching locations"}
          </option>
          {address[field] && !options.includes(address[field]) && (
            <option value={address[field]}>{address[field]}</option>
          )}
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        {errors[field] && (
          <small id={`${id}-${field}-error`} className="field-error">
            {errors[field]}
          </small>
        )}
      </label>
    );
  }
  return (
    <section className="address-section form-span" aria-label={title}>
      <div className="form-section-heading">
        <h3>{title}</h3>
        <p>Private · used for correspondence and verification</p>
      </div>
      {!editing ? (
        <div className="legacy-address">
          <p>{legacy}</p>
          <button
            type="button"
            className="button secondary"
            onClick={() => setEditing(true)}
          >
            Update structured address
          </button>
          <small>
            Your saved address stays unchanged until you enter a replacement.
          </small>
        </div>
      ) : (
        <>
          {legacy && !value && (
            <p className="notice">
              Previous address: {legacy}. Enter its parts below; no locations
              have been guessed.
            </p>
          )}
          <h4>
            {address.country === "IN" ? "Start with your PIN" : "Location"}
          </h4>
          <div className="form-grid address-location-grid">
            <label htmlFor={`${id}-country`}>
              Country
              <select
                id={`${id}-country`}
                value={address.country}
                onChange={(e) => change("country", e.target.value)}
              >
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {input(
              "postalCode",
              address.country === "IN" ? "PIN" : "Postal code",
              true,
            )}
            {address.country === "IN" && (
              <div className="postal-assistance form-span">
                <button
                  type="button"
                  className="button secondary"
                  disabled={
                    !/^[1-9]\d{5}$/.test(address.postalCode) || pinState.busy
                  }
                  onClick={resolvePin}
                >
                  {pinState.busy ? "Looking up…" : "Fill from PIN"}
                </button>
                <small>
                  Enter your six-digit PIN to fill State and District
                  automatically. Choose a postal locality if prompted, then
                  enter your house, building or colony below.
                </small>
              </div>
            )}
            {address.country === "IN" ? (
              <>
                {select(
                  "state",
                  "State / Union Territory",
                  data?.states || [],
                  true,
                )}
                {select(
                  "district",
                  "District",
                  data?.districts || [],
                  !!address.state,
                )}
                {select(
                  "city",
                  "City (optional)",
                  data?.cities || [],
                  !!address.district,
                )}
                {select(
                  "postalLocality",
                  "Postal locality",
                  [
                    ...new Set(data?.localities.map((r) => r.locality) || []),
                  ].sort(),
                  !!address.district,
                )}
                {data && address.district && !data.cities.length && (
                  <small className="field-help form-span">
                    City aliases are not available for this district. Select
                    your postal locality; city is optional.
                  </small>
                )}
              </>
            ) : (
              <>
                {input("state", "State / region", true)}
                {input("district", "District (optional)", true)}
                {input("city", "City / locality", true)}
              </>
            )}
          </div>
          {address.country === "IN" && (
            <>
              {loading && <p role="status">Loading location choices…</p>}
              {current?.error && (
                <p role="alert">
                  {current.error}{" "}
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setRetry((v) => v + 1)}
                  >
                    Retry location lookup
                  </button>
                </p>
              )}
              {data &&
                address.postalLocality &&
                data.localities.some(
                  (r) => r.locality === address.postalLocality,
                ) && (
                  <p className="field-help">
                    PINs for this postal locality:{" "}
                    {[
                      ...new Set(
                        data.localities
                          .filter((r) => r.locality === address.postalLocality)
                          .map((r) => r.pin),
                      ),
                    ].join(", ")}
                  </p>
                )}
              {data &&
                address.postalLocality &&
                address.postalCode &&
                !data.localities.some(
                  (r) =>
                    r.locality === address.postalLocality &&
                    r.pin === address.postalCode,
                ) && (
                  <p className="field-error" role="alert">
                    This PIN does not match the selected postal locality. Use
                    Fill from PIN or correct your selections.
                  </p>
                )}
              <p role="status">{pinState.message}</p>
              {!!pinState.candidates?.length && (
                <label>
                  Postal locality for this PIN
                  <select
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const candidate =
                        pinState.candidates?.[Number(e.target.value)];
                      if (candidate) {
                        onChange({ ...address, city: "", ...candidate });
                        setPinState({
                          message:
                            "Location filled from PIN. Review these details.",
                        });
                      }
                    }}
                  >
                    <option value="">Choose your locality…</option>
                    {pinState.candidates.map((c, i) => (
                      <option
                        value={i}
                        key={`${c.state}-${c.district}-${c.postalLocality}`}
                      >
                        {c.postalLocality} · {c.district} · {c.state}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}
          <h4>Address</h4>
          <div className="form-grid">
            {input("line1", "Address Line 1")}
            {input("line2", "Address Line 2 / locality (optional)")}
          </div>
        </>
      )}
    </section>
  );
}
