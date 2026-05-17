import { StyleSheet } from "@react-pdf/renderer";

export const colors = {
  primary: "#1E40AF",
  text: "#1E293B",
  muted: "#64748B",
  border: "#E2E8F0",
  background: "#F8FAFC",
};

export const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 40,
    color: colors.text,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: `1pt solid ${colors.border}`,
    paddingBottom: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: colors.primary,
  },
  subtitle: {
    fontSize: 9,
    color: colors.muted,
    marginTop: 4,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 6,
    color: colors.primary,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottom: `0.5pt dashed ${colors.border}`,
  },
  label: { color: colors.muted },
  value: { fontWeight: 700 },
  qr: { width: 80, height: 80 },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 40,
    right: 40,
    fontSize: 8,
    color: colors.muted,
    borderTop: `0.5pt solid ${colors.border}`,
    paddingTop: 6,
    textAlign: "center",
  },
});
