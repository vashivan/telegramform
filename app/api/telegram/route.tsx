import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const message = data.message;

    if (!message) return NextResponse.json({ ok: true });

    const chatId = message.chat.id;
    const firstName = message.from?.first_name || "";
    const username = message.from?.username || "";

    const formUrl = `https://k-art.vercel.app/form?tg_chat_id=${chatId}&tg_username=${username}`;

    // Відповідаємо користувачу
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `👋 Hi ${firstName}! Welcome to K-Art.\n\nPlease fill your application form below 👇`,
        reply_markup: {
          inline_keyboard: [[{ text: "📝 Fill Application Form", url: formUrl }]],
        },
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Telegram webhook error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
