const sb=supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
const cats=["Moradia","Alimentação","Transporte","Lazer","Saúde","Educação","Compras","Assinaturas","Contas","Outros"];
let user=null,tx=[],goals=[],selectedMonth=new Date().toISOString().slice(0,7);
const $=id=>document.getElementById(id),money=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const dateBR=v=>new Date(v+"T12:00:00").toLocaleDateString("pt-BR");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
function msg(el,t,ok=false){el.textContent=t;el.style.color=ok?"#12b76a":"#f04438"}
function open(id){$(id).classList.remove("hidden")} function close(id){$(id).classList.add("hidden")}
function page(p){document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));$(`${p}-page`).classList.remove("hidden");document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.page===p));window.scrollTo({top:0,behavior:"smooth"})}
function initMonths(){let s=$("month-filter"),now=new Date();for(let i=0;i<13;i++){let d=new Date(now.getFullYear(),now.getMonth()-i,1),v=d.toISOString().slice(0,7),label=d.toLocaleDateString("pt-BR",{month:"long",year:"numeric"});s.innerHTML+=`<option value="${v}">${label[0].toUpperCase()+label.slice(1)}</option>`}s.value=selectedMonth}
function fillCats(){$("tx-category").innerHTML=cats.map(c=>`<option>${c}</option>`).join("")}
async function load(){let [a,b]=await Promise.all([sb.from("transactions").select("*").order("date",{ascending:false}).order("created_at",{ascending:false}),sb.from("goals").select("*").order("created_at",{ascending:false})]);if(a.error)throw a.error;if(b.error)throw b.error;tx=a.data||[];goals=b.data||[];render()}
function render(){let mtx=tx.filter(t=>String(t.date).slice(0,7)===selectedMonth),inc=mtx.filter(t=>t.type==="income").reduce((s,t)=>s+Number(t.amount),0),exp=mtx.filter(t=>t.type==="expense").reduce((s,t)=>s+Number(t.amount),0);$("balance").textContent=money(inc-exp);$("income").textContent=money(inc);$("expense").textContent=money(exp);$("transaction-count").textContent=mtx.length;$("balance-status").textContent=inc-exp>=0?"Saldo positivo neste mês":"Atenção: despesas acima das entradas";
let map={};mtx.filter(t=>t.type==="expense").forEach(t=>map[t.category]=(map[t.category]||0)+Number(t.amount));let arr=Object.entries(map).sort((a,b)=>b[1]-a[1]),max=Math.max(...arr.map(x=>x[1]),1);$("category-list").innerHTML=arr.length?arr.map(([c,v])=>`<div class="cat-row"><span>${esc(c)}</span><div class="bar"><i style="width:${v/max*100}%"></i></div><strong>${money(v)}</strong></div>`).join(""):`<p class="muted">Nenhuma despesa neste mês.</p>`;
let recent=mtx.slice(0,5);$("recent-list").innerHTML=recent.length?recent.map(row).join(""):`<p class="muted">Nenhum lançamento neste mês.</p>`;renderTable();renderGoals()}
function row(t){return `<div class="tx-row"><div><div class="tx-title">${esc(t.description)}</div><div class="tx-meta">${esc(t.category)} · ${dateBR(t.date)} · ${esc(t.payment_method||"—")}</div></div><strong class="${t.type}">${t.type==="income"?"+":"−"} ${money(t.amount)}</strong></div>`}
function renderTable(){let q=($("search")?.value||"").toLowerCase(),typ=$("type-filter")?.value||"",arr=tx.filter(t=>String(t.date).slice(0,7)===selectedMonth&&(!typ||t.type===typ)&&(`${t.description} ${t.category}`.toLowerCase().includes(q)));$("transactions-table").innerHTML=arr.length?arr.map(t=>`<tr><td>${dateBR(t.date)}</td><td><b>${esc(t.description)}</b></td><td><span class="pill ${t.type}">${esc(t.category)}</span></td><td>${esc(t.payment_method||"—")}</td><td class="${t.type}"><b>${t.type==="income"?"+":"−"} ${money(t.amount)}</b></td><td><button class="delete" data-id="${t.id}">Excluir</button></td></tr>`).join(""):`<tr><td colspan="6" style="text-align:center;color:#98a2b3;padding:35px">Nenhum lançamento encontrado.</td></tr>`;document.querySelectorAll("[data-id]").forEach(b=>b.onclick=()=>del(b.dataset.id))}
function renderGoals(){$("goals-list").innerHTML=goals.length?goals.map(g=>{let t=Number(g.target_amount),c=Number(g.current_amount),p=Math.min(c/t*100,100);return `<article class="goal"><h3>${esc(g.name)}</h3><div class="goal-values"><span>${money(c)}</span><span>${money(t)}</span></div><div class="progress"><i style="width:${p}%"></i></div><div class="goal-values"><span>${p.toFixed(0)}% concluído</span><span>faltam ${money(Math.max(t-c,0))}</span></div></article>`}).join(""):`<div class="panel"><p class="muted">Você ainda não criou nenhuma meta.</p></div>`}
async function del(id){if(!confirm("Excluir este lançamento?"))return;let r=await sb.from("transactions").delete().eq("id",id);if(r.error)return alert(r.error.message);load()}
$("auth-form").onsubmit=async e=>{e.preventDefault();let signup=$("auth-title").dataset.signup==="1";let r=signup?await sb.auth.signUp({email:$("email").value,password:$("password").value}):await sb.auth.signInWithPassword({email:$("email").value,password:$("password").value});if(r.error)return msg($("auth-message"),r.error.message);if(signup&&!r.data.session)return msg($("auth-message"),"Conta criada. Verifique seu e-mail para confirmar.",true);start(r.data.user)}
$("toggle-auth").onclick=()=>{let signup=$("auth-title").dataset.signup!=="1";$("auth-title").dataset.signup=signup?"1":"0";$("auth-title").textContent=signup?"Criar sua conta":"Bem-vindo de volta";$("auth-submit").textContent=signup?"Criar conta":"Entrar";$("toggle-auth").textContent=signup?"Já tenho uma conta":"Criar uma conta";$("auth-message").textContent=""}
async function start(u){user=u;$("auth-screen").classList.add("hidden");$("app-screen").classList.remove("hidden");let name=u.email.split("@")[0];$("hello-name").textContent=name;$("user-name").textContent=name;$("user-email").textContent=u.email;$("avatar").textContent=name[0].toUpperCase();initMonths();fillCats();$("tx-date").value=new Date().toISOString().slice(0,10);try{await load()}catch(e){alert(e.message)}}
$("logout-btn").onclick=async()=>{await sb.auth.signOut();location.reload()};$("month-filter").onchange=e=>{selectedMonth=e.target.value;render()};$("search").oninput=renderTable;$("type-filter").onchange=renderTable;
document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>page(b.dataset.page));document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>page(b.dataset.go));
$("open-transaction").onclick=$("open-transaction-quick").onclick=$("open-transaction-2").onclick=()=>open("transaction-modal");$("open-goal").onclick=()=>open("goal-modal");$("bottom-add").onclick=()=>open("transaction-modal");document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>close(b.dataset.close));
$("transaction-form").onsubmit=async e=>{e.preventDefault();let r=await sb.from("transactions").insert({user_id:user.id,type:document.querySelector("[name=type]:checked").value,amount:+$("tx-amount").value,category:$("tx-category").value,description:$("tx-description").value.trim(),date:$("tx-date").value,payment_method:$("tx-payment").value});if(r.error)return msg($("tx-message"),r.error.message);e.target.reset();$("tx-date").value=new Date().toISOString().slice(0,10);close("transaction-modal");await load()}
$("goal-form").onsubmit=async e=>{e.preventDefault();let r=await sb.from("goals").insert({user_id:user.id,name:$("goal-name").value.trim(),target_amount:+$("goal-target").value,current_amount:+$("goal-current").value||0});if(r.error)return msg($("goal-message"),r.error.message);e.target.reset();close("goal-modal");await load()}
sb.auth.getSession().then(({data})=>{if(data.session)start(data.session.user)})

