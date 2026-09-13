import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Drawer } from "@/components/shared/Drawer";
import { PillButton } from "@/components/ui/PillButton";
import { formatCurrency } from "@/lib/currency";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { ImportPreview, ImportResult } from "@/features/transactions/types";

interface ImportPreviewModalProps {
  visible: boolean;
  preview: ImportPreview | null;
  result: ImportResult | null;
  committing: boolean;
  currency: string;
  onConfirm: () => void;
  onClose: () => void;
}

// How many rows of each bucket are listed before collapsing into a "+N more"
// line. A 500-row import must not render 500 rows into a bottom sheet.
const MAX_LISTED_ROWS = 8;

// The review step between Preview and Commit
// (specs/transaction-export-import/spec.md US-02/US-03).
//
// Deliberately mirrors TransactionActionCard's own "here's what I parsed,
// confirm to save" shape from AI chat rather than inventing a second
// confirmation idiom: nothing is written until the user taps Confirm, and
// what they see listed is exactly what Commit will attempt — the server's
// import_token carries those same rows.
//
// Rows that error are shown but not editable. Fixing one means fixing the
// source spreadsheet and re-uploading (spec.md Out of Scope) — offering an
// inline edit here would create a second, untested path into transaction
// creation.
export function ImportPreviewModal({
  visible,
  preview,
  result,
  committing,
  currency,
  onConfirm,
  onClose,
}: ImportPreviewModalProps) {
  const validCount = preview?.valid.length ?? 0;
  const total = validCount + (preview?.duplicates.length ?? 0) + (preview?.errors.length ?? 0);
  const validTotal = preview?.valid.reduce((sum, row) => sum + row.amount, 0) ?? 0;

  return (
    <Drawer
      visible={visible}
      onClose={onClose}
      footer={
        result ? (
          <PillButton label="Xong" onPress={onClose} />
        ) : (
          <View style={styles.actions}>
            <PillButton label="Hủy" variant="outline" onPress={onClose} style={styles.flexButton} />
            <PillButton
              label={validCount > 0 ? `Nhập ${validCount} dòng` : "Không có dòng nào"}
              onPress={onConfirm}
              disabled={validCount === 0 || committing}
              loading={committing}
              style={styles.flexButton}
              testID="btn-import-confirm"
            />
          </View>
        )
      }
    >
      <View testID="modal-import-preview" style={styles.body}>
        {result ? (
          <ImportResultSummary result={result} />
        ) : (
          <>
            <Text style={styles.title}>Xem trước khi nhập</Text>
            <Text style={styles.subtitle}>
              Chưa có gì được lưu. Kiểm tra {total} dòng bên dưới rồi xác nhận.
            </Text>

            <View style={styles.summaryRow}>
              <SummaryTile testID="text-import-valid-count" label="Sẽ nhập" value={String(validCount)} tone={colors.mint} />
              <SummaryTile label="Bỏ qua" value={String(preview?.duplicates.length ?? 0)} tone={colors.textSecondary} />
              <SummaryTile label="Lỗi" value={String(preview?.errors.length ?? 0)} tone={colors.mustard} />
            </View>

            {validCount > 0 ? (
              <Text style={styles.total}>Tổng: {formatCurrency(validTotal, currency)}</Text>
            ) : null}

            <IssueList
              testID="list-import-errors"
              title="Dòng bị lỗi — sửa trong file rồi tải lại"
              issues={preview?.errors ?? []}
              tone={colors.mustard}
            />
            <IssueList
              title="Đã nhập trước đó — sẽ bỏ qua"
              issues={preview?.duplicates ?? []}
              tone={colors.textSecondary}
            />
          </>
        )}
      </View>
    </Drawer>
  );
}

function ImportResultSummary({ result }: { result: ImportResult }) {
  return (
    <View style={styles.body} testID="text-import-result">
      <Text style={styles.title}>Đã nhập xong</Text>
      <View style={styles.summaryRow}>
        <SummaryTile label="Đã nhập" value={String(result.imported)} tone={colors.mint} />
        <SummaryTile label="Bỏ qua" value={String(result.skipped)} tone={colors.textSecondary} />
        <SummaryTile label="Thất bại" value={String(result.failed)} tone={colors.mustard} />
      </View>
      <IssueList title="Dòng không tạo được" issues={result.failures} tone={colors.mustard} />
    </View>
  );
}

function SummaryTile({
  label,
  value,
  tone,
  testID,
}: {
  label: string;
  value: string;
  tone: string;
  testID?: string;
}) {
  return (
    <View style={styles.tile}>
      <Text testID={testID} style={[styles.tileValue, { color: tone }]}>
        {value}
      </Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function IssueList({
  title,
  issues,
  tone,
  testID,
}: {
  title: string;
  issues: { row: number; reason: string }[];
  tone: string;
  testID?: string;
}) {
  if (issues.length === 0) return null;
  const listed = issues.slice(0, MAX_LISTED_ROWS);
  const hidden = issues.length - listed.length;

  return (
    <View testID={testID} style={styles.issueBlock}>
      <Text style={styles.issueTitle}>{title}</Text>
      <ScrollView style={styles.issueScroll} nestedScrollEnabled>
        {listed.map((issue) => (
          <Text key={issue.row} style={styles.issueRow} numberOfLines={2}>
            <Text style={{ color: tone }}>Dòng {issue.row}</Text> — {issue.reason}
          </Text>
        ))}
      </ScrollView>
      {hidden > 0 ? <Text style={styles.issueMore}>và {hidden} dòng nữa</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  summaryRow: { flexDirection: "row", gap: spacing.sm },
  tile: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: spacing.md,
    borderRadius: radii.listCard,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  tileValue: { ...typography.title },
  tileLabel: { ...typography.tiny, color: colors.textMuted },
  total: { ...typography.label, color: colors.textPrimary },
  issueBlock: { gap: spacing.xs },
  issueTitle: { ...typography.caption, color: colors.textSecondary },
  // Capped rather than unbounded: the sheet's own ScrollView would otherwise
  // grow past the screen on a file with many bad rows.
  issueScroll: { maxHeight: 160 },
  issueRow: { ...typography.caption, color: colors.textMuted, paddingVertical: 3 },
  issueMore: { ...typography.tiny, color: colors.textMuted },
  actions: { flexDirection: "row", gap: spacing.sm },
  flexButton: { flex: 1 },
});
