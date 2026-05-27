"use client";
import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import { Shield, ShieldOff, UserMinus, Search, ExternalLink, CheckCircle2, Clock, Crown, User } from "lucide-react";
import { useD } from "@/components/admin/AdminTokensContext";

interface UserData {
  id: string; name: string; email: string; role: string;
  emailVerified: boolean; createdAt: string;
}

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
}
function getAccentColor(role: string, isDark: boolean) {
  if (role==="super_admin") return { primary:"#FF5F1F", secondary:"rgba(255,95,31,0.15)",  border:"rgba(255,95,31,0.3)"  };
  if (role==="admin")       return { primary:"#FFAA00", secondary:"rgba(255,170,0,0.1)",   border:"rgba(255,170,0,0.25)" };
  return isDark
    ? { primary:"#00FFFF", secondary:"rgba(0,255,255,0.06)",  border:"rgba(0,255,255,0.15)" }
    : { primary:"#0077AA", secondary:"rgba(0,119,170,0.07)",  border:"rgba(0,119,170,0.18)" };
}

function ActionBtn({ onClick, label, color, danger }: { onClick:()=>void; label:string; color:string; danger?:boolean }) {
  const D = useD();
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{ background:h?`${danger?"rgba(255,80,80,0.1)":"rgba(255,95,31,0.1)"}`:"none", border:`1px solid ${h?color:D.border}`, cursor:"pointer", padding:"0.3rem 0.6rem", color:h?color:D.dim, fontFamily:D.font, fontSize:"0.7rem", letterSpacing:"0.12em", textTransform:"uppercase" as const, transition:"all 0.15s" }}>
      {label}
    </button>
  );
}