/* =========================================================
   METAS: MOVIMENTAÇÃO + HISTÓRICO + EXCLUSÃO
   BACKUP + PDF DO EXTRATO
   ========================================================= */
let goalMovements=[];
let selectedGoal=null;

async function load(){
  const [a,b,c]=await Promise.all([
    sb.from("transactions").select("*").order("date",{ascending:false}).order("created_at",{ascending:false}),
    sb.from("goals").select("*").order("created_at",{ascending:false}),
    sb.from("goal_movements").select("*").order("created_at",{ascending:false})
  ]);
  if(a.error)throw a.error;
  if(b.error)throw b.error;
  if(c.error)throw c.error;
  tx=a.data||[]; goals=b.data||[]; goalMovements=c.data||[]; render();
}

function renderGoals(){
  $("goals-list").innerHTML=goals.length?goals.map(g=>{
    const t=Number(g.target_amount),c=Number(g.current_amount),p=t>0?Math.min(c/t*100,100):0;
    const count=goalMovements.filter(m=>m.goal_id===g.id).length;
    return `<article class="goal"><div class="goal-header"><div><h3>${esc(g.name)}</h3><small class="goal-history-count">${count} ${count===1?'movimentação':'movimentações'}</small></div><button class="goal-delete" data-goal-delete="${g.id}">Excluir</button></div><div class="goal-values"><span>${money(c)}</span><span>${money(t)}</span></div><div class="progress"><i style="width:${p}%"></i></div><div class="goal-values"><span>${p.toFixed(0)}% concluído</span><span>faltam ${money(Math.max(t-c,0))}</span></div><div class="goal-actions"><button class="goal-btn goal-add" data-goal-add="${g.id}">+ Adicionar</button><button class="goal-btn goal-remove" data-goal-remove="${g.id}">− Retirar</button><button class="goal-btn goal-history" data-goal-history="${g.id}">Histórico</button></div></article>`
  }).join(""):`<div class="panel"><p class="muted">Você ainda não criou nenhuma meta.</p></div>`;
  document.querySelectorAll('[data-goal-add]').forEach(b=>b.onclick=()=>openMovementModal(b.dataset.goalAdd,'add'));
  document.querySelectorAll('[data-goal-remove]').forEach(b=>b.onclick=()=>openMovementModal(b.dataset.goalRemove,'remove'));
  document.querySelectorAll('[data-goal-history]').forEach(b=>b.onclick=()=>openGoalHistory(b.dataset.goalHistory));
  document.querySelectorAll('[data-goal-delete]').forEach(b=>b.onclick=()=>deleteGoal(b.dataset.goalDelete));
}
function openMovementModal(id,type){
  selectedGoal=goals.find(g=>g.id===id); if(!selectedGoal)return;
  $("movement-type").value=type; $("movement-title").textContent=type==='add'?'Adicionar valor':'Retirar valor';
  $("movement-description").textContent=`Meta: ${selectedGoal.name} • saldo atual ${money(selectedGoal.current_amount)}`;
  $("movement-amount").value=""; $("movement-message").textContent=""; open('movement-modal');
}
$("movement-form").onsubmit=async e=>{
  e.preventDefault(); if(!selectedGoal)return;
  const type=$("movement-type").value, amount=Number($("movement-amount").value), current=Number(selectedGoal.current_amount);
  if(!amount||amount<=0)return msg($("movement-message"),"Digite um valor válido.");
  if(type==='remove'&&amount>current)return msg($("movement-message"),"Você não pode retirar mais do que o valor atual da meta.");
  const newAmount=Math.round((type==='add'?current+amount:current-amount)*100)/100;
  const a=await sb.from('goal_movements').insert({goal_id:selectedGoal.id,user_id:user.id,type,amount});
  if(a.error)return msg($("movement-message"),a.error.message);
  const b=await sb.from('goals').update({current_amount:newAmount}).eq('id',selectedGoal.id).eq('user_id',user.id);
  if(b.error)return msg($("movement-message"),b.error.message);
  close('movement-modal'); selectedGoal=null; await load();
};
function openGoalHistory(id){
  const goal=goals.find(g=>g.id===id); if(!goal)return;
  $("history-title").textContent=`Histórico — ${goal.name}`;
  const rows=goalMovements.filter(m=>m.goal_id===id);
  $("history-list").innerHTML=rows.length?rows.map(m=>`<div class="movement-row"><div><b>${m.type==='add'?'Valor adicionado':'Valor retirado'}</b><small>${new Date(m.created_at).toLocaleString('pt-BR')}</small></div><strong class="${m.type==='add'?'income':'expense'}">${m.type==='add'?'+':'−'} ${money(m.amount)}</strong></div>`).join(''):`<p class="muted">Nenhuma movimentação registrada.</p>`;
  open('history-modal');
}
async function deleteGoal(id){
  const goal=goals.find(g=>g.id===id); if(!goal)return;
  if(!confirm(`Excluir a meta "${goal.name}"?\n\nO histórico dessa meta também será excluído.`))return;
  const r=await sb.from('goals').delete().eq('id',id).eq('user_id',user.id); if(r.error)return alert(r.error.message); await load();
}

