export function TextField(props: {
  label: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  placeholder?: string;
  type?: string;
  step?: string;
}) {
  return (
    <div className="field">
      <span className="field-label">{props.label}</span>
      <input
        name={props.name}
        type={props.type ?? "text"}
        defaultValue={props.defaultValue ?? ""}
        required={props.required}
        placeholder={props.placeholder}
        step={props.step}
      />
    </div>
  );
}

export function TextAreaField(props: {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
}) {
  return (
    <div className="field">
      <span className="field-label">{props.label}</span>
      <textarea name={props.name} defaultValue={props.defaultValue ?? ""} placeholder={props.placeholder} rows={3} />
    </div>
  );
}

export function SelectField(props: {
  label: string;
  name: string;
  defaultValue?: string;
  options: string[];
}) {
  return (
    <div className="field">
      <span className="field-label">{props.label}</span>
      <select name={props.name} defaultValue={props.defaultValue}>
        {props.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return <div className="banner danger">{decodeURIComponent(message)}</div>;
}

export function SuccessBanner({ show, message }: { show?: string; message: string }) {
  if (!show) return null;
  return <div className="banner success">{message}</div>;
}