function UserCard({ user, isSuperAdmin, isDark, onPromote, onSuspend }: { user:UserData; isSuperAdmin:boolean; isDark:boolean; onPromote:(id:string,role:string)=>void; onSuspend:(id:string)=>void }) {
  const D = useD();
  const [hovered, setHovered] = useState(false);
  const accent = getAccentColor(user.role, isDark);
  const initials = getInitials(user.name);
  const joinDate = new Date(user.createdAt).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
  const isElevated = user.role==="admin"||user.role==="super_admin";

  return (
    <div onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
      style={{ position:"relative", background:hovered?D.panel:D.panelB, border:`1px solid ${hovered?accent.border:D.border}`, padding:"1.5rem", transition:"all 0.25s ease", overflow:"hidden", cursor:"default", transform:hovered?"translateY(-2px)":"translateY(0)", boxShadow:hovered?`0 8px 32px ${accent.primary}18`:"none" }}>
      <div style={{ position:"absolute",top:0,right:0,width:"40px",height:"40px",background:`linear-gradient(225deg,${accent.primary}22 0%,transparent 60%)`,opacity:hovered?1:0.4,transition:"opacity 0.25s" }} />
      <div style={{ position:"absolute",top:0,left:0,right:0,height:"2px",background:`linear-gradient(90deg,${accent.primary}00,${accent.primary},${accent.primary}00)`,opacity:hovered?1:0,transition:"opacity 0.25s" }} />
      <div style={{ position:"relative",zIndex:1 }}>
        <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"1.25rem" }}>
          <div style={{ position:"relative" }}>
            <div style={{ width:"52px",height:"52px",background:accent.secondary,border:`1px solid ${accent.border}`,display:"flex",alignItems:"center",justifyContent:"center" }}>
              <span style={{ fontFamily:D.font,fontSize:"0.85rem",fontWeight:700,color:accent.primary,letterSpacing:"0.05em" }}>{initials}</span>
            </div>
            <div style={{ position:"absolute",bottom:"-3px",right:"-3px",width:"12px",height:"12px",background:user.emailVerified?"#00FFAA":"rgba(255,80,80,0.7)",border:`2px solid ${D.panelB}`,borderRadius:"50%" }} />
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:"0.35rem",padding:"0.2rem 0.55rem",background:accent.secondary,border:`1px solid ${accent.border}` }}>
            {user.role==="super_admin"?<Crown size={9} style={{color:accent.primary}} />:isElevated?<Shield size={9} style={{color:accent.primary}} />:<User size={9} style={{color:accent.primary}} />}
            <span style={{ fontFamily:D.font,fontSize:"0.7rem",letterSpacing:"0.15em",textTransform:"uppercase" as const,color:accent.primary }}>{user.role.replace("_"," ")}</span>
          </div>
        </div>
        <p style={{ fontFamily:D.font,fontSize:"0.72rem",fontWeight:700,color:D.text,letterSpacing:"0.08em",marginBottom:"0.35rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{user.name}</p>
        <p style={{ fontFamily:D.mono,fontSize:"0.7rem",color:D.dim,marginBottom:"1.25rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{user.email}</p>
        <div style={{ height:"1px",background:`linear-gradient(90deg,${accent.primary}30,transparent)`,marginBottom:"1rem" }} />
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1.25rem" }}>
          <div style={{ display:"flex",alignItems:"center",gap:"0.4rem" }}>
            {user.emailVerified?<CheckCircle2 size={11} style={{color:D.green,opacity:0.8}} />:<Clock size={11} style={{color:D.red}} />}
            <span style={{ fontFamily:D.font,fontSize:"0.7rem",letterSpacing:"0.12em",textTransform:"uppercase" as const,color:user.emailVerified?D.green:D.red }}>{user.emailVerified?"Verified":"Pending"}</span>
          </div>
          <span style={{ fontFamily:D.mono,fontSize:"0.65rem",color:D.dim }}>{joinDate}</span>
        </div>
        <p style={{ fontFamily:D.mono,fontSize:"0.6rem",color:`${accent.primary}55`,letterSpacing:"0.05em",marginBottom:"1rem" }}>#{user.id.slice(0,12).toUpperCase()}</p>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div style={{ display:"flex",gap:"0.5rem" }}>
            {isSuperAdmin&&user.role!=="admin"&&user.role!=="super_admin"&&<ActionBtn onClick={()=>onPromote(user.id,"admin")} label="Promote" color="#FF5F1F" />}
            {isSuperAdmin&&user.role==="admin"&&<ActionBtn onClick={()=>onPromote(user.id,"user")} label="Demote" color="#FFAA00" />}
            {isSuperAdmin&&<ActionBtn onClick={()=>onSuspend(user.id)} label="Suspend" color="rgba(255,80,80,0.8)" danger />}
          </div>
          <Link href={`/admin/users/${user.id}`}
            style={{ display:"inline-flex",alignItems:"center",gap:"0.35rem",padding:"0.35rem 0.7rem",background:D.panelB,border:`1px solid ${D.border}`,color:D.dim,fontFamily:D.font,fontSize:"0.7rem",letterSpacing:"0.12em",textTransform:"uppercase" as const,textDecoration:"none",transition:"all 0.15s" }}
            onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.color=D.cyan;(e.currentTarget as HTMLAnchorElement).style.borderColor=`${D.cyan}44`;(e.currentTarget as HTMLAnchorElement).style.background=`${D.cyan}08`;}}
            onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.color=D.dim;(e.currentTarget as HTMLAnchorElement).style.borderColor=D.border;(e.currentTarget as HTMLAnchorElement).style.background=D.panelB;}}
          >View <ExternalLink size={9} /></Link>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const D = useD();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [filterRole, setFilterRole] = useState<"all"|"admin"|"user">("all");

  useEffect(() => {
    Promise.all([api.get("/api/admin/users"),api.get("/api/v1/users/me")])
      .then(([ur,mr])=>{setUsers(ur.data.data);setCurrentUserRole(mr.data.data.role);})
      .finally(()=>setLoading(false));
  },[]);

  const promoteUser = async(userId:string,newRole:string)=>{
    await api.patch(`/api/admin/users/${userId}/role`,{role:newRole});
    setUsers(prev=>prev.map(u=>u.id===userId?{...u,role:newRole}:u));
  };
  const suspendUser = async(userId:string)=>{
    if(!confirm("Suspend this user?"))return;
    await api.delete(`/api/admin/users/${userId}`);
    setUsers(prev=>prev.filter(u=>u.id!==userId));
  };

  const filtered = useMemo(()=>{
    let list=users;
    if(filterRole!=="all") list=list.filter(u=>filterRole==="admin"?(u.role==="admin"||u.role==="super_admin"):u.role==="user");
    const q=query.trim().toLowerCase();
    if(q) list=list.filter(u=>u.name.toLowerCase().includes(q)||u.email.toLowerCase().includes(q)||u.id.toLowerCase().includes(q));
    return list;
  },[users,query,filterRole]);

  const isSuperAdmin = currentUserRole==="super_admin";
  const isDark = D.bg === "#0A0A0F";
  const adminsCount  = users.filter(u=>u.role==="admin"||u.role==="super_admin").length;
  const verifiedCount = users.filter(u=>u.emailVerified).length;

  if(loading) return (
    <div style={{ minHeight:"100vh",background:D.bg,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:"28px",height:"28px",border:`1px solid ${D.orange}`,borderTopColor:"transparent",borderRadius:"50%",margin:"0 auto 1rem",animation:"spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{ fontFamily:D.font,fontSize:"0.7rem",letterSpacing:"0.3em",color:D.dim,textTransform:"uppercase" }}>Loading users</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh",background:D.bg,color:D.text,padding:0 }}>
      <div style={{ marginBottom:"2.5rem" }}>
        <div style={{ display:"flex",alignItems:"center",gap:"0.75rem",marginBottom:"0.5rem" }}>
          <div style={{ width:"24px",height:"1px",background:D.orange }} />
          <p style={{ fontFamily:D.font,fontSize:"0.7rem",letterSpacing:"0.35em",textTransform:"uppercase" as const,color:D.orange,opacity:0.7 }}>Admin -- Access Control</p>
        </div>
        <h1 style={{ fontFamily:D.font,fontSize:"1.3rem",fontWeight:700,letterSpacing:"0.2em",textTransform:"uppercase" as const,color:D.text,marginBottom:"0.3rem" }}>User Management</h1>
        <p style={{ fontFamily:D.font,fontSize:"0.72rem",letterSpacing:"0.18em",textTransform:"uppercase" as const,color:D.dim }}>{users.length} registered accounts</p>
      </div>

      <div style={{ display:"flex",gap:0,marginBottom:"2rem",border:`1px solid ${D.border}` }}>
        {[{label:"Total",value:users.length,color:D.text},{label:"Admins",value:adminsCount,color:D.orange},{label:"Verified",value:verifiedCount,color:D.green},{label:"Showing",value:filtered.length,color:D.cyan}].map((stat,i)=>(
          <div key={stat.label} style={{ flex:1,padding:"1rem 1.25rem",borderRight:i<3?`1px solid ${D.border}`:"none",background:D.panelB }}>
            <p style={{ fontFamily:D.font,fontSize:"1.4rem",fontWeight:700,color:stat.color,lineHeight:1,marginBottom:"0.3rem" }}>{stat.value}</p>
            <p style={{ fontFamily:D.font,fontSize:"0.7rem",letterSpacing:"0.2em",textTransform:"uppercase" as const,color:D.dim }}>{stat.label}</p>
          </div>
        ))}
      </div>

      <div style={{ display:"flex",gap:"1rem",marginBottom:"2rem",alignItems:"center",flexWrap:"wrap" as const }}>
        <div style={{ display:"flex",alignItems:"center",gap:"0.75rem",background:D.panelB,border:`1px solid ${searchFocused?`${D.orange}66`:D.border}`,padding:"0.65rem 1rem",flex:1,maxWidth:"380px",transition:"border-color 0.2s" }}>
          <Search size={13} color={searchFocused?D.orange:D.dim} style={{flexShrink:0}} />
          <input style={{ background:"none",border:"none",outline:"none",color:D.text,fontFamily:D.font,fontSize:"0.78rem",letterSpacing:"0.12em",textTransform:"uppercase" as const,flex:1,minWidth:0 }}
            placeholder="Search users --" value={query} onChange={e=>setQuery(e.target.value)}
            onFocus={()=>setSearchFocused(true)} onBlur={()=>setSearchFocused(false)} />
          {query&&<button onClick={()=>setQuery("")} style={{ background:"none",border:"none",cursor:"pointer",color:D.dim,fontSize:"1rem",padding:0,lineHeight:1 }}>�</button>}
        </div>
        <div style={{ display:"flex",gap:0,border:`1px solid ${D.border}` }}>
          {(["all","admin","user"] as const).map((f,i)=>(
            <button key={f} onClick={()=>setFilterRole(f)}
              style={{ background:filterRole===f?"rgba(255,95,31,0.12)":"transparent",border:"none",borderRight:i<2?`1px solid ${D.border}`:"none",cursor:"pointer",padding:"0.55rem 1rem",color:filterRole===f?D.orange:D.dim,fontFamily:D.font,fontSize:"0.4rem",letterSpacing:"0.15em",textTransform:"uppercase" as const,transition:"all 0.15s" }}>
              {f==="all"?"All":f==="admin"?"Admins":"Users"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length===0?(
        <div style={{ padding:"4rem",textAlign:"center",border:`1px solid ${D.border}`,background:D.panelB }}>
          <p style={{ fontFamily:D.font,fontSize:"0.5rem",letterSpacing:"0.2em",textTransform:"uppercase" as const,color:D.dim }}>No users match your query</p>
        </div>
      ):(
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:"1px",background:D.border,border:`1px solid ${D.border}` }}>
          {filtered.map(user=><UserCard key={user.id} user={user} isSuperAdmin={isSuperAdmin} isDark={isDark} onPromote={promoteUser} onSuspend={suspendUser} />)}
        </div>
      )}
    </div>
  );
}