"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Plus, Edit, Trash2, Search, Eye, EyeOff, Star, Package, Layers, AlertCircle } from "lucide-react";
import ProductModal from "@/components/admin/ProductModal";
import { useD } from "@/components/admin/AdminTokensContext";

export interface Product {
  id:string; name:string; description:string; price:string|number|null;
  stock:number|null; isActive:boolean; brand:string; sku:string; categoryId:string;
  images:string[]; ingredients?:string[]; skinType?:string[]; hasVariants:boolean;
  averageRating?:string|number; reviewCount?:number;
}

function fmtPrice(p:string|number|null){if(p==null)return"--";const n=typeof p==="string"?parseFloat(p):p;return isNaN(n)?"--":`${n.toFixed(2)} DT`;}

function Stars({ rating }: { rating?: string | number }) {
  const D = useD();
  const n = Math.round(parseFloat(String(rating ?? 0)));
  return <span style={{display:"flex",gap:2}}>{[1,2,3,4,5].map(i=><Star key={i} size={10} color={i<=n?D.orange:D.dim} fill={i<=n?D.orange:"none"} />)}</span>;
}

function IconBtn({ onClick, title, children, hoverColor, disabled }: { onClick:()=>void; title:string; children:React.ReactNode; hoverColor?:string; disabled?:boolean }) {
  const D = useD();
  const [h,setH]=useState(false);
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{ background:"none",border:"none",cursor:disabled?"not-allowed":"pointer",padding:"0.35rem",color:h&&!disabled?(hoverColor??D.muted):D.dim,transition:"color 0.15s",display:"flex",alignItems:"center",opacity:disabled?0.4:1 }}>
      {children}
    </button>
  );
}

