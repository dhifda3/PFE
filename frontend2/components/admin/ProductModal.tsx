"use client";
import { useState, useEffect, useRef } from "react";
import {
  X, Plus, Trash2, ImagePlus, Tag,
  ChevronDown, ChevronUp, Check, AlertCircle,
} from "lucide-react";
import api from "@/lib/api";
import type { Product } from "@/app/admin/products/page";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category { id: string; name: string; }

interface Variant {
  _localId:         string;      // temp id for new rows
  id?:              string;      // real id if from backend
  name:             string;
  sku:              string;
  price:            string;
  compareAtPrice:   string;
  stock:            string;
  lowStockThreshold: string;
  images:           string[];
  attributes: {
    size:        string;
    color:       string;
    scent:       string;
    formulation: string;
  };
  isDefault: boolean;
  isActive:  boolean;
  _delete?:  boolean;
}

interface Props {
  product?: Product | null;
  onClose:  () => void;
  onSave:   () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SKIN_TYPES = ["All", "Oily", "Dry", "Combination", "Sensitive", "Normal", "Mature"];

function uid() { return Math.random().toString(36).slice(2); }

function emptyVariant(): Variant {
  return {
    _localId: uid(),
    name: "", sku: "", price: "", compareAtPrice: "",
    stock: "0", lowStockThreshold: "10",
    images: [],
    attributes: { size: "", color: "", scent: "", formulation: "" },
    isDefault: false, isActive: true,
  };
}

function TagInput({
  label, values, onChange, suggestions,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  suggestions?: string[];
}) {
  const [input, setInput] = useState("");
  const add = (val: string) => {
    const v = val.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setInput("");
  };
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-[#6B4F3A]/50 mb-1.5">{label}</label>
      <div className="border border-[#E0D5C8] rounded-sm p-2 bg-white min-h-[42px] flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className="flex items-center gap-1 px-2 py-0.5 bg-[#F0EAE2] text-[#6B4F3A] text-xs rounded-sm">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}>
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(input); } }}
          onBlur={() => add(input)}
          placeholder="Type + Enter"
          className="flex-1 min-w-[100px] text-xs outline-none placeholder:text-[#6B4F3A]/25 bg-transparent"
        />
      </div>
      {suggestions && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {suggestions.filter((s) => !values.includes(s)).map((s) => (
            <button
              key={s} type="button"
              onClick={() => onChange([...values, s])}
              className="px-2 py-0.5 text-[10px] border border-[#E0D5C8] rounded-sm text-[#6B4F3A]/50 hover:bg-[#F0EAE2] hover:text-[#6B4F3A] transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ImageListInput({
  images, onChange,
}: {
  images: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (v && !images.includes(v)) onChange([...images, v]);
    setInput("");
  };
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-[#6B4F3A]/50 mb-1.5">
        Images <span className="normal-case text-[#6B4F3A]/30 ml-1">(paste image URLs)</span>
      </label>

      {/* Preview strip */}
      {images.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {images.map((src, i) => (
            <div key={i} className="relative group w-16 h-16 flex-shrink-0">
              <img
                src={src}
                alt=""
                className="w-full h-full object-cover rounded-sm border border-[#E0D5C8]"
                onError={(e) => { (e.target as HTMLImageElement).src = ""; (e.target as HTMLImageElement).className = "hidden"; }}
              />
              <button
                type="button"
                onClick={() => onChange(images.filter((_, j) => j !== i))}
                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={8} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="https://example.com/image.jpg"
          className="flex-1 px-3 py-2 text-xs border border-[#E0D5C8] rounded-sm focus:outline-none focus:border-[#C4786A] transition-colors placeholder:text-[#6B4F3A]/25"
        />
        <button
          type="button"
          onClick={add}
          className="px-3 py-2 border border-[#E0D5C8] rounded-sm hover:bg-[#F0EAE2] transition-colors text-[#6B4F3A]"
        >
          <ImagePlus size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Variant Row ──────────────────────────────────────────────────────────────

function VariantRow({
  v, idx, onChange, onDelete, isOnly,
}: {
  v: Variant;
  idx: number;
  onChange: (updated: Variant) => void;
  onDelete: () => void;
  isOnly: boolean;
}) {
  const [open, setOpen] = useState(idx === 0);
  const set = (patch: Partial<Variant>) => onChange({ ...v, ...patch });
  const setAttr = (patch: Partial<Variant["attributes"]>) =>
    onChange({ ...v, attributes: { ...v.attributes, ...patch } });

  return (
    <div className={`border rounded-sm overflow-hidden ${v._delete ? "opacity-40" : ""} ${v.isDefault ? "border-[#C4786A]" : "border-[#E0D5C8]"}`}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-[#FAF7F2] cursor-pointer select-none"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-xs text-[#6B4F3A]/40 w-5 text-right">{idx + 1}</span>
        <span className="flex-1 text-sm font-medium text-[#1A1410]">
          {v.name || <span className="text-[#6B4F3A]/30 font-normal italic">Unnamed variant</span>}
        </span>
        {v.isDefault && (
          <span className="text-[10px] uppercase tracking-wider text-[#C4786A] border border-[#C4786A]/30 px-1.5 py-0.5 rounded-sm">
            Default
          </span>
        )}
        {v.price && (
          <span className="text-xs text-[#6B4F3A]/50 tabular-nums">
            {parseFloat(v.price || "0").toFixed(2)} DT
          </span>
        )}
        <div className="flex items-center gap-1 ml-2">
          {!v._delete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1 text-[#6B4F3A]/30 hover:text-red-500 transition-colors rounded-sm hover:bg-red-50"
            >
              <Trash2 size={12} />
            </button>
          )}
          {open ? <ChevronUp size={14} className="text-[#6B4F3A]/40" /> : <ChevronDown size={14} className="text-[#6B4F3A]/40" />}
        </div>
      </div>

      {/* Body */}
      {open && !v._delete && (
        <div className="p-4 space-y-4 border-t border-[#E0D5C8] bg-white">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Variant Name *" placeholder="e.g. 50ml – Rose Scent">
              <input value={v.name} onChange={(e) => set({ name: e.target.value })} required />
            </Field>
            <Field label="SKU *" placeholder="VAR-001">
              <input value={v.sku} onChange={(e) => set({ sku: e.target.value })} required />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Price *" prefix="DT">
              <input type="number" step="0.01" min="0" value={v.price} onChange={(e) => set({ price: e.target.value })} required />
            </Field>
            <Field label="Compare-at Price" prefix="DT">
              <input type="number" step="0.01" min="0" value={v.compareAtPrice} onChange={(e) => set({ compareAtPrice: e.target.value })} placeholder="Optional" />
            </Field>
            <Field label="Stock">
              <input type="number" min="0" value={v.stock} onChange={(e) => set({ stock: e.target.value })} />
            </Field>
          </div>

          {/* Attributes */}
          <div>
            <p className="text-xs uppercase tracking-wider text-[#6B4F3A]/50 mb-2">Attributes</p>
            <div className="grid grid-cols-4 gap-3">
              {(["size", "color", "scent", "formulation"] as const).map((attr) => (
                <Field key={attr} label={attr}>
                  <input
                    value={v.attributes[attr]}
                    onChange={(e) => setAttr({ [attr]: e.target.value })}
                    placeholder={attr === "size" ? "50ml" : attr === "color" ? "Rose" : attr === "scent" ? "Floral" : "Normal"}
                  />
                </Field>
              ))}
            </div>
          </div>

          {/* Variant images */}
          <ImageListInput
            images={v.images}
            onChange={(imgs) => set({ images: imgs })}
          />

          {/* Flags */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => set({ isDefault: true })}
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  v.isDefault ? "bg-[#C4786A] border-[#C4786A]" : "border-[#E0D5C8]"
                }`}
              >
                {v.isDefault && <Check size={10} className="text-white" />}
              </div>
              <span className="text-xs text-[#6B4F3A]">Default variant</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => set({ isActive: !v.isActive })}
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  v.isActive ? "bg-[#8A9E8A] border-[#8A9E8A]" : "border-[#E0D5C8]"
                }`}
              >
                {v.isActive && <Check size={10} className="text-white" />}
              </div>
              <span className="text-xs text-[#6B4F3A]">Active</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// Small field wrapper
function Field({ label, children, prefix }: { label: string; children: React.ReactElement; prefix?: string }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-[#6B4F3A]/50 mb-1">{label}</label>
      <div className={`flex items-center border border-[#E0D5C8] rounded-sm focus-within:border-[#C4786A] transition-colors bg-white ${prefix ? "pl-3" : ""}`}>
        {prefix && <span className="text-xs text-[#6B4F3A]/40">{prefix}</span>}
        {/* Clone element to inject className */}
        {children && typeof children === "object"
          ? { ...children, props: { ...children.props, className: "w-full px-3 py-2 text-sm text-[#1A1410] outline-none bg-transparent placeholder:text-[#6B4F3A]/25" } }
          : children}
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function ProductModal({ product, onClose, onSave }: Props) {
  const isEdit = !!product?.id;
  const [tab, setTab] = useState<"details" | "variants">("details");

  // ── Form state ────────────────────────────────────────────────────────────
  const [name,        setName]        = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [brand,       setBrand]       = useState(product?.brand ?? "");
  const [sku,         setSku]         = useState(product?.sku ?? "");
  const [categoryId,  setCategoryId]  = useState(product?.categoryId ?? "");
  const [price,       setPrice]       = useState(String(product?.price ?? ""));
  const [stock,       setStock]       = useState(String(product?.stock ?? "0"));
  const [images,      setImages]      = useState<string[]>(product?.images ?? []);
  const [ingredients, setIngredients] = useState<string[]>(product?.ingredients ?? []);
  const [skinType,    setSkinType]    = useState<string[]>(product?.skinType ?? []);
  const [isActive,    setIsActive]    = useState(product?.isActive ?? true);
  const [hasVariants, setHasVariants] = useState(product?.hasVariants ?? false);

  const [variants,    setVariants]    = useState<Variant[]>([]);
  const [categories,  setCategories]  = useState<Category[]>([]);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // Fetch categories + existing variants on open
  useEffect(() => {
    api.get("/api/categories").then((r) => setCategories(r.data.data ?? r.data ?? [])).catch(() => {});
    if (isEdit && product?.id) {
      api.get(`/api/products/${product.id}/variants`)
        .then((r) => {
          const rows = r.data.data ?? r.data ?? [];
          setVariants(rows.map((v: any) => ({
            _localId:         v.id,
            id:               v.id,
            name:             v.name ?? "",
            sku:              v.sku ?? "",
            price:            String(v.price ?? ""),
            compareAtPrice:   String(v.compareAtPrice ?? ""),
            stock:            String(v.stock ?? 0),
            lowStockThreshold: String(v.lowStockThreshold ?? 10),
            images:           v.images ?? [],
            attributes:       { size: "", color: "", scent: "", formulation: "", ...(v.attributes ?? {}) },
            isDefault:        v.isDefault ?? false,
            isActive:         v.isActive ?? true,
          })));
        })
        .catch(() => {});
    }
  }, []);

  const updateVariant = (idx: number, updated: Variant) => {
    setVariants((prev) => {
      const next = [...prev];
      // If this one is set as default, unset others
      if (updated.isDefault) {
        return next.map((v, i) => ({ ...v, isDefault: i === idx }));
      }
      next[idx] = updated;
      return next;
    });
  };

  const deleteVariant = (idx: number) => {
    setVariants((prev) => {
      const v = prev[idx];
      if (v.id) {
        // Mark for deletion (existing DB record)
        return prev.map((x, i) => i === idx ? { ...x, _delete: true } : x);
      }
      // Remove new ones immediately
      return prev.filter((_, i) => i !== idx);
    });
  };

  const addVariant = () => {
    setVariants((prev) => [...prev, emptyVariant()]);
    setTab("variants");
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!categoryId) { setError("Please select a category."); setTab("details"); return; }
    if (!sku.trim())  { setError("SKU is required."); setTab("details"); return; }
    if (hasVariants && variants.filter((v) => !v._delete).length === 0) {
      setError("Add at least one variant or disable 'Has Variants'.");
      setTab("variants");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name, description, brand, sku, categoryId,
        price:      price      ? parseFloat(price)      : null,
        stock:      !hasVariants && stock ? parseInt(stock) : null,
        images,     ingredients, skinType, isActive, hasVariants,
      };

      let productId = product?.id;
      if (isEdit && productId) {
        await api.patch(`/api/admin/products/${productId}`, payload);
      } else {
        const res = await api.post("/api/admin/products", payload);
        productId = res.data?.data?.id ?? res.data?.id;
      }

      // ── Variant sync ────────────────────────────────────────────────────
      if (hasVariants && productId) {
        for (const v of variants) {
          if (v._delete && v.id) {
            await api.delete(`/api/products/${productId}/variants/${v.id}`).catch(() => {});
            continue;
          }
          if (v._delete) continue;

          const vPayload = {
            productId, name: v.name, sku: v.sku,
            price:             parseFloat(v.price)            || 0,
            compareAtPrice:    v.compareAtPrice ? parseFloat(v.compareAtPrice) : undefined,
            stock:             parseInt(v.stock)              || 0,
            lowStockThreshold: parseInt(v.lowStockThreshold)  || 10,
            images:            v.images,
            attributes:        Object.fromEntries(Object.entries(v.attributes).filter(([, val]) => val)),
            isDefault: v.isDefault,
            isActive:  v.isActive,
          };

          if (v.id) {
            await api.patch(`/api/products/${productId}/variants/${v.id}`, vPayload).catch(() => {});
          } else {
            await api.post(`/api/products/${productId}/variants`, vPayload).catch(() => {});
          }
        }
      }

      onSave();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to save product. Check all required fields.");
    } finally {
      setSaving(false);
    }
  };

  const activeVariants = variants.filter((v) => !v._delete);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-[2px] pt-8 pb-8 px-4 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-sm shadow-2xl border border-[#E0D5C8] flex flex-col max-h-[calc(100vh-4rem)]">

        {/* ── Modal header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0D5C8] bg-[#FAF7F2] flex-shrink-0">
          <div>
            <h2 className="text-lg font-light text-[#1A1410]">
              {isEdit ? "Edit Product" : "New Product"}
            </h2>
            {isEdit && (
              <p className="text-xs text-[#6B4F3A]/40 mt-0.5 font-mono">{product?.sku}</p>
            )}
          </div>
          <button onClick={onClose} className="text-[#6B4F3A]/30 hover:text-[#1A1410] transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        <div className="flex border-b border-[#E0D5C8] flex-shrink-0 px-6">
          {[
            { key: "details",  label: "Details" },
            { key: "variants", label: `Variants${activeVariants.length > 0 ? ` (${activeVariants.length})` : ""}` },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key as "details" | "variants")}
              className={`px-4 py-3 text-sm border-b-2 -mb-px transition-colors ${
                tab === key
                  ? "border-[#C4786A] text-[#1A1410] font-medium"
                  : "border-transparent text-[#6B4F3A]/50 hover:text-[#6B4F3A]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Error banner ─────────────────────────────────────────────── */}
        {error && (
          <div className="mx-6 mt-4 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-sm px-4 py-3 flex-shrink-0">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          {/* ── Scrollable body ────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-6 py-6">

            {/* ══ DETAILS TAB ══ */}
            {tab === "details" && (
              <div className="space-y-5">
                {/* Name */}
                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#6B4F3A]/50 mb-1.5">Product Name *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="e.g. Hydrating Rose Serum"
                    className="w-full px-4 py-2.5 border border-[#E0D5C8] rounded-sm text-[#1A1410] text-sm focus:outline-none focus:border-[#C4786A] transition-colors placeholder:text-[#6B4F3A]/25"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#6B4F3A]/50 mb-1.5">Description *</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    rows={4}
                    placeholder="Describe the product, its benefits and usage…"
                    className="w-full px-4 py-2.5 border border-[#E0D5C8] rounded-sm text-[#1A1410] text-sm focus:outline-none focus:border-[#C4786A] transition-colors resize-none placeholder:text-[#6B4F3A]/25"
                  />
                </div>

                {/* Brand + Category */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#6B4F3A]/50 mb-1.5">Brand *</label>
                    <input
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      required
                      placeholder="Brand name"
                      className="w-full px-4 py-2.5 border border-[#E0D5C8] rounded-sm text-sm text-[#1A1410] focus:outline-none focus:border-[#C4786A] transition-colors placeholder:text-[#6B4F3A]/25"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#6B4F3A]/50 mb-1.5">Category *</label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 border border-[#E0D5C8] rounded-sm text-sm text-[#1A1410] focus:outline-none focus:border-[#C4786A] transition-colors bg-white appearance-none"
                    >
                      <option value="">Select category…</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* SKU + Price + Stock */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#6B4F3A]/50 mb-1.5">SKU *</label>
                    <input
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      required
                      placeholder="PROD-001"
                      className="w-full px-4 py-2.5 border border-[#E0D5C8] rounded-sm text-sm font-mono text-[#1A1410] focus:outline-none focus:border-[#C4786A] transition-colors placeholder:text-[#6B4F3A]/25"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#6B4F3A]/50 mb-1.5">
                      Base Price {hasVariants && <span className="normal-case text-[#6B4F3A]/30">(optional)</span>}
                    </label>
                    <div className="flex items-center border border-[#E0D5C8] rounded-sm focus-within:border-[#C4786A] transition-colors">
                      <span className="pl-3 text-xs text-[#6B4F3A]/40">$</span>
                      <input
                        type="number" step="0.01" min="0"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0.00"
                        className="flex-1 px-3 py-2.5 text-sm text-[#1A1410] outline-none bg-transparent placeholder:text-[#6B4F3A]/25"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#6B4F3A]/50 mb-1.5">
                      Stock {hasVariants && <span className="normal-case text-[#6B4F3A]/30">(per variant)</span>}
                    </label>
                    <input
                      type="number" min="0"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      disabled={hasVariants}
                      placeholder="0"
                      className="w-full px-4 py-2.5 border border-[#E0D5C8] rounded-sm text-sm text-[#1A1410] focus:outline-none focus:border-[#C4786A] transition-colors disabled:bg-[#FAF7F2] disabled:text-[#6B4F3A]/30 placeholder:text-[#6B4F3A]/25"
                    />
                  </div>
                </div>

                {/* Images */}
                <ImageListInput images={images} onChange={setImages} />

                {/* Skin types */}
                <TagInput label="Skin Types" values={skinType} onChange={setSkinType} suggestions={SKIN_TYPES} />

                {/* Ingredients */}
                <TagInput label="Ingredients" values={ingredients} onChange={setIngredients} />

                {/* Toggles */}
                <div className="flex gap-8 pt-1">
                  <label className="flex items-center gap-2.5 cursor-pointer" onClick={() => setIsActive(!isActive)}>
                    <div className={`w-8 h-4.5 rounded-full relative transition-colors ${isActive ? "bg-[#8A9E8A]" : "bg-[#E0D5C8]"}`}
                      style={{ height: 18 }}>
                      <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${isActive ? "translate-x-4" : "translate-x-0.5"}`} />
                    </div>
                    <span className="text-sm text-[#1A1410]">Active</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer" onClick={() => { setHasVariants(!hasVariants); if (!hasVariants && variants.length === 0) setVariants([emptyVariant()]); }}>
                    <div className={`w-8 rounded-full relative transition-colors ${hasVariants ? "bg-[#C4786A]" : "bg-[#E0D5C8]"}`}
                      style={{ height: 18 }}>
                      <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${hasVariants ? "translate-x-4" : "translate-x-0.5"}`} />
                    </div>
                    <span className="text-sm text-[#1A1410]">Has Variants</span>
                  </label>
                </div>
              </div>
            )}

            {/* ══ VARIANTS TAB ══ */}
            {tab === "variants" && (
              <div className="space-y-4">
                {!hasVariants && (
                  <div className="bg-amber-50 border border-amber-100 rounded-sm px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
                    <AlertCircle size={14} />
                    Enable "Has Variants" in the Details tab to manage variants.
                  </div>
                )}

                {variants.length === 0 && hasVariants && (
                  <div className="text-center py-10 text-sm text-[#6B4F3A]/30 border border-dashed border-[#E0D5C8] rounded-sm">
                    No variants yet. Add one below.
                  </div>
                )}

                {variants.map((v, i) => (
                  <VariantRow
                    key={v._localId}
                    v={v}
                    idx={i}
                    onChange={(u) => updateVariant(i, u)}
                    onDelete={() => deleteVariant(i)}
                    isOnly={activeVariants.length === 1}
                  />
                ))}

                {hasVariants && (
                  <button
                    type="button"
                    onClick={addVariant}
                    className="w-full py-2.5 border border-dashed border-[#C4786A]/40 rounded-sm text-sm text-[#C4786A] hover:bg-[#C4786A]/5 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={14} /> Add Variant
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Footer ─────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#E0D5C8] bg-[#FAF7F2] flex-shrink-0">
            <div className="text-xs text-[#6B4F3A]/40">
              {hasVariants
                ? `${activeVariants.length} variant${activeVariants.length !== 1 ? "s" : ""}`
                : "No variants"}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-sm text-[#6B4F3A] hover:bg-[#E0D5C8] rounded-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-[#1A1410] text-white text-sm rounded-sm hover:bg-[#C4786A] disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>{isEdit ? "Save Changes" : "Create Product"}</>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
