import styles from "../../style/Input.module.scss";

type Props = {
  name: string;
  placeholder?: string;
  type?: string;
}

export default function Input({ name, placeholder, type }: Props) {
  return (
    <input
      name={name}
      type={type || "text"}
      placeholder={placeholder}
      required
      className={`${styles.input} pl-2 pr-2 pb-1 border-b-2 border-pink-700 rounded-lg`}
    />
  );
}