import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatReceiptContributionTypeLabel, formatReceiptStatusLabel } from "@/lib/receipts/labels";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDisplayDate } from "@/lib/utils/format-date";
import type { SerializedReceipt } from "@/types/receipt";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const BRAND_GREEN = rgb(0.09, 0.39, 0.2);
const TEXT_MUTED = rgb(0.35, 0.35, 0.35);
const LINE_COLOR = rgb(0.86, 0.86, 0.86);
const AMOUNT_BG = rgb(0.95, 0.98, 0.96);

const FOOTER_PRIMARY = "Official Welfare Contribution Receipt";
const FOOTER_SECONDARY =
  "This receipt was generated automatically by the GIS Intake 28 Welfare System.";

function resolveLogoBytes(): Uint8Array | null {
  const candidates = [
    path.join(process.cwd(), "public", "images", "logo.png"),
    path.join(process.cwd(), "public", "images", "gis-logo.png"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate);
    }
  }

  return null;
}

export function buildReceiptPdfFilename(receipt: SerializedReceipt): string {
  return `${receipt.receiptNumber}.pdf`;
}

function drawCenteredText(
  page: PDFPage,
  text: string,
  y: number,
  size: number,
  font: PDFFont,
  color = rgb(0, 0, 0),
): number {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: (PAGE_WIDTH - width) / 2,
    y,
    size,
    font,
    color,
  });
  return y - size - 8;
}

function drawHorizontalRule(page: PDFPage, y: number): number {
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: LINE_COLOR,
  });
  return y - 20;
}

export async function generateReceiptPdf(receipt: SerializedReceipt): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  let y = PAGE_HEIGHT - MARGIN;

  const logoBytes = resolveLogoBytes();
  if (logoBytes) {
    try {
      const logo = await pdfDoc.embedPng(logoBytes);
      const logoSize = 64;
      const scale = logoSize / Math.max(logo.width, logo.height);
      const width = logo.width * scale;
      const height = logo.height * scale;
      page.drawImage(logo, {
        x: (PAGE_WIDTH - width) / 2,
        y: y - height,
        width,
        height,
      });
      y -= height + 18;
    } catch {
      // Continue with text-only header when logo cannot be embedded.
    }
  }

  y = drawCenteredText(page, "GIS INTAKE 28", y, 18, boldFont, BRAND_GREEN);
  y = drawCenteredText(page, "Welfare Association", y, 12, regularFont, TEXT_MUTED);
  y -= 4;
  y = drawCenteredText(page, "OFFICIAL PAYMENT RECEIPT", y, 13, boldFont);
  y = drawHorizontalRule(page, y);

  const receiptLabel = "Receipt Number";
  const receiptValue = receipt.receiptNumber;
  page.drawText(receiptLabel, {
    x: MARGIN,
    y,
    size: 10,
    font: boldFont,
    color: TEXT_MUTED,
  });
  page.drawText(receiptValue, {
    x: MARGIN,
    y: y - 18,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  y -= 48;

  const amountLabel = "Amount Paid";
  const amountValue = formatCurrency(receipt.amount);
  const amountBoxHeight = 44;
  page.drawRectangle({
    x: MARGIN,
    y: y - amountBoxHeight,
    width: CONTENT_WIDTH,
    height: amountBoxHeight,
    color: AMOUNT_BG,
    borderColor: BRAND_GREEN,
    borderWidth: 1,
  });
  page.drawText(amountLabel, {
    x: MARGIN + 14,
    y: y - 16,
    size: 10,
    font: boldFont,
    color: TEXT_MUTED,
  });
  page.drawText(amountValue, {
    x: MARGIN + 14,
    y: y - 34,
    size: 16,
    font: boldFont,
    color: BRAND_GREEN,
  });
  y -= amountBoxHeight + 24;

  const rows: Array<[string, string]> = [
    ["Member Name", receipt.memberName],
    ["Service Number", receipt.serviceNumber],
    ["Contribution Type", formatReceiptContributionTypeLabel(receipt.contributionType)],
    ["Payment Reference", receipt.paymentReference],
    ["Date Issued", formatDisplayDate(receipt.issuedAt)],
    ["Status", formatReceiptStatusLabel(receipt.status)],
  ];

  const labelX = MARGIN;
  const valueX = MARGIN + 150;

  for (const [label, value] of rows) {
    page.drawText(label, {
      x: labelX,
      y,
      size: 11,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    page.drawText(value, {
      x: valueX,
      y,
      size: 11,
      font: regularFont,
      color: rgb(0, 0, 0),
    });
    y -= 22;
  }

  y = drawHorizontalRule(page, y - 8);

  const footerPrimaryWidth = boldFont.widthOfTextAtSize(FOOTER_PRIMARY, 10);
  page.drawText(FOOTER_PRIMARY, {
    x: (PAGE_WIDTH - footerPrimaryWidth) / 2,
    y: MARGIN + 28,
    size: 10,
    font: boldFont,
    color: TEXT_MUTED,
  });

  const footerSecondaryWidth = regularFont.widthOfTextAtSize(FOOTER_SECONDARY, 9);
  page.drawText(FOOTER_SECONDARY, {
    x: (PAGE_WIDTH - footerSecondaryWidth) / 2,
    y: MARGIN + 12,
    size: 9,
    font: regularFont,
    color: TEXT_MUTED,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
