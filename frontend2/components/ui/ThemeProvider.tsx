"use client";
import { createTheme, ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import React from "react";
const theme = createTheme({
  palette: {
    primary: { main: "#C4786A", light: "#E8C4B8", dark: "#6B4F3A", contrastText: "#FAF7F2" },
    secondary: { main: "#8A9E8A", contrastText: "#FAF7F2" },
    background: { default: "#FAF7F2", paper: "#FFFFFF" },
    text: { primary: "#1A1410", secondary: "#6B4F3A" },
    error: { main: "#C0392B" },
  },
  typography: {
    fontFamily: "var(--font-body), sans-serif",
    h1: { fontFamily: "var(--font-display), serif" },
    h2: { fontFamily: "var(--font-display), serif" },
    h3: { fontFamily: "var(--font-display), serif" },
    h4: { fontFamily: "var(--font-display), serif" },
  },
  shape: { borderRadius: 2 },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: "none", fontWeight: 500, letterSpacing: "0.08em", borderRadius: 2, padding: "10px 28px" } } },
    MuiTextField: { styleOverrides: { root: { "& .MuiOutlinedInput-root": { borderRadius: 2, backgroundColor: "#FDFBF8", "& fieldset": { borderColor: "#E0D5C8" }, "&:hover fieldset": { borderColor: "#C4786A" } } } } },
  },
});
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}