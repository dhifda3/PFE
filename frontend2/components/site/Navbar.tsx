"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import {
  ShoppingBag, User, Menu, X, Sun, Moon, Heart,
  ChevronDown, Shield, LogOut, ListOrdered, UserCircle2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/ui/ThemeContext";

function initials(name?: string) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Navbar() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isLight = theme === "light";
  const isElevated = user?.role === "admin" || user?.role === "super_admin";

  /* Close dropdown on outside click + ESC */
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const iconStyle = {
    color: "var(--nav-link)" as const,
    display: "flex" as const,
    transition: "color 0.2s",
  };

  const menuItem: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: "0.75rem",
    padding: "0.7rem 1rem",
    fontFamily: "'Syncopate', sans-serif",
    fontSize: "0.55rem", letterSpacing: "0.2em", textTransform: "uppercase",
    color: "var(--text-primary)",
    textDecoration: "none",
    background: "transparent",
    border: "none",
    width: "100%",
    cursor: "pointer",
    transition: "background 0.15s, color 0.15s",
    textAlign: "left" as const,
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    router.push("/");
  };

  return (
    <header style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 500,
      background: "var(--nav-bg)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--border)",
    }}>
      <div style={{
        maxWidth: "1400px", margin: "0 auto",
        padding: "0 2rem", height: "70px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>

        {/* Logo */}
        <Link href="/" style={{ textDecoration: "none" }}>
          <p style={{
            fontFamily: "'Syncopate', sans-serif",
            fontSize: "0.85rem", letterSpacing: "0.3em",
            fontWeight: 700, color: "var(--text-primary)",
          }}>
            LUM<span style={{ color: "var(--cyan)" }}>I</span>NA
          </p>
        </Link>

        {/* Desktop nav links */}
        <nav style={{ display: "flex", gap: "2.5rem" }} className="hidden md:flex">
          {[
            { href: "/",                                label: "Shop"         },
            { href: "/products?category=serums",        label: "Serums"       },
            { href: "/products?category=moisturizers",  label: "Moisturizers" },
            { href: "/products?category=cleansers",     label: "Cleansers"    },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={{
                fontFamily: "'Syncopate', sans-serif",
                fontSize: "0.7rem",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                textDecoration: "none",
                color: "#000",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--nav-link-hover)")}
              onMouseLeave={e => (e.currentTarget.style.color = "#6f6f6f")}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>

          {/* Cart */}
          <Link
            href="/cart"
            style={iconStyle}
            title="Cart"
            onMouseEnter={e => (e.currentTarget.style.color = "var(--amber)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--nav-link)")}
          >
            <ShoppingBag size={20} />
          </Link>

          {/* Profile / Auth */}
          {user ? (
            <div ref={menuRef} style={{ position: "relative" }}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                title={user.name}
                style={{
                  display: "flex", alignItems: "center", gap: "0.45rem",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-pill, 9999px)",
                  padding: "3px 9px 3px 3px",
                  cursor: "pointer",
                  transition: "border-color 0.2s",
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--amber)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
              >
                <span style={{
                  width: 28, height: 28, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "linear-gradient(135deg, var(--amber), var(--cyan))",
                  color: "#fff",
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "0.85rem", fontWeight: 600, lineHeight: 1,
                }}>
                  {initials(user.name)}
                </span>
                <ChevronDown size={13} color="var(--text-muted)" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  style={{
                    position: "absolute", top: "calc(100% + 0.5rem)", right: 0,
                    minWidth: 220,
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md, 4px)",
                    boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
                    overflow: "hidden",
                    zIndex: 600,
                  }}
                >
                  {/* Header chip */}
                  <div style={{
                    padding: "0.85rem 1rem",
                    borderBottom: "1px solid var(--border)",
                    background: "rgba(255,255,255,0.03)",
                  }}>
                    <p style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "0.85rem", color: "var(--text-primary)",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {user.name}
                    </p>
                    <p style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: "0.7rem", color: "var(--text-muted)",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {user.email}
                    </p>
                  </div>

                  <Link
                    href="/account"
                    style={menuItem}
                    onClick={() => setMenuOpen(false)}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,95,31,0.06)"; e.currentTarget.style.color = "var(--amber)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-primary)"; }}
                  >
                    <UserCircle2 size={14} /> Account
                  </Link>
                  <Link
                    href="/orders"
                    style={menuItem}
                    onClick={() => setMenuOpen(false)}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,95,31,0.06)"; e.currentTarget.style.color = "var(--amber)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-primary)"; }}
                  >
                    <ListOrdered size={14} /> Orders
                  </Link>
                  <Link
                    href="/wishlist"
                    style={menuItem}
                    onClick={() => setMenuOpen(false)}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,95,31,0.06)"; e.currentTarget.style.color = "var(--amber)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-primary)"; }}
                  >
                    <Heart size={14} /> Wishlist
                  </Link>

                  {isElevated && (
                    <Link
                      href="/admin/dashboard"
                      style={{ ...menuItem, borderTop: "1px solid var(--border)" }}
                      onClick={() => setMenuOpen(false)}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,170,0,0.08)"; e.currentTarget.style.color = "var(--amber)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-primary)"; }}
                    >
                      <Shield size={14} /> Admin
                    </Link>
                  )}

                  <button
                    onClick={handleLogout}
                    style={{
                      ...menuItem,
                      borderTop: "1px solid var(--border)",
                      color: "rgba(255,80,80,0.85)",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,80,80,0.06)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/auth/login" style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              color: "var(--nav-link)", textDecoration: "none",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--cyan)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--nav-link)")}
            >
              <User size={18} />
              <span style={{
                fontFamily: "'Syncopate', sans-serif",
                fontSize: "0.5rem", letterSpacing: "0.15em",
                textTransform: "uppercase",
              }} className="hidden sm:inline">
                Sign in
              </span>
            </Link>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggle}
            aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "36px", height: "36px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-pill)",
              background: "var(--bg-card)",
              color: isLight ? "var(--amber)" : "var(--cyan)",
              cursor: "pointer", flexShrink: 0,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = "var(--amber)";
              e.currentTarget.style.background  = "var(--amber-honey)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.background  = "var(--bg-card)";
            }}
          >
            {isLight ? <Moon size={15} /> : <Sun size={15} />}
          </button>

          {/* Mobile menu button */}
          <button
            className="md:hidden"
            onClick={() => setOpen(!open)}
            style={{ background: "none", border: "none", color: "var(--text-primary)", cursor: "pointer" }}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div style={{
          borderTop: "1px solid var(--border)",
          background: "var(--nav-bg)",
          padding: "1.5rem 2rem",
          display: "flex", flexDirection: "column", gap: "1.5rem",
        }}>
          {[
            { href: "/",                       label: "Shop"         },
            { href: "/products?category=serums",       label: "Serums"       },
            { href: "/products?category=moisturizers", label: "Moisturizers" },
            { href: "/products?category=cleansers",    label: "Cleansers"    },
            ...(user ? [
              { href: "/account",  label: "Account"  },
              { href: "/orders",   label: "Orders"   },
              { href: "/wishlist", label: "Wishlist" },
            ] : []),
            ...(isElevated ? [{ href: "/admin/dashboard", label: "Admin" }] : []),
          ].map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} style={{
              fontFamily: "'Syncopate', sans-serif",
              fontSize: "0.6rem", letterSpacing: "0.2em",
              textTransform: "uppercase", textDecoration: "none",
              color: "var(--nav-link)",
            }}>
              {label}
            </Link>
          ))}
          {user && (
            <button onClick={handleLogout} style={{
              fontFamily: "'Syncopate', sans-serif",
              fontSize: "0.6rem", letterSpacing: "0.2em",
              textTransform: "uppercase",
              background: "none", border: "none",
              color: "rgba(255,80,80,0.85)", cursor: "pointer",
              padding: 0, textAlign: "left",
            }}>
              Sign out
            </button>
          )}
        </div>
      )}
    </header>
  );
}
