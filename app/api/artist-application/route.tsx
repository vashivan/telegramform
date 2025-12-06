// // app/api/artist-application/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

// const fontkit = require("fontkit");

/* ---------- BRAND + LAYOUT ---------- */

const BRAND = {
  bg: rgb(0xFF / 255, 0xF7 / 255, 0xFB / 255),        // дуже легкий рожевий фон (#FFF7FB)
  primary: rgb(0x11 / 255, 0x18 / 255, 0x27 / 255),   // текст #111827
  accent: rgb(0xEC / 255, 0x4A / 255, 0x93 / 255),    // акцентний рожево-магентовий (#EC4A93)
  muted: rgb(0x6B / 255, 0x72 / 255, 0x80 / 255),     // вторинний текст
  white: rgb(1, 1, 1),
};

const MARGIN = { top: 60, bottom: 50, left: 48, right: 48 };
const A4: [number, number] = [595.28, 841.89]; // pts

const BODY = 10;
const H1 = 22;
const H2 = 12;
const LINE_H = (size: number) => size * 1.35;

function safe(v: unknown) {
  return (typeof v === "string" ? v : "") || "";
}

async function readPublic(relPath: string): Promise<Uint8Array> {
  const abs = path.join(process.cwd(), "public", relPath);
  return await fs.promises.readFile(abs);
}

function wrapText(text: string, maxWidth: number, font: any, fontSize: number) {
  const words = (text || "—").split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const w of words) {
    const test = line ? line + " " + w : w;
    const width = font.widthOfTextAtSize(test, fontSize);
    if (width <= maxWidth) line = test;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/* ---------- TELEGRAM HELPERS ---------- */
async function processPhotoFile(file: File | null): Promise<Uint8Array | null> {
  if (!file || typeof (file as any)?.arrayBuffer !== "function") return null;

  try {
    const raw = new Uint8Array(await (file as any).arrayBuffer());

    if (!raw.length) {
      console.warn("⚠️ processPhotoFile: empty input buffer, skipping this photo");
      return null;
    }

    const fixed = await sharp(raw).rotate().jpeg({ quality: 88 }).toBuffer();

    if (!fixed.length) {
      console.warn("⚠️ processPhotoFile: sharp produced empty buffer, skipping this photo");
      return null;
    }

    return new Uint8Array(fixed);
  } catch (e) {
    console.error("❌ processPhotoFile sharp error:", e);
    return null; // НЕ кидаємо далі, просто не використовуємо це фото
  }
}


async function SendToArtist(pdfBuffer: Buffer, chatId: string, filename: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const chat = chatId;

  if (!token || !chatId) {
    console.warn("⚠️ Telegram token or chat ID missing (SendToArtist)");
    return;
  }

  const uint8 = new Uint8Array(pdfBuffer);
  const formPdf = new FormData();
  formPdf.append("chat_id", chat);
  formPdf.append("caption", "Here is your application. You can check it out!");
  formPdf.append("document", new Blob([uint8], { type: "application/pdf" }), filename);

  const resPdf = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: "POST",
    body: formPdf,
  });

  if (!resPdf.ok) {
    const text = await resPdf.text().catch(() => "");
    console.error("❌ Telegram sendDocument (artist) error:", resPdf.status, text);
  }

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chat,
        text: `✅ Thank you!\n\nYour application has been received.\nOur manager will contact you as soon as possible.`,
      }),
    });
  } catch (err) {
    console.error("❌ Telegram sendMessage (artist) error:", err);
  }
}

