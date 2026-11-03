import { roleLabel } from '../../auth/roles';
import {
  SHOP_TIME_ZONE,
  formatBookingWhen,
  formatMoney,
  shopDateKey,
  statusLabel,
} from '../booking/format';
import type { Booking } from '../booking/types';
import {
  formatReportDate,
  reportRangeLabel,
  type BarberTally,
  type ReportRange,
  type ReportSummary,
  type ServiceTally,
  type StatusTally,
} from './report';
import type { StaffAccount } from './useAccounts';

export interface ReportPdfInput {
  range: ReportRange;
  bookings: Booking[];
  newAccounts: StaffAccount[];
  summary: ReportSummary;
  statuses: StatusTally[];
  services: ServiceTally[];
  barbers: BarberTally[];
  generatedAt: Date;
}

const PAGE_MARGIN = 40;
const BRAND: [number, number, number] = [0, 52, 255];
const INK: [number, number, number] = [17, 17, 17];
const MUTED: [number, number, number] = [110, 110, 110];
const LINE: [number, number, number] = [222, 222, 222];
const STRIPE: [number, number, number] = [247, 248, 250];

type WithAutoTable = { lastAutoTable?: { finalY?: number } };

const lastTableY = (doc: unknown, fallback: number): number => {
  const finalY = (doc as WithAutoTable).lastAutoTable?.finalY;
  return typeof finalY === 'number' ? finalY : fallback;
};

/**
 * Builds the downloadable business report. jsPDF and its table plugin are
 * imported only when the admin presses Export, so the dashboard's first paint
 * does not carry a PDF engine.
 */
