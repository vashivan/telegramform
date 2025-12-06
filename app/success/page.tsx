import styles from "../../style/SuccessPage.module.scss";
import Link from "next/link";

export default function Page() {
  return (
    <div className={`${styles.container} bg-pink-100`}>
      <main className={styles.container__main}>
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-black mb-6">
          Thank you for submitting your application!
        </h2>
        <p className="max-w-2xl text-lg text-black mb-10 font-bold">
          Thank you — we’ve received your application.<br />Our team will review it and contact you with the next steps. We appreciate your interest in working with us!
        </p>
        <Link
          href="/"
          className="px-6 py-3 rounded-2xl bg-pink-700 text-white font-bold hover:bg-pink-600 transition">
          Come back to Home Page
        </Link>
      </main>
    </div>
  )
}