async function sendPhotoAndPdfToTelegram(
  photos: Uint8Array[],
  pdfBuffer: Buffer,
  filename: string,
  caption: string
) {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const chatId = process.env.TELEGRAM_CHAT_ID!;

  if (!token || !chatId) {
    console.warn("⚠️ Telegram token or chat ID missing (manager)");
    return;
  }

  // 1) Відправляємо всі фото (по черзі)
  if (photos && photos.length > 0) {
    for (let i = 0; i < photos.length; i++) {
      const bytes = photos[i];
      const formPhoto = new FormData();
      formPhoto.append("chat_id", chatId);

      // Caption тільки до першого фото, щоб не спамити
      if (i === 0) {
        formPhoto.append("caption", caption);
      }

      formPhoto.append("photo", new Blob([bytes as any], { type: "image/jpeg" }));

      const resPhoto = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        body: formPhoto,
      });

      if (!resPhoto.ok) {
        const text = await resPhoto.text().catch(() => "");
        console.error("❌ Telegram sendPhoto (manager) error:", resPhoto.status, text);
      }
    }
  }

  // 2) PDF менеджеру
  const uint8 = new Uint8Array(pdfBuffer);
  const formPdf = new FormData();
  formPdf.append("chat_id", chatId);
  formPdf.append("document", new Blob([uint8], { type: "application/pdf" }), filename);

  const resPdf = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: "POST",
    body: formPdf,
  });

  if (!resPdf.ok) {
    const text = await resPdf.text().catch(() => "");
    console.error("❌ Telegram sendDocument (manager) error:", resPdf.status, text);
  } else {
    console.log("✅ Photos + PDF sent to Telegram (manager)");
  }
}


/* ---------- TABLE / LAYOUT HELPERS ---------- */

type TableRow = [string, string];

function drawTwoColTable(opts: {
  page: any;
  x: number;
  y: number;
  w: number;
  leftRatio: number;
  rows: TableRow[];
  font: any;
  fontSize: number;
  rowPad: number;
}) {
  const { page, x, y, w, leftRatio, rows, font, fontSize, rowPad } = opts;
  const leftW = w * leftRatio;
  const rightW = w - leftW;
  let cy = y;

  for (let i = 0; i < rows.length; i++) {
    const [k, v] = rows[i];
    const kLines = wrapText(k || "—", leftW, font, fontSize);
    const vLines = wrapText(v || "—", rightW, font, fontSize);
    const lines = Math.max(kLines.length, vLines.length);
    const rowH = lines * LINE_H(fontSize) + rowPad * 2;

    // Ліва колонка — muted label
    for (let li = 0; li < kLines.length; li++) {
      page.drawText(kLines[li], {
        x: x,
        y: cy + rowH - rowPad - (li + 1) * LINE_H(fontSize),
        size: fontSize,
        font,
        color: BRAND.muted,
      });
    }

    // Права колонка — основне значення
    for (let li = 0; li < vLines.length; li++) {
      page.drawText(vLines[li], {
        x: x + leftW + 8,
        y: cy + rowH - rowPad - (li + 1) * LINE_H(fontSize),
        size: fontSize,
        font,
        color: BRAND.primary,
      });
    }

    cy += rowH;
  }

  return cy;
}