function ProductRow({ p, deletingId, onToggle, onEdit, onDelete }: { p:Product; deletingId:string|null; onToggle:(p:Product)=>void; onEdit:(p:Product)=>void; onDelete:(id:string)=>void }) {
  const D = useD();
  const [hovered,setHovered]=useState(false);
  const td: React.CSSProperties = { padding:"0.9rem 1rem", borderBottom:`1px solid ${D.border}`, color:D.muted, fontSize:"0.8rem", verticalAlign:"middle" };
  const stockColor=()=>{if(p.stock===0)return D.red;if(p.stock!=null&&p.stock<10)return D.yellow;return D.muted;};
  return (
    <tr onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
      style={{ background:hovered?`${D.text}06`:"transparent", transition:"background 0.15s" }}>
      <td style={{...td,paddingLeft:"1.25rem"}}>
        {p.images?.[0]?<img src={p.images[0]} alt={p.name} style={{width:40,height:40,objectFit:"cover",borderRadius:3,border:`1px solid ${D.border}`}} onError={e=>{(e.target as HTMLImageElement).style.display="none";}} />
          :<div style={{width:40,height:40,background:D.panelB,border:`1px solid ${D.border}`,borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center"}}><Package size={14} color={D.dim} /></div>}
      </td>
      <td style={td}>
        <p style={{color:D.text,fontWeight:600,fontSize:"0.82rem",marginBottom:3}}>{p.name}</p>
        <p style={{color:D.dim,fontSize:"0.72rem"}}>{p.brand}</p>
        {p.hasVariants&&<span style={{display:"inline-flex",alignItems:"center",gap:4,marginTop:4,fontFamily:D.font,fontSize:"0.4rem",letterSpacing:"0.12em",color:"#9B59FF"}}><Layers size={9}/> Variants</span>}
      </td>
      <td style={{...td,fontFamily:D.mono,fontSize:"0.72rem",color:D.dim}}>{p.sku}</td>
      <td style={{...td,textAlign:"right",color:D.text,fontFamily:D.mono}}>{fmtPrice(p.price)}</td>
      <td style={{...td,textAlign:"right",fontFamily:D.mono,color:stockColor()}}>
        {p.hasVariants?<span style={{color:D.dim}}>�</span>:p.stock!=null?<span>{p.stock===0&&<AlertCircle size={11} style={{display:"inline",marginRight:4}}/>}{p.stock}</span>:<span style={{color:D.dim}}>�</span>}
      </td>
      <td style={{...td,textAlign:"center"}}><div style={{display:"flex",justifyContent:"center"}}><Stars rating={p.averageRating}/></div>{(p.reviewCount??0)>0&&<p style={{fontFamily:D.font,fontSize:"0.38rem",letterSpacing:"0.1em",color:D.dim,marginTop:3}}>{p.reviewCount} reviews</p>}</td>
      <td style={{...td,textAlign:"center"}}>
        <span style={{display:"inline-block",padding:"0.2rem 0.6rem",borderRadius:2,fontFamily:D.font,fontSize:"0.4rem",letterSpacing:"0.15em",textTransform:"uppercase" as const,background:p.isActive?`${D.green}18`:D.panelB,color:p.isActive?D.green:D.dim,border:`1px solid ${p.isActive?`${D.green}40`:D.border}`}}>
          {p.isActive?"Active":"Inactive"}
        </span>
      </td>
      <td style={{...td,textAlign:"right",paddingRight:"1.25rem"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:4,opacity:hovered?1:0,transition:"opacity 0.15s"}}>
          <IconBtn onClick={()=>onToggle(p)} title={p.isActive?"Deactivate":"Activate"}>{p.isActive?<EyeOff size={13}/>:<Eye size={13}/>}</IconBtn>
          <IconBtn onClick={()=>onEdit(p)} title="Edit" hoverColor={D.orange}><Edit size={13}/></IconBtn>
          <IconBtn onClick={()=>onDelete(p.id)} title="Delete" hoverColor={D.red} disabled={deletingId===p.id}><Trash2 size={13}/></IconBtn>
        </div>
      </td>
    </tr>
  );
}

export default function AdminProductsPage() {
  const D = useD();
  const [products,setProducts]=useState<Product[]>([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState<"all"|"active"|"inactive">("all");
  const [modalOpen,setModalOpen]=useState(false);
  const [editingProduct,setEditingProduct]=useState<Product|null>(null);
  const [deletingId,setDeletingId]=useState<string|null>(null);
  const [searchFocused,setSearchFocused]=useState(false);

  const th: React.CSSProperties = { fontFamily:D.font, fontSize:"0.45rem", letterSpacing:"0.18em", textTransform:"uppercase" as const, color:D.dim, padding:"0.85rem 1rem", textAlign:"left" as const, fontWeight:400, whiteSpace:"nowrap" as const };
  const td: React.CSSProperties = { padding:"0.9rem 1rem", borderBottom:`1px solid ${D.border}`, color:D.muted, fontSize:"0.8rem", verticalAlign:"middle" };

  const fetchProducts=()=>{ setLoading(true); api.get("/api/admin/products").then(r=>setProducts(r.data.data??r.data??[])).finally(()=>setLoading(false)); };
  useEffect(fetchProducts,[]);

  const toggleActive=async(p:Product)=>{await api.patch(`/api/admin/products/${p.id}`,{isActive:!p.isActive});fetchProducts();};
  const deleteProduct=async(id:string)=>{if(!confirm("Permanently delete?"))return;setDeletingId(id);try{await api.delete(`/api/admin/products/${id}`);fetchProducts();}finally{setDeletingId(null);}};

  const visible=products.filter(p=>{
    const ms=!search||p.name.toLowerCase().includes(search.toLowerCase())||p.brand?.toLowerCase().includes(search.toLowerCase())||p.sku?.toLowerCase().includes(search.toLowerCase());
    const mf=filter==="all"||(filter==="active"&&p.isActive)||(filter==="inactive"&&!p.isActive);
    return ms&&mf;
  });

  return (
    <div style={{ minHeight:"100vh",background:D.bg,color:D.text }}>
      <div style={{ position:"sticky",top:0,zIndex:20,background:D.panelB,borderBottom:`1px solid ${D.border}`,padding:"1rem 2.5rem",display:"flex",alignItems:"center",gap:"1.5rem" }}>
        <div style={{flexShrink:0}}>
          <p style={{fontFamily:D.font,fontSize:"0.75rem",letterSpacing:"0.2em",color:D.text,fontWeight:700}}>Products</p>
          <p style={{fontFamily:D.font,fontSize:"0.42rem",letterSpacing:"0.15em",color:D.dim,marginTop:4}}>{products.length} total</p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"0.75rem",flex:1,maxWidth:520}}>
          <div style={{position:"relative",flex:1,display:"flex",alignItems:"center",background:D.panel,border:`1px solid ${searchFocused?`${D.orange}80`:D.border}`,borderRadius:4,padding:"0.55rem 0.85rem",gap:"0.6rem"}}>
            <Search size={12} color={D.dim} style={{flexShrink:0}}/>
            <input type="text" placeholder="Search name, brand, SKU�" value={search} onChange={e=>setSearch(e.target.value)} onFocus={()=>setSearchFocused(true)} onBlur={()=>setSearchFocused(false)}
              style={{background:"none",border:"none",outline:"none",fontFamily:D.font,fontSize:"0.48rem",letterSpacing:"0.12em",color:D.text,width:"100%"}}/>
          </div>
          <div style={{display:"flex",gap:"0.35rem"}}>
            {(["all","active","inactive"] as const).map(f=>(
              <button key={f} onClick={()=>setFilter(f)} style={{background:filter===f?D.orange:"transparent",border:`1px solid ${filter===f?D.orange:D.border}`,borderRadius:3,padding:"0.45rem 0.8rem",fontFamily:D.font,fontSize:"0.42rem",letterSpacing:"0.15em",textTransform:"uppercase" as const,color:filter===f?"#fff":D.dim,cursor:"pointer",transition:"all 0.15s"}}>{f}</button>
            ))}
          </div>
        </div>
        <button onClick={()=>{setEditingProduct(null);setModalOpen(true);}} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:"0.5rem",background:D.orange,border:"none",borderRadius:3,padding:"0.6rem 1.2rem",fontFamily:D.font,fontSize:"0.48rem",letterSpacing:"0.15em",textTransform:"uppercase" as const,color:"#fff",cursor:"pointer",whiteSpace:"nowrap"}}>
          <Plus size={13}/> Add Product
        </button>
      </div>

      <div style={{padding:"2rem 2.5rem"}}>
        <div style={{background:D.panel,border:`1px solid ${D.border}`,borderRadius:4,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${D.border}`}}>
                <th style={{...th,width:56}}>Image</th>
                <th style={th}>Product</th><th style={th}>SKU</th>
                <th style={{...th,textAlign:"right"}}>Price</th>
                <th style={{...th,textAlign:"right"}}>Stock</th>
                <th style={{...th,textAlign:"center"}}>Rating</th>
                <th style={{...th,textAlign:"center"}}>Status</th>
                <th style={{...th,textAlign:"right"}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading?Array.from({length:5}).map((_,i)=>(
                <tr key={i}>
                  <td style={td}><div style={{width:40,height:40,background:D.border,borderRadius:3}}/></td>
                  <td style={td}><div style={{height:10,width:140,background:D.border,borderRadius:2,marginBottom:6}}/><div style={{height:8,width:90,background:D.border,borderRadius:2}}/></td>
                  {[...Array(5)].map((_,j)=><td key={j} style={td}><div style={{height:10,width:60,background:D.border,borderRadius:2,marginLeft:"auto"}}/></td>)}
                  <td style={td}/>
                </tr>
              )):visible.length===0?(
                <tr><td colSpan={8} style={{...td,textAlign:"center",padding:"4rem",border:"none"}}><Package size={28} color={D.dim} style={{margin:"0 auto 0.75rem"}}/><p style={{fontFamily:D.font,fontSize:"0.5rem",letterSpacing:"0.2em",color:D.dim}}>No products found</p></td></tr>
              ):visible.map(p=><ProductRow key={p.id} p={p} deletingId={deletingId} onToggle={toggleActive} onEdit={prod=>{setEditingProduct(prod);setModalOpen(true);}} onDelete={deleteProduct}/>)}
            </tbody>
          </table>
        </div>
      </div>
      {modalOpen&&<ProductModal product={editingProduct} onClose={()=>setModalOpen(false)} onSave={fetchProducts}/>}
    </div>
  );
}