function getBackupData(){return {format:'meu-financeiro-backup',version:2,exported_at:new Date().toISOString(),user_email:user?.email||null,transactions:tx.map(t=>({type:t.type,category:t.category,description:t.description,amount:Number(t.amount),date:t.date,payment_method:t.payment_method||null})),goals:goals.map(g=>({id:g.id,name:g.name,target_amount:Number(g.target_amount),current_amount:Number(g.current_amount)})),goal_movements:goalMovements.map(m=>({goal_id:m.goal_id,type:m.type,amount:Number(m.amount),created_at:m.created_at}))};}
function downloadBlob(content,filename,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportBackup(){if(!user)return alert('Faça login primeiro.');const stamp=new Date().toISOString().slice(0,10);downloadBlob(JSON.stringify(getBackupData(),null,2),`meu-financeiro-backup-${stamp}.json`,'application/json;charset=utf-8');}
let pendingBackup=null;
async function readBackupFile(file){try{const d=JSON.parse(await file.text());if(d?.format!=='meu-financeiro-backup')throw Error('Este arquivo não é um backup válido do Meu Financeiro.');if(!Array.isArray(d.transactions)||!Array.isArray(d.goals)||!Array.isArray(d.goal_movements))throw Error('O backup está incompleto ou corrompido.');pendingBackup=d;msg($("backup-message"),`${d.transactions.length} lançamentos, ${d.goals.length} metas e ${d.goal_movements.length} movimentações encontrados.`,true);open('backup-modal');}catch(e){alert(e.message||'Não foi possível ler o backup.');}}
async function importBackup(){if(!pendingBackup||!user)return;if(!confirm('Importar este backup?\n\nOs registros serão adicionados à conta atual.'))return;const d=pendingBackup;try{
  const goalMap={};
  for(const g of d.goals){const r=await sb.from('goals').insert({user_id:user.id,name:String(g.name||'Meta'),target_amount:Number(g.target_amount),current_amount:Number(g.current_amount||0)}).select('id').single();if(r.error)throw r.error;goalMap[g.id]=r.data.id;}
  if(d.transactions.length){const rows=d.transactions.map(t=>({user_id:user.id,type:t.type,category:String(t.category||'Outros'),description:String(t.description||'Lançamento'),amount:Number(t.amount),date:t.date,payment_method:t.payment_method||null}));const r=await sb.from('transactions').insert(rows);if(r.error)throw r.error;}
  for(const m of d.goal_movements){const gid=goalMap[m.goal_id];if(!gid)continue;const r=await sb.from('goal_movements').insert({goal_id:gid,user_id:user.id,type:m.type,amount:Number(m.amount),created_at:m.created_at||new Date().toISOString()});if(r.error)throw r.error;}
  pendingBackup=null;close('backup-modal');await load();alert('Backup importado com sucesso!');
}catch(e){msg($("backup-message"),e.message||'Erro ao importar backup.');}}

function generateStatementPDF(){
  if(!user)return alert('Faça login primeiro.'); if(!window.jspdf?.jsPDF)return alert('A biblioteca de PDF não foi carregada. Atualize a página.');
  const list=tx.filter(t=>String(t.date).slice(0,7)===selectedMonth).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const income=list.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0),expense=list.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0),balance=income-expense;
  const cats={};list.filter(t=>t.type==='expense').forEach(t=>cats[t.category]=(cats[t.category]||0)+Number(t.amount));
  const {jsPDF}=window.jspdf,doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'}),W=210,M=14,C=W-M*2;const moneyPDF=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});const ml=new Date(selectedMonth+'-01T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'});let y=16;
  doc.setFont('helvetica','bold');doc.setFontSize(20);doc.setTextColor(16,24,40);doc.text('MEU FINANCEIRO',M,y);y+=8;doc.setFont('helvetica','normal');doc.setFontSize(12);doc.text('Extrato financeiro',M,y);y+=6;doc.setFontSize(10);doc.setTextColor(100,116,139);doc.text(`Período: ${ml.charAt(0).toUpperCase()+ml.slice(1)}`,M,y);y+=4;doc.text(`Conta: ${user.email}`,M,y);y+=10;
  doc.setTextColor(16,24,40);doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text('Resumo do período',M,y);y+=6;const bw=(C-8)/3,bh=24;[['Entradas',income],['Despesas',expense],['Saldo',balance]].forEach((it,i)=>{const x=M+i*(bw+4);doc.setDrawColor(230,232,236);doc.roundedRect(x,y,bw,bh,3,3);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(102,112,133);doc.text(it[0],x+5,y+7);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(16,24,40);doc.text(moneyPDF(it[1]),x+5,y+16);});y+=bh+12;
  const catEntries=Object.entries(cats).sort((a,b)=>b[1]-a[1]);if(catEntries.length){doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(16,24,40);doc.text('Despesas por categoria',M,y);y+=7;catEntries.forEach(([c,v])=>{doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(c,M,y);doc.text(`${moneyPDF(v)} (${expense?((v/expense)*100).toFixed(0):0}%)`,W-M,y,{align:'right'});y+=5;});y+=5;}
  doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(16,24,40);doc.text('Lançamentos',M,y);y+=6;
  const header=()=>{doc.setFillColor(247,248,250);doc.rect(M,y,C,8,'F');doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(52,64,84);doc.text('Data',M+2,y+5);doc.text('Descrição',M+25,y+5);doc.text('Categoria',M+92,y+5);doc.text('Pagamento',M+133,y+5);doc.text('Valor',W-M-2,y+5,{align:'right'});y+=10;};header();
  if(!list.length){doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(100,116,139);doc.text('Nenhum lançamento neste período.',M,y);}else list.forEach(t=>{if(y>275){doc.addPage();y=16;header();}doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(52,64,84);doc.text(dateBR(t.date),M+2,y);doc.text(doc.splitTextToSize(String(t.description||''),62),M+25,y);doc.text(doc.splitTextToSize(String(t.category||''),37),M+92,y);doc.text(doc.splitTextToSize(String(t.payment_method||'—'),35),M+133,y);doc.setFont('helvetica','bold');doc.text(`${t.type==='income'?'+':'-'} ${moneyPDF(t.amount)}`,W-M-2,y,{align:'right'});doc.setDrawColor(235,237,240);doc.line(M,y+4,W-M,y+4);y+=9;});
  const pages=doc.internal.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(152,162,179);doc.text(`Meu Financeiro • Página ${i} de ${pages}`,M,290);doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`,W-M,290,{align:'right'});}doc.save(`extrato-${selectedMonth.replace('-','_')}.pdf`);
}

$('export-backup').onclick=exportBackup;
$('import-backup').onchange=e=>{const f=e.target.files?.[0];if(f)readBackupFile(f);e.target.value='';};
$('confirm-import-backup').onclick=importBackup;
$('generate-pdf').onclick=generateStatementPDF;