/* ---------- ROUTE ---------- */

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const telegramId = (a: string) => {
      const tg = a;
      if (typeof tg === "string") {
        return tg.startsWith("@") ? tg : `@${tg}`;
      }
      return "";
    };

    const instagramId = (a: string) => {
      const inst = a;
      if (typeof inst === "string") {
        return inst.startsWith("@") ? inst : `@${inst}`;
      }
      return "";
    };

    const project = safe(formData.get("project"));
    const fullName = safe(formData.get("fullName"));
    const email = safe(formData.get("email"));
    const phone = safe(formData.get("phone"));
    const telegram = safe(formData.get("telegram"));
    const country = safe(formData.get("country"));
    const city = safe(formData.get("city"));
    const dateOfBirth = safe(formData.get("dateOfBirth"));
    const heightValue = safe(formData.get("height"));
    const weight = safe(formData.get("weight"));
    const waist = safe(formData.get("waist"));
    const bust = safe(formData.get("bust"));
    const instagram = safe(formData.get("instagram"));
    const position = safe(formData.get("position"));
    const experience = safe(formData.get("experience"));
    const education = safe(formData.get("education"));
    const additional = safe(formData.get("additional"));
    const chatId = safe(formData.get("telegramChatId"));
    const couple = safe(formData.get("partnerTelegram"));

    // Main portrait
    const mainPhotoFile = formData.get("photo") as File | null;

    // Additional photos
    const extraPhotoNames = ["photo1", "photo2", "photo3", "photo4", "photo5", "photo6"];
    const extraPhotoFiles = extraPhotoNames.map((name) => formData.get(name) as File | null);

    // Process all photos
    const mainPhotoBytes = await processPhotoFile(mainPhotoFile);
    const extraPhotoBytes = await Promise.all(
      extraPhotoFiles.map((file) => processPhotoFile(file))
    );

    // Масив усіх фото для Телеграму
    const allPhotos: Uint8Array[] = [];
    if (mainPhotoBytes) allPhotos.push(mainPhotoBytes);
    for (const bytes of extraPhotoBytes) {
      if (bytes) allPhotos.push(bytes);
    }


    let fontRegularBytes: Uint8Array, fontBoldBytes: Uint8Array;
    try {
      fontRegularBytes = await readPublic("fonts/Montserrat-VariableFont_wght.ttf");
      fontBoldBytes = await readPublic("fonts/Montserrat-Bold.ttf");
    } catch {
      return NextResponse.json(
        { ok: false, error: "Missing fonts in /public/fonts (Montserrat-Regular/Bold)" },
        { status: 400 }
      );
    }

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const page = pdfDoc.addPage(A4);
    const { width, height } = page.getSize();

    // Фон сторінки — легкий рожевий
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: BRAND.bg,
    });

    const fontRegular = await pdfDoc.embedFont(fontRegularBytes);
    const fontBold = await pdfDoc.embedFont(fontBoldBytes);

    /* ---------- HEADER ---------- */

    let cursorY = height - MARGIN.top;

    // Заголовок
    page.drawText("Artist Application", {
      x: MARGIN.left,
      y: cursorY,
      size: H1,
      font: fontBold,
      color: BRAND.primary,
    });

    cursorY -= H1 + 2;

    const bandX = MARGIN.left;
    const bandW = width - MARGIN.left - MARGIN.right;
    const bandH = 30;
    const bandY = cursorY - bandH;


    const bandText = [
      `Name: ${fullName || "—"}`,
      `Position: ${position || "—"}`,
      `Instagram: ${instagram ? instagramId(instagram) : "—"}`,
      `Telegram: ${telegram ? telegramId(telegram) : "—"}`,
    ].join("   •   ");

    page.drawText(bandText, {
      x: bandX,
      y: bandY + 10,
      size: BODY,
      font: fontRegular,
      color: BRAND.primary,
    });

    /* ---------- MAIN COLUMNS ---------- */

    const colGap = 24;
    const leftW = (width - MARGIN.left - MARGIN.right - colGap) * 0.60;
    const rightW = (width - MARGIN.left - MARGIN.right - colGap) * 0.40;
    const leftX = MARGIN.left;
    const rightX = leftX + leftW + colGap;

    let cursorLeftY = bandY - 28;
    let cursorRightY = bandY - 28;

    // LEFT: Contact & Basics
    page.drawText("Contact & Basics", {
      x: leftX,
      y: cursorLeftY,
      size: H2,
      font: fontBold,
      color: BRAND.accent,
    });

    // cursorLeftY -= H2 + 8;
    cursorLeftY -= H2 + 226;

    cursorLeftY = drawTwoColTable({
      page,
      x: leftX,
      y: cursorLeftY,
      w: leftW,
      leftRatio: 0.32,
      rows: [
        ["Email:", email || "—"],
        ["Phone:", phone || "—"],
        ["Nationality:", country || "—"],
        ["Current city:", city || "—"],
        ["Date of Birth:", dateOfBirth || "—"],
        ["Waist (cm):", waist || "—"],
        ["Bust (cm):", bust || "—"],
        ["Weight (kg):", weight || "—"],
        ["Height (cm):", heightValue || "—"],
      ],
      font: fontRegular,
      fontSize: BODY,
      rowPad: 6,
    });

    // RIGHT: Photo
    page.drawText("Photo", {
      x: rightX,
      y: cursorRightY,
      size: H2,
      font: fontBold,
      color: BRAND.accent,
    });

    cursorRightY -= H2 + 8;

    const photoW = rightW;
    const photoH = 240;

    if (mainPhotoBytes) {
      let img: any = null;
      try {
        img = await pdfDoc.embedJpg(mainPhotoBytes);
      } catch {
        img = await pdfDoc.embedPng(mainPhotoBytes);
      }

      const boxW = photoW;
      const boxH = photoH;
      const ratio = Math.min(boxW / img.width, boxH / img.height);
      const iw = img.width * ratio;
      const ih = img.height * ratio;
      const ix = rightX + (photoW - iw) / 2;
      const iy = cursorRightY - ih;

      page.drawImage(img, { x: ix, y: iy, width: iw, height: ih });
      cursorRightY -= photoH + 12;
    } else {
      page.drawText("No photo attached", {
        x: rightX,
        y: cursorRightY - 14,
        size: 9,
        font: fontRegular,
        color: BRAND.muted,
      });
    }

    cursorRightY -= 40;

    /* ---------- BOTTOM STACK (FULL WIDTH) ---------- */

    let stackY = Math.min(cursorLeftY, cursorRightY) - 32;
    if (stackY < 160) stackY = 160;

    const textMaxW = width - MARGIN.left - MARGIN.right;

    const drawTextBlock = (opts: { title: string; text: string; fontSize?: number }) => {
      const { title, text, fontSize = BODY } = opts;

      page.drawText(title, {
        x: MARGIN.left,
        y: stackY,
        size: H2,
        font: fontBold,
        color: BRAND.accent,
      });

      stackY -= H2 + 6;

      const lines = wrapText(
        text && text.trim() ? text.trim() : "—",
        textMaxW,
        fontRegular,
        fontSize
      );

      for (const ln of lines) {
        page.drawText(ln, {
          x: MARGIN.left,
          y: stackY,
          size: fontSize,
          font: fontRegular,
          color: BRAND.primary,
        });
        stackY -= LINE_H(fontSize);
      }

      stackY -= 24;
    };

    // Experience
    drawTextBlock({
      title: "Experience",
      text: experience || "—",
      fontSize: BODY,
    });

    // Education
    drawTextBlock({
      title: "Education",
      text: education || "—",
      fontSize: 9,
    });

    // Additional
    drawTextBlock({
      title: "Additional",
      text: additional || "—",
      fontSize: 9,
    });


    const pdfBuffer = Buffer.from(await pdfDoc.save());

    /* ---------- TELEGRAM SENDING ---------- */

    const captions = [
      "📥 New Artist Application",
      `👤 Name: ${fullName || "—"}`,
      `💃 Position: ${position || "—"}`,
      `📧 Email: ${email || "—"}`,
      `📞 Phone: ${phone || "—"}`,
      `📬 Telegram: ${telegram ? telegramId(telegram) : "—"}`,
      couple ? `💑 Couple: ${telegramId(couple)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    // Менеджеру
    await sendPhotoAndPdfToTelegram(
      allPhotos,
      pdfBuffer,
      `${(fullName || "candidate").replace(/\s+/g, "_")}_application.pdf`,
      captions
    );


    // Артисту (якщо вказаний chatId)
    if (chatId) {
      await SendToArtist(
        pdfBuffer,
        chatId,
        `Your_Application_for_${(project || "Project").replace(/\s+/g, "_")}.pdf`
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