export const downloadReportPdf = async ({
  range,
  bookings,
  newAccounts,
  summary,
  statuses,
  services,
  barbers,
  generatedAt,
}: ReportPdfInput): Promise<void> => {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  // The on-screen label uses an en dash. Keep the PDF to characters the
  // standard Helvetica encoding handles without a custom font file.
  const rangeLabel = reportRangeLabel(range).replace(/\u2013/g, '-');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...BRAND);
  doc.text('TRIM', PAGE_MARGIN, 48);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('BUSINESS REPORT', PAGE_MARGIN, 64);
  doc.text(`Period ${rangeLabel}`, pageWidth - PAGE_MARGIN, 48, {
    align: 'right',
  });
  doc.text(
    `Generated ${generatedAt.toLocaleString('en-PH', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: SHOP_TIME_ZONE,
    })}`,
    pageWidth - PAGE_MARGIN,
    64,
    { align: 'right' },
  );

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.75);
  doc.line(PAGE_MARGIN, 78, pageWidth - PAGE_MARGIN, 78);

  const baseStyles = {
    font: 'helvetica',
    fontSize: 9,
    cellPadding: 5,
    textColor: INK,
    lineColor: LINE,
    lineWidth: 0.5,
  };

  autoTable(doc, {
    startY: 94,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    theme: 'grid',
    head: [['Summary', 'Value']],
    body: [
      ['Appointments', String(summary.bookings)],
      ['Completed', String(summary.completed)],
      ['Scheduled', String(summary.scheduled)],
      ['Cancelled', String(summary.cancelled)],
      ['Revenue from completed cuts', formatMoney(summary.revenue)],
      ['New accounts', String(summary.newAccounts)],
    ],
    styles: baseStyles,
    headStyles: {
      fillColor: BRAND,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: STRIPE },
    columnStyles: {
      0: { cellWidth: contentWidth - 120 },
      1: { cellWidth: 120, halign: 'right', fontStyle: 'bold' },
    },
  });

  let cursor = lastTableY(doc, 220) + 24;

  const startSection = (title: string): number => {
    if (cursor > pageHeight - 120) {
      doc.addPage();
      cursor = 56;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(title.toUpperCase(), PAGE_MARGIN, cursor);
    return cursor + 8;
  };

  const tableBase = {
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    theme: 'grid' as const,
    styles: baseStyles,
    headStyles: {
      fillColor: BRAND,
      textColor: 255,
      fontStyle: 'bold' as const,
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: STRIPE },
  };

  if (bookings.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text('No appointments fall inside this period.', PAGE_MARGIN, cursor);
    cursor += 22;
  }

  if (bookings.length > 0) {
    autoTable(doc, {
      ...tableBase,
      startY: startSection('Booking status'),
      head: [['Status', 'Appointments']],
      body: statuses.map((entry) => [entry.label, String(entry.count)]),
      columnStyles: {
        0: { cellWidth: contentWidth - 120 },
        1: { cellWidth: 120, halign: 'right' },
      },
    });
    cursor = lastTableY(doc, cursor) + 22;

    autoTable(doc, {
      ...tableBase,
      startY: startSection('Services'),
      head: [['Service', 'Bookings', 'Completed', 'Revenue']],
      body: services.map((entry) => [
        entry.service,
        String(entry.count),
        String(entry.completed),
        formatMoney(entry.revenue),
      ]),
      columnStyles: {
        0: { cellWidth: contentWidth - 220 },
        1: { cellWidth: 70, halign: 'right' },
        2: { cellWidth: 70, halign: 'right' },
        3: { cellWidth: 80, halign: 'right' },
      },
    });
    cursor = lastTableY(doc, cursor) + 22;

    autoTable(doc, {
      ...tableBase,
      startY: startSection('Barber performance'),
      head: [['Barber', 'Bookings', 'Completed', 'Revenue']],
      body: barbers.map((entry) => [
        entry.name,
        String(entry.count),
        String(entry.completed),
        formatMoney(entry.revenue),
      ]),
      columnStyles: {
        0: { cellWidth: contentWidth - 220 },
        1: { cellWidth: 70, halign: 'right' },
        2: { cellWidth: 70, halign: 'right' },
        3: { cellWidth: 80, halign: 'right' },
      },
    });
    cursor = lastTableY(doc, cursor) + 22;
  }

  if (newAccounts.length > 0) {
    autoTable(doc, {
      ...tableBase,
      startY: startSection('New accounts'),
      head: [['Account', 'Email', 'Role', 'Joined']],
      body: newAccounts.map((account) => [
        account.username ?? account.displayName ?? 'No username',
        account.email,
        roleLabel(account.role),
        formatReportDate(shopDateKey(account.createdAt)),
      ]),
      styles: { ...baseStyles, fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 115 },
        1: { cellWidth: contentWidth - 275 },
        2: { cellWidth: 70 },
        3: { cellWidth: 90, halign: 'right' },
      },
    });
    cursor = lastTableY(doc, cursor) + 22;
  }

  if (bookings.length > 0) {
    autoTable(doc, {
      ...tableBase,
      startY: startSection('Appointments'),
      head: [['When', 'Customer', 'Barber', 'Service', 'Price', 'Status']],
      body: bookings.map((booking) => [
        formatBookingWhen(booking.startsAt),
        booking.customerName,
        booking.barberName,
        booking.service,
        formatMoney(booking.price),
        statusLabel(booking.status),
      ]),
      styles: { ...baseStyles, fontSize: 7.5, cellPadding: 3.5 },
      columnStyles: {
        0: { cellWidth: 96 },
        1: { cellWidth: 92 },
        2: { cellWidth: 82 },
        // Fill the remaining measure rather than leaving autoTable to log a
        // "width could not fit" warning for the unused strip.
        3: { cellWidth: contentWidth - 383 },
        4: { cellWidth: 53, halign: 'right' },
        5: { cellWidth: 60 },
      },
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      `Trim · Business report · ${rangeLabel}`,
      PAGE_MARGIN,
      pageHeight - 24,
    );
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - PAGE_MARGIN, pageHeight - 24, {
      align: 'right',
    });
  }

  doc.save(`trim-report-${range.from}-to-${range.to}.pdf`);
};
