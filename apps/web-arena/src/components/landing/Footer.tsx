import { FOOTER } from "@/content/landing";
import s from "./landing.module.css";

export function Footer() {
  return (
    <footer className={s.footer}>
      <span>{FOOTER.left}</span>
      <span>{FOOTER.right}</span>
    </footer>
  );
}
