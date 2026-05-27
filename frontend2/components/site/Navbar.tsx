import Link from "next/link";
import { useAuthStore } from "@/lib/authStore";
import { ShoppingBag, User, Menu, X, Sun, Moon, Heart } from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/components/ui/ThemeContext";

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);

  const isLight = theme === "light";

  const iconStyle = {
    color: "var(--nav-link)" as const,
    display: "flex" as const,
    transition: "color 0.2s",
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
            { href: "/",                        label: "Shop"         },
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

          {/* Wishlist � only for logged-in users */}
          {user && (
            <Link
              href="/wishlist"
              style={iconStyle}
              title="My Wishlist"
              onMouseEnter={e => (e.currentTarget.style.color = "#e05c7a")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--nav-link)")}
            >
              <Heart size={20} />
            </Link>
          )}

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

          {/* User / Auth */}
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {(user.role === "admin" || user.role === "super_admin") && (
                <Link href="/admin/dashboard" style={{
                  fontFamily: "'Syncopate', sans-serif",
                  fontSize: "0.5rem", letterSpacing: "0.15em",
                  textTransform: "uppercase", textDecoration: "none",
                  color: "var(--amber)",
                  border: "1px solid var(--amber)",
                  padding: "0.35rem 0.8rem",
                }}>
                  Admin
                </Link>
              )}
              <button onClick={logout} style={{
                fontFamily: "'Syncopate', sans-serif",
                fontSize: "0.5rem", letterSpacing: "0.15em",
                textTransform: "uppercase",
                background: "none", border: "none",
                color: "var(--nav-link)", cursor: "pointer",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--cyan)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--nav-link)")}
              >
                Logout
              </button>
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
                Account
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
            ...(user ? [{ href: "/wishlist", label: "Wishlist" }] : []),
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
        </div>
      )}
    </header>
  );
}
