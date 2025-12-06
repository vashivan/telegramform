// app/page.tsx
'use client'

import Link from "next/link";
import styles from "../style/MainPage.module.scss";

export default function Home() {
  return (
    <div className={`${styles.container} bg-pink-100`}>
      <div className={styles.container__black}></div>
      <main className={styles.container__main}>
        <p className="text-black mb-10">
          Welcome to the artist application portal! Click the button below to
          fill out the application form and take the first step towards joining our
          vibrant community of artists.
        </p>
        <Link
          href="/form"
          className="px-6 py-3 rounded-2xl bg-pink-700 text-white font-bold hover:bg-pink-600 transition">
          Fill Out the Application
        </Link>
      </main>
      {/* Footer */}
    </div>
  );
}
