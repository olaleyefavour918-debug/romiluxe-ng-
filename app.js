let D={retail:[],wholesale:[],perfume:[],cosmetics:[]}; // populated live from Supabase — see loadDbProducts()
const PRODUCT_TYPES=["retail","wholesale","perfume","cosmetics"];
const TYPE_LABELS={retail:"Retail",wholesale:"Wholesale",perfume:"Perfume",cosmetics:"Cosmetics"};

const WA="2349152313648";
const EMAILJS_SERVICE_ID="service_romiluxe";
const EMAILJS_TEMPLATE_ID="template_romiluxe";
const EMAILJS_PUBLIC_KEY="o5kr9qZdypx6GCieC";
const PAYMENT={bankName:"Palmpay",accountName:"Moromoke Ayomide Lawal",accountNumber:"9152313648"};
const SUPABASE_URL="https://crrtunosemhnmiaquevn.supabase.co";
const SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNycnR1bm9zZW1obm1pYXF1ZXZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1OTA4MjUsImV4cCI6MjEwMzE2NjgyNX0.H22GBlIwpMM9k-3X1K_ufZ91k4DOA9LArmG8c4b_LE8";

let cur,typ,q,cart=[],selectedColor=null,selectedDesign=null,selectedSize=null,productsLoadedOnce=false;
const money=n=>"₦"+Number(n).toLocaleString("en-NG");
const PAGE_URLS={retail:"retail.html",wholesale:"wholesale.html",perfumes:"perfumes.html",perfume:"perfumes.html",cosmetics:"cosmetics.html",services:"index.html#services",home:"index.html"};
const go=id=>{if(PAGE_URLS[id]){location.href=PAGE_URLS[id];return}document.getElementById(id)?.scrollIntoView({behavior:"smooth"})};
const cat=p=>(p.mixType&&typeof MIX_KINDS!=="undefined"&&MIX_KINDS[p.mixType]&&p.mixType!=="other")?p.mixType:mixDetect(p.name);
const wa=t=>"https://wa.me/"+WA+"?text="+encodeURIComponent(t);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
// Product photo tag: small thumbnail for lists (falls back to the full photo if the thumbnail is missing).
const WM={enabled:false,map:{}};      // watermark settings + {originalUrl:{w:watermarkedUrl,x:excluded}}
const WM_REV={};                      // watermarkedUrl -> originalUrl (used if a watermarked copy fails to load)
const wmu=u=>{
  if(!u||!WM.enabled)return u;
  const r=WM.map[u];
  if(r&&r.w&&!r.x){WM_REV[r.w]=u;return r.w}
  return u;
};
const imgTag=(url,alt,extra="")=>`<img src="${esc(thumbUrl(url))}" data-full="${esc(url)}" data-orig="${esc(WM_REV[url]||"")}" alt="${esc(alt)}" loading="lazy" decoding="async" onerror="imgFallback(this)" ${extra}>`;
const IMG_PLACEHOLDER="data:image/svg+xml;utf8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 120 120%27%3E%3Crect width=%27120%27 height=%27120%27 fill=%27%23eee%27/%3E%3Ctext x=%2760%27 y=%2766%27 font-size=%2711%27 text-anchor=%27middle%27 fill=%27%23999%27 font-family=%27sans-serif%27%3EPhoto unavailable%3C/text%3E%3C/svg%3E";
function imgFallback(img){
  const full=img.getAttribute("data-full"),orig=img.getAttribute("data-orig");
  const stage=Number(img.dataset.stage||0);
  img.dataset.stage=stage+1;
  if(stage===0&&full&&img.src!==full){img.src=full;return}
  if(stage<=1&&orig){img.dataset.stage=2;img.src=orig;return}
  img.onerror=null;img.src=IMG_PLACEHOLDER;
}
function setDetailImg(url){
  const di=document.getElementById("di");
  di.dataset.stage="0";di.dataset.full=url||"";di.dataset.orig=WM_REV[url]||"";
  di.onerror=function(){imgFallback(di)};
  di.src=url;
}

// RENDER PRODUCTS
function updateProductCounts(){
  const r=D.retail.length,w=D.wholesale.length,p=D.perfume.length,c=D.cosmetics.length;
  ["heroRetailCount","chooserRetailCount","sectionRetailCount"].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=r});
  ["heroWholesaleCount","chooserWholesaleCount","sectionWholesaleCount"].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=w});
  ["chooserPerfumeCount","sectionPerfumeCount"].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=p});
  ["chooserCosmeticsCount","sectionCosmeticsCount"].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=c});
}
const PRODUCT_CACHE_KEY="romiluxe-products-v3";
let productsLoadFailed=false;
async function sbGetJson(path,timeoutMs){
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),timeoutMs||20000);
  try{
    const res=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:{"apikey":SUPABASE_ANON_KEY,"Authorization":"Bearer "+SUPABASE_ANON_KEY},signal:ctrl.signal});
    if(!res.ok)throw new Error("Fetch failed: "+res.status);
    return await res.json();
  }finally{clearTimeout(timer)}
}
async function fetchProductRows(){
  let lastErr;
  for(let i=0;i<3;i++){
    try{
      const rows=await sbGetJson("products?is_deleted=eq.false&select=*&order=created_at.asc");
      if(!Array.isArray(rows))throw new Error("Unexpected response");
      return rows;
    }catch(e){lastErr=e;if(i<2)await new Promise(r=>setTimeout(r,1200*(i+1)))}
  }
  throw lastErr;
}
// Watermark: settings (on/off) + which photos have a watermarked copy. If this ever fails, the shop
// simply shows the original photos — it never blocks products from loading.
async function fetchWatermarkData(){
  try{
    const [st,recs]=await Promise.all([
      sbGetJson("watermark_settings?id=eq.1&select=enabled",10000),
      sbGetJson("image_watermarks?select=original_url,watermarked_url,excluded&limit=5000",15000)
    ]);
    const map={};
    (Array.isArray(recs)?recs:[]).forEach(r=>{if(r.original_url)map[r.original_url]={w:r.watermarked_url||"",x:!!r.excluded}});
    return{enabled:!!(Array.isArray(st)&&st[0]&&st[0].enabled),map};
  }catch(e){console.warn("Watermark data unavailable",e);return null}
}
function setWatermarkData(w){
  WM.enabled=!!(w&&w.enabled);WM.map=(w&&w.map)||{};
}
// Loads from Supabase. The last good copy is also kept on the device so the shop appears instantly
// (and still shows products if the connection is slow); it is refreshed on every visit.
async function loadDbProducts(){
  try{
    const [rows,wm]=await Promise.all([fetchProductRows(),fetchWatermarkData()]);
    if(wm)setWatermarkData(wm);
    applyProductRows(rows);
    try{localStorage.setItem(PRODUCT_CACHE_KEY,JSON.stringify({rows,wm:wm||{enabled:WM.enabled,map:WM.map}}))}catch(e){}
    productsLoadFailed=false;
    return true;
  }catch(e){
    console.error("Could not load products",e);
    productsLoadFailed=true;
    return false;
  }
}
function loadCachedProducts(){
  try{
    const c=JSON.parse(localStorage.getItem(PRODUCT_CACHE_KEY)||"null");
    if(c&&Array.isArray(c.rows)&&c.rows.length){setWatermarkData(c.wm);applyProductRows(c.rows);return true}
  }catch(e){}
  return false;
}
function applyProductRows(rows){
    D.retail=[];D.wholesale=[];D.perfume=[];D.cosmetics=[];
    rows.forEach(r=>{
      const cat=PRODUCT_TYPES.includes(r.category)?r.category:"retail";
      let colorVariants=[],mixMatch=false,mixType="",packMeta=0;
      const isFakePiercingSticker=/fake\s*piercing\s*sticker/i.test(String(r.name||''));
      // All wholesale products support Mix & Match by default, except the fake piercing sticker.
      if(cat==="wholesale" && !isFakePiercingSticker) mixMatch=true;
      if(r.color_variants){
        try{
          const parsed=typeof r.color_variants==="string"?JSON.parse(r.color_variants):r.color_variants;
          mixType=String(parsed?.meta?.mixType||"");packMeta=Number(parsed?.meta?.packSize)||0;
          colorVariants=(Array.isArray(parsed)?parsed:(Array.isArray(parsed?.variants)?parsed.variants:[])).filter(v=>v&&v.image).map(v=>({...v,image:wmu(v.image)}));
          // Several photos can share a name (e.g. five "Silver" bracelets). Number the repeats so each
          // one can be picked on its own and always shows its own photo.
          const seen={};
          colorVariants.forEach(v=>{const k=v.type==="design"?"design":"color";const nm=String(v[k]||"").trim();if(!nm)return;const id=k+"|"+nm.toLowerCase();seen[id]=(seen[id]||0)+1;if(seen[id]>1)v[k]=nm+" "+seen[id]});
          if(cat==="wholesale" && !isFakePiercingSticker){ mixMatch=true; }
          else if(cat==="wholesale" && isFakePiercingSticker){ mixMatch=false; }
          else { mixMatch=false; }
        }catch(e){console.warn("Invalid product variants for",r.id,e);colorVariants=[];mixMatch=false}
      }
      const item={
        id:Number(r.id),
        name:r.name,price:Number(r.price)||0,
        unit:cat==="wholesale"?(String(r.unit||"dozen").toLowerCase()):(r.unit||"piece"),
        packSize:cat==="wholesale"?packSizeOf(String(r.unit||"dozen").toLowerCase(),packMeta):1,
        image:wmu(r.image_url),
        description:r.description||"",
        moq:cat==="wholesale"?(Math.max(1,Math.floor(Number(r.moq))||6)):undefined,
        contents:cat==="wholesale"?(r.contents||""):undefined,
        colors:colorVariants.filter(v=>v.type!=="design").map(v=>v.color).filter(Boolean).length?colorVariants.filter(v=>v.type!=="design").map(v=>v.color).filter(Boolean):(r.colors?String(r.colors).split(",").map(s=>s.trim()).filter(Boolean):[]),
        colorVariants,
        mixMatch,mixType,
        sizes:r.sizes?String(r.sizes).split(",").map(s=>s.trim()).filter(Boolean):[]
      };
      D[cat].push(item);
    });
}
function renderGrid(type,filter){
  const g=document.getElementById(type[0]+"g");
  if(!g)return; // this page does not show that collection
  const items=D[type].filter(p=>filter==="all"||cat(p)===filter);
  if(!items.length&&!productsLoadedOnce){
    g.innerHTML="<p style='color:var(--muted);padding:20px'>Loading products…</p>";
    return;
  }
  if(!items.length&&productsLoadFailed&&filter==="all"){
    g.innerHTML="<p style='color:var(--muted);padding:20px'>We couldn't load products right now. <a href='javascript:void(0)' onclick='retryProducts()' style='color:var(--gold);text-decoration:underline'>Tap to try again</a>.</p>";
    return;
  }
  g.innerHTML=items.map(p=>`
    <article class="product-card" onclick="openP('${type}',${p.id})">
      <div class="product-img">${imgTag(p.image,p.name)}</div>
      <div class="product-body">
        <div class="product-type">${TYPE_LABELS[type]||type}</div>
        <div class="product-name">${esc(p.name)}</div>
        <div class="product-price">${money(p.price)}<span style="font-size:13px;font-weight:400;color:var(--muted)">/${p.unit}</span></div>
        <div class="product-meta">${type==="wholesale"?esc(p.contents||"Mix & match wholesale pieces") :`Individual ${(TYPE_LABELS[type]||"retail").toLowerCase()} item`}${p.colorVariants&&p.colorVariants.length?` · ${p.colorVariants.length} ${p.colorVariants.some(v=>v.type==="design")?"designs":"variants"}`:""}</div>
        <button class="product-cta">Add to Cart</button>
      </div>
    </article>`).join("")||"<p style='color:var(--muted);padding:20px'>No products found.</p>";
  initReveal(g);
}

function initReveal(container){
  const cards=container.querySelectorAll(".product-card");
  cards.forEach((c,i)=>{
    c.classList.add("reveal");
    c.style.transitionDelay=((i%4)*0.07).toFixed(2)+"s";
  });
  if(!("IntersectionObserver" in window)){
    cards.forEach(c=>c.classList.add("shown"));
    return;
  }
  const io=new IntersectionObserver((entries)=>{
    entries.forEach(en=>{
      if(en.isIntersecting){
        en.target.classList.add("shown");
        io.unobserve(en.target);
      }
    });
  },{threshold:0.15,rootMargin:"0px 0px -40px 0px"});
  cards.forEach(c=>io.observe(c));
}

function filterRetail(f,btn){
  document.querySelectorAll(".filter-row .filter-btn").forEach(b=>{if(b.closest("section")===btn.closest("section"))b.classList.remove("active")});
  btn.classList.add("active");
  renderGrid("retail",f);
}
function filterWholesale(f,btn){
  document.querySelectorAll(".wholesale .filter-btn").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  renderGrid("wholesale",f);
}

// PRODUCT MODAL
function openP(t,id){
  typ=t;cur=D[t].find(p=>p.id==id);
  if(!cur)return;
  q=t==="wholesale"?moqOf(cur):1;
  selectedColor=null;selectedDesign=null;selectedSize=null;
  document.getElementById("q").value=q;
  setDetailImg(cur.image);
  document.getElementById("dn").textContent=cur.name;
  document.getElementById("dt").textContent=t+" product";
  document.getElementById("dm").textContent=t==="wholesale"
    ?(cur.contents||"Wholesale pricing")+" · "+packNote(cur).replace(/^./,c=>c.toUpperCase())+(packOf(cur)>1?" · "+money(Number(cur.price)/packOf(cur))+" per piece":"")+" · Minimum order: "+moqOf(cur)+" pieces"
    :(TYPE_LABELS[t]||"Retail")+" · Individual item";
  document.getElementById("dp").textContent=money(cur.price);
  document.getElementById("du").textContent=t==="wholesale"?"/"+unitOf(cur):"/"+cur.unit;
  const detailMixBtn=document.getElementById("detailMixBtn");
  if(detailMixBtn)detailMixBtn.style.display=t==="wholesale"&&cur.mixMatch?"block":"none";
  renderDescription();
  renderVariantPickers();
  updateDetail();
  const same=D[t].filter(p=>p.id!=id&&cat(p)==cat(cur));
  const shown=[...same,...D[t].filter(p=>p.id!=id&&!same.includes(p))].slice(0,4);
  document.getElementById("sg").innerHTML=shown.map(p=>`
    <div class="sim-card" onclick="openP('${t}',${p.id})">
      ${imgTag(p.image,p.name)}
      <div class="sim-card-name">${esc(p.name)}</div>
    </div>`).join("");
  document.getElementById("modal").classList.add("open");
}
function renderDescription(){
  const el=document.getElementById("descWrap");
  if(cur.description&&cur.description.trim()){
    el.innerHTML=`<p style="font-size:14px;color:var(--muted);line-height:1.6;margin:8px 0 16px">${esc(cur.description).replace(/\n/g,"<br>")}</p>`;
  }else{
    el.innerHTML="";
  }
}
function renderVariantPickers(){
  const wrap=document.getElementById("variantWrap");
  let html="";
  const designs=(cur.colorVariants||[]).filter(v=>v.type==="design"&&v.image);
  const colors=(cur.colorVariants||[]).filter(v=>v.type!=="design"&&v.color);
  if(designs.length){
    html+=`<div class="variant-group"><div class="variant-label">Choose a design <span class="variant-count">(${designs.length} available)</span></div><p class="checkout-sub" style="margin:4px 0 10px">Tap one design to see its photo, then add it to your cart.</p><div class="variant-design-grid">
      ${designs.map((v,i)=>`
        <button type="button" class="variant-design-card" data-name="${esc(v.design||('Design '+(i+1)))}" data-img="${esc(v.image)}" onclick="selectDesignVariant(this.dataset.name,this.dataset.img,this)">
          ${imgTag(v.image,v.design||('Design '+(i+1)))}
          <span>${esc(v.design||('Design '+(i+1)))}</span>
        </button>`).join("")}
    </div></div>`;
  }
  if(colors.length){
    html+=`<div class="variant-group"><div class="variant-label">Choose a colour <span class="variant-count">(${colors.length} available)</span></div><p class="checkout-sub" style="margin:4px 0 10px">Tap one colour to see its photo.</p><div class="variant-options">
      ${colors.map(v=>`
        <button type="button" class="variant-swatch" data-name="${esc(v.color)}" data-img="${esc(v.image)}" onclick="selectColorVariant(this.dataset.name,this.dataset.img,this)">
          ${imgTag(v.image,v.color)}
          <span>${esc(v.color)}</span>
        </button>`).join("")}
    </div></div>`;
  }
  if(cur.sizes&&cur.sizes.length){
    html+=`<div class="variant-group"><div class="variant-label">Size</div><div class="variant-options">
      ${cur.sizes.map(s=>`<button type="button" class="variant-chip" data-name="${esc(s)}" onclick="selectVariant('size',this.dataset.name,this)">${esc(s)}</button>`).join("")}
    </div></div>`;
  }
  wrap.innerHTML=html;
}
function selectDesignVariant(design,image,btn){
  const alreadySelected=btn.classList.contains("selected");
  if(alreadySelected){
    selectedDesign=null;
    setDetailImg(cur.image);
    btn.classList.remove("selected");
  }else{
    selectedDesign=design;
    setDetailImg(image);
    btn.parentElement.querySelectorAll(".variant-design-card").forEach(c=>c.classList.remove("selected"));
    btn.classList.add("selected");
  }
}
function selectColorVariant(color,image,btn){
  const alreadySelected=btn.classList.contains("selected");
  if(alreadySelected){
    // Tapping the same colour again deselects it and returns to the default cover photo.
    selectedColor=null;
    setDetailImg(cur.image);
    btn.classList.remove("selected");
  }else{
    selectedColor=color;
    setDetailImg(image);
    btn.parentElement.querySelectorAll(".variant-swatch").forEach(c=>c.classList.remove("selected"));
    btn.classList.add("selected");
  }
}
function selectVariant(kind,value,btn){
  if(kind==="color")selectedColor=value;else selectedSize=value;
  btn.parentElement.querySelectorAll(".variant-chip").forEach(c=>c.classList.remove("selected"));
  btn.classList.add("selected");
}
function closeM(){document.getElementById("modal").classList.remove("open")}
function setQ(v){q=Math.max(typ==="wholesale"?moqOf(cur):1,Math.floor(Number(v)||1));document.getElementById("q").value=q;updateDetail()}
function chg(n){setQ(q+n)}
function updateDetail(){
  const total=typ==="wholesale"?(Number(cur.price)/packOf(cur))*q:Number(cur.price)*q;
  document.getElementById("tot").textContent="Total: "+money(total);
}

// WHOLESALE MIX & MATCH
const WHOLESALE_MOQ=6; // default only; each wholesale product has its own minimum order quantity (set in the admin)
const moqOf=p=>Math.max(1,Math.floor(Number(p&&p.moq))||WHOLESALE_MOQ);
const groupMoq=g=>Math.max(1,Math.floor(Number(String(g||"").split("|")[2]))||WHOLESALE_MOQ);
const WHOLESALE_MIN_TOTAL=15000;
let mixGroup=null,mixSelections={};
// Mix & Match only combines pieces of the SAME KIND (necklace with necklace, bracelet with bracelet...)
// AND the same wholesale price. The kind is set in the admin; if not set it is read from the product name.
const MIX_KINDS={packaging:"Packaging materials",props:"Props",necklace:"Necklaces",bracelet:"Bracelets",bangle:"Bangles",nosering:"Nose rings",earring:"Earrings",legchain:"Leg chains",waistchain:"Waist chains",watch:"Wristwatches",beads:"Beads",costume:"Costumes",other:"Other items"};
function mixDetect(name){
  const s=String(name||"").toLowerCase();
  if(/packag|gift\s*box|jewell?ery\s*box|pouch|ribbon|bubble\s*wrap|\bbox(es)?\b|carton/.test(s))return"packaging";
  if(/\bprops?\b|display|\bstand\b|mannequin|\bbust\b|\btray\b|\bholder\b/.test(s))return"props";
  if(/necklace|choker|pendant/.test(s))return"necklace";
  if(/bangle/.test(s))return"bangle";
  if(/bracelet|cuff/.test(s))return"bracelet";
  if(/nose\s*-?(ring|pin|stud)/.test(s))return"nosering";
  if(/earring|hoop|stud/.test(s))return"earring";
  if(/leg\s*-?chain|anklet/.test(s))return"legchain";
  if(/waist\s*-?chain|belly\s*-?chain/.test(s))return"waistchain";
  if(/watch/.test(s))return"watch";
  if(/bead/.test(s))return"beads";
  if(/costume/.test(s))return"costume";
  return"other";
}
function mixKind(p){return cat(p)}
function wholesaleGroupKey(p){return `${mixKind(p)}|${Number(p.price).toFixed(2)}|${moqOf(p)}|${unitOf(p)}|${packOf(p)}`}
function packSizeOf(unit,meta){const m=Math.floor(Number(meta));if(m>=1)return m;if(unit==="piece")return 1;return 12}
const unitOf=p=>String((p&&p.unit)||"dozen");
const packOf=p=>Math.max(1,Math.floor(Number(p&&p.packSize))||12);
const groupUnit=g=>String(g||"").split("|")[3]||"dozen";
const groupPack=g=>Math.max(1,Math.floor(Number(String(g||"").split("|")[4]))||12);
const packNote=p=>packOf(p)===1?"sold per piece":`sold per ${unitOf(p)} (${packOf(p)} pieces)`;
function wholesalePackPieces(p){return packOf(p)}
function wholesalePiecePrice(p){return Number(p.price)/wholesalePackPieces(p)}
function wholesaleVariants(p){
  const vs=(p.colorVariants||[]).filter(v=>v&&v.image);
  if(vs.length)return vs.map((v,i)=>({
    key:`${p.id}-${v.type||'color'}-${i}`,
    productId:p.id,productName:p.name,
    label:v.type==="design"?(v.design||`Design ${i+1}`):(v.color||`Colour ${i+1}`),
    image:v.image
  }));
  return [{key:`${p.id}-base`,productId:p.id,productName:p.name,label:"Main design",image:p.image}];
}
function openWholesaleMix(id){
  const selected=D.wholesale.find(p=>p.id==id);
  if(!selected)return;
  if(!selected.mixMatch){alert("Mix & Match is not available for this product.");return}
  mixGroup=wholesaleGroupKey(selected);
  mixSelections={};
  const group=D.wholesale.filter(p=>wholesaleGroupKey(p)===mixGroup&&p.mixMatch);
  const kindLabel=MIX_KINDS[mixKind(selected)]||"items",gMoq=moqOf(selected);
  document.getElementById("mixTitle").textContent=`Mix & Match ${kindLabel} · ${money(selected.price)} per ${unitOf(selected)} · min ${gMoq} pieces`;
  document.getElementById("mixIntro").textContent=`Choose any combination from the Mix & Match ${kindLabel.toLowerCase()} at ${money(selected.price)} per ${unitOf(selected)}${packOf(selected)>1?" ("+packOf(selected)+" pieces)":""}. You can mix designs and colours of the same kind of item, but not different kinds (e.g. necklaces with bracelets), different wholesale prices or different minimum order quantities. Minimum for this group: ${gMoq} pieces.`;
  const list=document.getElementById("mixGroupList");
  list.innerHTML=group.map(p=>{
    const variants=wholesaleVariants(p);
    return `<div class="mix-product"><div class="mix-product-head">${imgTag(p.image,p.name)}<div><div class="mix-product-name">${esc(p.name)}</div><div class="mix-product-price">${money(p.price)} per ${unitOf(p)}${packOf(p)>1?" ("+packOf(p)+" pieces)":""} · ${money(wholesalePiecePrice(p))} per piece</div></div></div><div class="mix-choices">${variants.map(v=>{mixSelections[v.key]=0;return `<div class="mix-choice">${imgTag(v.image,v.label)}<div><div class="mix-choice-name">${esc(v.label)}</div><div class="mix-choice-sub">Add pieces of this design</div></div><div class="mix-stepper"><button type="button" data-k="${esc(v.key)}" onclick="changeMixQty(this.dataset.k,-1)">−</button><span id="mixq-${cssKey(v.key)}">0</span><button type="button" data-k="${esc(v.key)}" onclick="changeMixQty(this.dataset.k,1)">+</button></div></div>`}).join("")}</div></div>`;
  }).join("");
  updateMixSummary();
  document.getElementById("wholesaleMixModal").classList.add("open");
}
function escAttr(s){return String(s).replace(/\\/g,"\\\\").replace(/'/g,"\\'")}
function cssKey(s){return String(s).replace(/[^a-zA-Z0-9_-]/g,"_")}
function changeMixQty(key,delta){
  if(!(key in mixSelections))return;
  mixSelections[key]=Math.max(0,(mixSelections[key]||0)+delta);
  const el=document.getElementById("mixq-"+cssKey(key));if(el)el.textContent=mixSelections[key];
  updateMixSummary();
}
function mixPieces(){return Object.values(mixSelections).reduce((a,b)=>a+b,0)}
function mixSubtotal(){
  if(!mixGroup)return 0;
  const price=Number(mixGroup.split("|")[1]);
  return mixPieces()*(price/groupPack(mixGroup));
}
function updateMixSummary(){
  const pieces=mixPieces(),subtotal=mixSubtotal();
  document.getElementById("mixPieces").textContent=pieces;
  document.getElementById("mixSubtotal").textContent=money(subtotal);
  const rule=document.getElementById("mixRule");
  const gm=groupMoq(mixGroup);
  if(pieces<gm){rule.textContent=`Choose ${gm} or more pieces to add this selection to your cart.`}
  else if(subtotal<WHOLESALE_MIN_TOTAL){rule.textContent=`✓ ${pieces} pieces selected. You can add this to your cart now. Checkout unlocks when your wholesale subtotal reaches ${money(WHOLESALE_MIN_TOTAL)}.`}
  else{rule.textContent=`✓ ${pieces} pieces selected. Your wholesale selection is ready for checkout.`}
}
function closeWholesaleMix(){document.getElementById("wholesaleMixModal").classList.remove("open")}
function addWholesaleMixToCart(){
  const pieces=mixPieces(),subtotal=mixSubtotal();
  // Customers may add a valid 6+ piece wholesale selection to the cart even
  // when its value is below ₦15,000. The ₦15,000 rule is a CHECKOUT rule.
  if(pieces<groupMoq(mixGroup)){alert(`Please select at least ${groupMoq(mixGroup)} pieces before adding to cart.`);return}
  // Only compare against other Mix & Match selections already in the cart — individually-added
  // wholesale products (different feature, different rule) shouldn't block a valid mix purchase.
  const existingWholesaleGroups=[...new Set(cart.filter(x=>x.typ==="wholesale"&&x.key.startsWith("wholesale-mix-")).map(x=>x.wholesaleGroup||"legacy"))];
  if(existingWholesaleGroups.length&&(!existingWholesaleGroups.includes(mixGroup)||existingWholesaleGroups.length>1)){
    alert("Your cart already has a different Mix & Match group (a different kind of item or price). Different kinds or prices cannot be mixed together in one Mix & Match order.");
    return;
  }
  const groupProducts=D.wholesale.filter(p=>wholesaleGroupKey(p)===mixGroup);
  const price=Number(mixGroup.split("|")[1]);
  Object.entries(mixSelections).forEach(([key,qty])=>{
    if(!qty)return;
    const productId=Number(key.split("-")[0]);
    const p=groupProducts.find(x=>x.id===productId);if(!p)return;
    const v=wholesaleVariants(p).find(x=>x.key===key);if(!v)return;
    const cartKey=`wholesale-mix-${mixGroup}-${key}`;
    const displayName=`${p.name} (${v.label})`;
    const ex=cart.find(x=>x.key===cartKey);
    if(ex)ex.qty+=qty;
    else cart.push({key:cartKey,typ:"wholesale",id:p.id,name:displayName,price:price/groupPack(mixGroup),unit:"piece",qty,image:v.image,wholesaleGroup:mixGroup});
  });
  updateCartUI();closeWholesaleMix();openCart();
}

// CART
function addCurrentToCart(){
  const designVariants=(cur.colorVariants||[]).filter(v=>v.type==="design"&&v.image);
  const colorVariants=(cur.colorVariants||[]).filter(v=>v.type!=="design"&&v.color);
  const hasLegacyColors=!designVariants.length&&(cur.colors||[]).length>0&&!colorVariants.length;
  if(designVariants.length&&!selectedDesign){alert("Please select a design before adding to cart.");return}
  if((colorVariants.length||hasLegacyColors)&&!selectedColor){alert("Please select a colour before adding to cart.");return}
  if(cur.sizes&&cur.sizes.length&&!selectedSize){alert("Please select a size before adding to cart.");return}
  if(typ==="wholesale"&&q<moqOf(cur)){alert(`This product requires at least ${moqOf(cur)} pieces.`);return}
  const selectedVariant=selectedDesign||selectedColor;
  const variantSuffix=[selectedVariant,selectedSize].filter(Boolean).join("/");
  const key=typ+"-"+cur.id+(variantSuffix?"-"+variantSuffix:"");
  const displayName=cur.name+(variantSuffix?` (${[selectedVariant,selectedSize].filter(Boolean).join(", ")})`:"");
  const variantMatch=cur.colorVariants&&cur.colorVariants.find(v=>(v.type==="design"?v.design:v.color)===selectedVariant);
  const cartImage=variantMatch?variantMatch.image:cur.image;
  const cartPrice=typ==="wholesale"?Number(cur.price)/packOf(cur):Number(cur.price);
  const cartUnit=typ==="wholesale"?"piece":cur.unit;
  const wholesaleGroup=typ==="wholesale"?wholesaleGroupKey(cur):null;
  // Note: individually-added wholesale products (each already meeting its own MOQ on its
  // own product page) are free to mix different price groups in the same cart/order.
  // The "can't mix price groups" rule applies only within the Mix & Match tool itself,
  // where multiple products are pooled together under one shared averaged price.
  const ex=cart.find(x=>x.key===key);
  if(ex)ex.qty+=q;
  else cart.push({key,typ,id:cur.id,name:displayName,price:cartPrice,unit:cartUnit,qty:q,image:cartImage,wholesaleGroup});
  updateCartUI();closeM();openCart();
}
function removeFromCart(key){cart=cart.filter(x=>x.key!==key);updateCartUI();renderCart()}
function changeCartQty(key,delta){
  const item=cart.find(x=>x.key===key);if(!item)return;
  const prod=D[item.typ].find(p=>p.id===item.id);
  if(item.typ==="wholesale"&&item.wholesaleGroup){
    item.qty=Math.max(0,item.qty+delta);
    if(item.qty===0)cart=cart.filter(x=>x.key!==key);
  }else{
    item.qty=Math.max(item.typ==="wholesale"?moqOf(prod):1,item.qty+delta);
  }
  updateCartUI();renderCart();
}
// Each wholesale product has its own minimum order quantity. Direct-add lines are checked per product,
// Mix & Match lines per mix group (same kind + price + minimum), so nothing gets mixed up.
function wholesaleMoqProblems(){
  const out=[],single={},mix={};
  cart.filter(x=>x.typ==="wholesale").forEach(x=>{
    if(x.key.startsWith("wholesale-mix-")){const g=x.wholesaleGroup||"legacy";mix[g]=(mix[g]||0)+x.qty}
    else{single[x.id]=(single[x.id]||0)+x.qty}
  });
  Object.entries(single).forEach(([id,n])=>{const p=D.wholesale.find(p=>p.id==id),m=moqOf(p);if(n<m)out.push(`${p?p.name:"A wholesale product"}: minimum ${m} pieces (you have ${n})`)});
  Object.entries(mix).forEach(([g,n])=>{const m=groupMoq(g),k=g.split("|")[0];if(n<m)out.push(`${MIX_KINDS[k]||"Mix & Match"} at ${money(Number(g.split("|")[1])||0)}: minimum ${m} pieces (you have ${n})`)});
  return out;
}
function cartTotal(){return cart.reduce((s,x)=>s+x.price*x.qty,0)}
function cartCount(){return cart.reduce((s,x)=>s+x.qty,0)}
const CART_KEY="romiluxe-cart-v1";
function saveCart(){try{localStorage.setItem(CART_KEY,JSON.stringify({t:Date.now(),cart}))}catch(e){}}
function loadSavedCart(){
  try{const o=JSON.parse(localStorage.getItem(CART_KEY)||"null");
    if(o&&Array.isArray(o.cart)&&Date.now()-o.t<7*864e5)cart=o.cart.filter(x=>x&&x.key&&x.qty>0&&Number.isFinite(Number(x.price)));
  }catch(e){}
}
function updateCartUI(){saveCart();
  const c=cartCount();
  document.getElementById("cartCount").textContent=c;
  document.getElementById("cartFabCount").textContent=c;
  const fab=document.getElementById("cartFab");
  fab.classList.remove("bump");
  void fab.offsetWidth;
  fab.classList.add("bump");
}
function renderCart(){
  const list=document.getElementById("cartList");
  const summary=document.getElementById("cartSummary");
  if(!cart.length){
    list.innerHTML=`<div class="empty-cart"><span class="empty-cart-icon">🛍️</span><p>Your cart is empty.<br>Add products from the collections above.</p></div>`;
    summary.innerHTML="";return;
  }
  list.innerHTML=cart.map(x=>`
    <div class="cart-item">
      ${imgTag(x.image,x.name)}
      <div>
        <div class="cart-item-name">${esc(x.name)}</div>
        <div class="cart-item-meta">${TYPE_LABELS[x.typ]||"Retail"} · ${x.qty} ${x.unit}${x.qty!==1?"s":""} × ${money(x.price)}</div>
        <button class="cart-remove" data-k="${esc(x.key)}" onclick="removeFromCart(this.dataset.k)">Remove</button>
      </div>
      <div>
        <div class="cart-item-price">${money(x.price*x.qty)}</div>
        <div class="cart-item-actions">
          <button class="cart-qty-btn" data-k="${esc(x.key)}" onclick="changeCartQty(this.dataset.k,-1)">−</button>
          <button class="cart-qty-btn" data-k="${esc(x.key)}" onclick="changeCartQty(this.dataset.k,1)">+</button>
        </div>
      </div>
    </div>`).join("");
  const wholesaleGroups={};
  cart.filter(x=>x.typ==="wholesale").forEach(x=>{const g=x.wholesaleGroup||"legacy";wholesaleGroups[g]=(wholesaleGroups[g]||0)+x.qty*x.price});
  const hasWholesale=Object.keys(wholesaleGroups).length>0;
  const groupCount=cart.filter(x=>x.typ==="wholesale").reduce((s,x)=>s+x.qty,0);
  const wholesaleSubtotal=cart.filter(x=>x.typ==="wholesale").reduce((s,x)=>s+x.qty*x.price,0);
  let note=hasWholesale?`<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Wholesale: ${groupCount} pieces · ${money(wholesaleSubtotal)}. Each product has its own minimum quantity, and the wholesale subtotal must reach ${money(WHOLESALE_MIN_TOTAL)}. Retail items have no ₦15,000 minimum.</div>`:"";
  const checkoutReady=(!hasWholesale)||(()=>{
    const pieces=cart.filter(x=>x.typ==="wholesale").reduce((s,x)=>s+x.qty,0);
    const subtotal=cart.filter(x=>x.typ==="wholesale").reduce((s,x)=>s+x.qty*x.price,0);
    return wholesaleMoqProblems().length===0&&subtotal>=WHOLESALE_MIN_TOTAL;
  })();
  const checkoutButton=checkoutReady
    ? `<button class="btn-primary" onclick="startCheckout()">Proceed to Checkout →</button>`
    : hasWholesale
      ? `<button class="btn-primary" onclick="startCheckout()">Proceed to Checkout →</button><div style="font-size:12px;color:var(--muted);margin-top:8px;text-align:center">Wholesale checkout unlocks at ${money(WHOLESALE_MIN_TOTAL)}. Your selection is safely saved in your cart.</div>`
      : `<button class="btn-primary" onclick="startCheckout()">Proceed to Checkout →</button>`;
  summary.innerHTML=note+`<strong class="cart-total">Total: ${money(cartTotal())}</strong>`+checkoutButton;
}
function openCart(){renderCart();document.getElementById("cartModal").classList.add("open")}
function closeCart(){document.getElementById("cartModal").classList.remove("open")}

// CHECKOUT
function startCheckout(){
  if(!cart.length)return;
  const wholesaleItems=cart.filter(x=>x.typ==="wholesale");
  if(wholesaleItems.length){
    // Wholesale price groups can now be freely mixed all the way through checkout —
    // pieces and subtotal below are the combined total across every wholesale item
    // in the cart, regardless of which price group each one belongs to.
    const pieces=wholesaleItems.reduce((s,x)=>s+x.qty,0);
    const subtotal=wholesaleItems.reduce((s,x)=>s+x.qty*x.price,0);
    const moqIssues=wholesaleMoqProblems();
    if(moqIssues.length){alert("Minimum order quantity not met:\n• "+moqIssues.join("\n• "));return}
    if(subtotal<WHOLESALE_MIN_TOTAL){alert(`Wholesale checkout requires a minimum subtotal of ${money(WHOLESALE_MIN_TOTAL)}.`);return}
  }
  closeCart();
  document.getElementById("bankName").textContent=PAYMENT.bankName;
  document.getElementById("accountName").textContent=PAYMENT.accountName;
  document.getElementById("accountNumber").textContent=PAYMENT.accountNumber;
  document.getElementById("checkoutItems").innerHTML=
    `<div class="order-summary-title">Order Summary</div>`+
    cart.map(x=>`<div class="order-line"><span>${esc(x.name)} × ${x.qty} ${esc(x.unit)}</span><b>${money(x.price*x.qty)}</b></div>`).join("")+
    `<div class="order-total-line"><span>Total</span><span>${money(cartTotal())}</span></div>`;
  document.getElementById("checkoutMsg").textContent="";
  document.getElementById("checkoutModal").classList.add("open");
}
function closeCheckout(){document.getElementById("checkoutModal").classList.remove("open")}

// ORDER
function makeOrderId(){
  const n=new Date();
  const s=n.getFullYear().toString().slice(-2)+String(n.getMonth()+1).padStart(2,"0")+String(n.getDate()).padStart(2,"0");
  return "RN-"+s+"-"+Math.random().toString(36).slice(2,7).toUpperCase();
}
// ---- Image storage (Supabase Storage — public bucket "romiluxe") ----
// Photos are resized in the browser, converted to JPEG (white background, so transparent PNGs
// never turn black), uploaded with a 1-year cache header, and a small thumbnail copy is stored
// next to each product photo so the shop pages load fast and use very little data.
const STORAGE_BUCKET="romiluxe";
function storagePublicUrl(path){return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`}
function thumbUrl(url){
  const s=String(url||"");const q=s.indexOf("?");
  const base=q<0?s:s.slice(0,q),qs=q<0?"":s.slice(q);
  const pub=`/storage/v1/object/public/${STORAGE_BUCKET}/`;
  if((base.includes(pub+"products/")||base.includes(pub+"wm/"))&&/\.jpg$/i.test(base)&&!/_t\.jpg$/i.test(base))return base.replace(/\.jpg$/i,"_t.jpg")+qs;
  return s;
}
async function decodeImage(file){
  if(window.createImageBitmap){
    try{const bmp=await createImageBitmap(file);return{w:bmp.width,h:bmp.height,draw:(ctx,w,h)=>ctx.drawImage(bmp,0,0,w,h),close:()=>{try{bmp.close()}catch(e){}}}}catch(e){}
  }
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error("decode"));i.src=url});
    return{w:img.naturalWidth,h:img.naturalHeight,draw:(ctx,w,h)=>ctx.drawImage(img,0,0,w,h),close:()=>URL.revokeObjectURL(url)};
  }catch(e){
    URL.revokeObjectURL(url);
    throw new Error("This photo could not be opened. Please choose a normal JPG, PNG or WEBP photo (HEIC files are not supported).");
  }
}
async function renderJpeg(src,maxDim,quality){
  let w=src.w,h=src.h;
  if(!w||!h)throw new Error("This photo looks empty. Please choose another one.");
  const scale=Math.min(1,maxDim/Math.max(w,h));
  w=Math.max(1,Math.round(w*scale));h=Math.max(1,Math.round(h*scale));
  const canvas=document.createElement("canvas");
  canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext("2d");
  ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h);
  src.draw(ctx,w,h);
  const blob=await new Promise(r=>canvas.toBlob(r,"image/jpeg",quality));
  canvas.width=canvas.height=0; // release memory right away
  if(!blob)throw new Error("Could not prepare this photo. Please try a different one.");
  return blob;
}
async function putToStorage(path,blob){
  let lastErr;
  for(let attempt=1;attempt<=3;attempt++){
    const ctrl=new AbortController();
    const timer=setTimeout(()=>ctrl.abort(),60000);
    try{
      const res=await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`,{
        method:"POST",signal:ctrl.signal,
        headers:{"apikey":SUPABASE_ANON_KEY,"Authorization":"Bearer "+SUPABASE_ANON_KEY,"Content-Type":"image/jpeg","cache-control":"max-age=31536000","x-upsert":"false"},
        body:blob
      });
      if(res.ok)return storagePublicUrl(path);
      const t=await res.text().catch(()=>"");
      if(res.status===404||/bucket not found/i.test(t))throw Object.assign(new Error("The photo storage has not been set up yet. Please run storage_setup.sql once in Supabase (SQL Editor)."),{fatal:true});
      if(res.status===401||res.status===403||/row-level security|policy/i.test(t))throw Object.assign(new Error("Photo uploads are not allowed yet. Please run storage_setup.sql once in Supabase (SQL Editor)."),{fatal:true});
      if(res.status===413)throw Object.assign(new Error("This photo is too large to upload."),{fatal:true});
      lastErr=new Error("Upload failed ("+res.status+"). "+t.slice(0,160));
    }catch(e){
      if(e.fatal)throw e;
      lastErr=e.name==="AbortError"?new Error("The upload took too long. Please check your connection and try again."):(e.message&&!/Failed to fetch|NetworkError|Load failed/i.test(e.message)?e:new Error("Could not connect to photo storage. Please check your internet connection and try again."));
    }finally{clearTimeout(timer)}
    if(attempt<3)await new Promise(r=>setTimeout(r,800*attempt));
  }
  throw lastErr;
}
// folder: "products" (also stores a thumbnail) or "proofs" (single file).
async function uploadImage(file,folder){
  if(!file)throw new Error("No image was selected.");
  if(file.size>25*1024*1024)throw new Error("The selected image is too large. Please choose an image under 25MB.");
  const src=await decodeImage(file);
  try{
    const id=Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,10);
    const main=await renderJpeg(src,folder==="products"?1280:1600,folder==="products"?0.82:0.8);
    const url=await putToStorage(`${folder}/${id}.jpg`,main);
    if(folder==="products"){
      try{const th=await renderJpeg(src,480,0.76);await putToStorage(`${folder}/${id}_t.jpg`,th)}
      catch(e){console.warn("Thumbnail upload skipped",e)} // shop falls back to the full photo automatically
    }
    return url;
  }finally{src.close()}
}

async function saveOrderToSupabase(order){
  const res=await fetch(`${SUPABASE_URL}/rest/v1/orders`,{
    method:"POST",
    headers:{
      "apikey":SUPABASE_ANON_KEY,
      "Authorization":"Bearer "+SUPABASE_ANON_KEY,
      "Content-Type":"application/json",
      "Prefer":"return=minimal"
    },
    body:JSON.stringify(order)
  });
  if(!res.ok){const t=await res.text().catch(()=>"");throw new Error("Supabase save failed: "+res.status+" "+t)}
}
async function submitOrder(){
  const name=document.getElementById("customerName").value.trim();
  const phone=document.getElementById("customerPhone").value.trim();
  const email=document.getElementById("customerEmail").value.trim();
  const city=document.getElementById("customerCity").value.trim();
  const address=document.getElementById("customerAddress").value.trim();
  const proofInput=document.getElementById("paymentProof");
  const proofFile=proofInput.files[0];
  const msg=document.getElementById("checkoutMsg");

  if(!name||!phone||!email||!city||!address||!proofFile){
    msg.textContent="Please complete all required fields and upload your proof of payment.";return;
  }
  const digits=phone.replace(/\D/g,"");
  if(digits.length<10||digits.length>11){
    msg.textContent="Please enter a valid phone number (10 or 11 digits e.g. 08012345678).";
    document.getElementById("customerPhone").focus();return;
  }
  if(!["image/png","image/jpeg","image/webp"].includes(proofFile.type)){
    msg.textContent="Please upload a PNG, JPG or WEBP screenshot.";return;
  }
  if(proofFile.size>5*1024*1024){msg.textContent="Please choose an image smaller than 5 MB.";return}
  if(!cart.length){msg.textContent="Your cart is empty.";return}

  const btn=document.getElementById("submitOrderBtn");
  btn.disabled=true;btn.textContent="Uploading proof…";
  msg.textContent="Uploading your payment screenshot…";

  const orderId=makeOrderId();
  // Keep product images with the order so the admin can see exactly what was ordered.
  // The image line is parsed by the admin and hidden from the customer's order summary.
  const itemsList=cart.map(x=>`• [${TYPE_LABELS[x.typ]||"Retail"}] ${x.name} — ${x.qty} ${x.unit} — ${money(x.price*x.qty)}\n  [Product image: ${x.image||""}]`).join("\n");
  const imageUrls=cart.map(x=>x.image).filter(Boolean).join("\n");
  const orderDate=new Date().toLocaleString("en-NG",{dateStyle:"full",timeStyle:"short"});

  try{
    const proofImageUrl=await uploadImage(proofFile,"proofs");
    btn.textContent="Saving order…";msg.textContent="Saving your order…";
    // Save to Supabase FIRST — this is the source of truth for the order and must succeed.
    // Sending the notification email is done afterwards as a best-effort step: if the
    // seller's email quota is used up or EmailJS is briefly down, the order itself is
    // still safely recorded and visible in the admin Orders tab either way.
    await saveOrderToSupabase({
      order_id:orderId,customer_name:name,phone:digits,email:email,
      address:address,city:city,products:itemsList,total:money(cartTotal()),
      shipping_fee:"To be confirmed by seller",proof_of_payment:proofImageUrl
    });
    try{
      // Try EmailJS first (the original, already-set-up sender). Only if it fails —
      // most commonly because its 200/month free limit has been used up for the month —
      // do we fall back to the Resend-powered function (3,000/month) as a second attempt.
      // Either way, the order itself is already safely saved above, so this never blocks
      // order completion even if both attempts fail.
      btn.textContent="Sending order…";msg.textContent="Sending your order…";
      try{
        emailjs.init(EMAILJS_PUBLIC_KEY);
        await emailjs.send(EMAILJS_SERVICE_ID,EMAILJS_TEMPLATE_ID,{
          to_email:"midelawal1701@gmail.com",
          order_id:orderId,order_date:orderDate,
          customer_name:name,customer_phone:phone,
          customer_email:email,customer_address:address,customer_city:city,
          order_items:itemsList,order_total:money(cartTotal()),
          product_images:imageUrls,
          payment_bank:PAYMENT.bankName,payment_account:PAYMENT.accountNumber,payment_name:PAYMENT.accountName,
          proof_of_payment:proofImageUrl
        });
      }catch(emailJsErr){
        console.error("EmailJS failed (likely monthly limit reached) — falling back to Resend:",emailJsErr);
        await fetch("https://crrtunosemhnmiaquevn.supabase.co/functions/v1/send-order-email",{
          method:"POST",
          headers:{
            "Content-Type":"application/json",
            "x-webhook-secret":"a706d511f4607223970be571316aa0f0c7d64ed755024ddf"
          },
          body:JSON.stringify({
            order_id:orderId,order_date:orderDate,
            customer_name:name,customer_phone:phone,
            customer_email:email,customer_address:address,customer_city:city,
            order_items:itemsList,order_total:money(cartTotal()),
            payment_bank:PAYMENT.bankName,payment_account:PAYMENT.accountNumber,payment_name:PAYMENT.accountName,
            proof_of_payment:proofImageUrl
          })
        });
      }
    }catch(emailErr){
      // The order is already safely saved to Supabase, so the customer's order is not lost —
      // just log this so it's visible in browser console for debugging.
      console.error("Order saved successfully but both email attempts failed to send:",emailErr);
    }
    rememberOrderLocally(orderId);
    cart=[];updateCartUI();closeCheckout();
    document.getElementById("successRef").textContent="Order Ref: "+orderId;
    document.getElementById("successModal").classList.add("open");
    ["customerName","customerPhone","customerEmail","customerCity","customerAddress"].forEach(id=>document.getElementById(id).value="");
    proofInput.value="";
  }catch(err){
    console.error(err);
    const errText=String(err&&err.message||err);
    if(/photo|image|upload|storage|screenshot/i.test(errText)&&!/Supabase save/i.test(errText)){
      msg.textContent="We couldn't upload your payment screenshot. "+errText.replace(/Please run storage_setup\.sql.*$/i,"Please try again or send it on WhatsApp.");
    }else if(navigator.onLine===false){
      msg.textContent="You appear to be offline. Please check your connection and try again.";
    }else{
      msg.textContent="Something went wrong sending your order. Please try again in a moment.";
    }
  }finally{
    btn.disabled=false;btn.textContent="Submit Order →";
  }
}
function closeSuccess(){document.getElementById("successModal").classList.remove("open")}

// TRACK ORDER
function rememberOrderLocally(orderId){
  try{
    const list=JSON.parse(localStorage.getItem("romiluxe-my-orders")||"[]");
    if(!list.includes(orderId)){
      list.unshift(orderId);
      localStorage.setItem("romiluxe-my-orders",JSON.stringify(list.slice(0,50)));
    }
  }catch(e){}
}
function getLocalOrderIds(){
  try{return JSON.parse(localStorage.getItem("romiluxe-my-orders")||"[]")}catch(e){return []}
}
function openTrackOrder(){
  document.getElementById("trackModal").classList.add("open");
  loadMyOrders();
}
function closeTrackOrder(){document.getElementById("trackModal").classList.remove("open")}
const STATUS_STYLE={
  "Pending":{icon:"🟡",label:"Pending Confirmation",desc:"We've received your order and are confirming your payment."},
  "Approved":{icon:"🟢",label:"Approved",desc:"Your payment has been confirmed. We're preparing your order."},
  "Shipped":{icon:"🚚",label:"Shipped",desc:"Your order is on its way to you."},
  "Delivered":{icon:"✅",label:"Delivered",desc:"Your order has been delivered. Thank you for shopping with us!"}
};
async function loadMyOrders(){
  const result=document.getElementById("trackResult");
  const ids=getLocalOrderIds();
  if(!ids.length){
    result.innerHTML=`
      <p class="checkout-msg" style="text-align:left">You haven't placed any orders from this device yet. Once you check out, your orders will appear here automatically.</p>
      ${phoneFallbackHtml()}`;
    wirePhoneFallback();
    return;
  }
  result.innerHTML=`<p style="font-size:13px;color:var(--muted)">Loading your orders…</p>`;
  try{
    const orFilter=ids.map(id=>`order_id.eq.${encodeURIComponent(id)}`).join(",");
    const res=await fetch(`${SUPABASE_URL}/rest/v1/orders?or=(${orFilter})&select=order_id,status,city,address,products,total,created_at&order=created_at.desc`,{
      headers:{"apikey":SUPABASE_ANON_KEY,"Authorization":"Bearer "+SUPABASE_ANON_KEY}
    });
    if(!res.ok)throw new Error("Supabase fetch failed: "+res.status);
    const rows=await res.json();
    if(!Array.isArray(rows)||!rows.length){
      // A genuinely empty result is not an error — say so plainly, and offer the phone lookup
      // in case the order exists under a different local record (e.g. placed on another visit).
      result.innerHTML=`
        <p class="checkout-msg" style="text-align:left">No orders found on this device right now.</p>
        ${phoneFallbackHtml()}`;
      wirePhoneFallback();
      return;
    }
    result.innerHTML=rows.map(o=>orderCardHtml(o)).join("")+phoneFallbackHtml();
    wirePhoneFallback();
  }catch(e){
    console.error(e);
    result.innerHTML=`
      <p class="checkout-msg" style="text-align:left">${navigator.onLine===false?"You appear to be offline. Please check your connection and try again.":"Something went wrong loading your orders. Please try again."}</p>
      ${phoneFallbackHtml()}`;
    wirePhoneFallback();
  }
}
function orderCardHtml(o){
  const s=STATUS_STYLE[o.status]||STATUS_STYLE["Pending"];
  return `
  <div class="payment-box" style="margin-bottom:14px">
    <div class="payment-box-title">${s.icon} ${s.label}</div>
    <p style="font-size:14px;color:var(--muted);margin-bottom:14px">${s.desc}</p>
    <div class="payment-line"><b>Order Ref:</b> <span>${esc(o.order_id)}</span></div>
    <div class="payment-line"><b>Delivering to:</b> <span>${esc(o.address)}, ${esc(o.city)}</span></div>
    <div class="payment-line"><b>Total:</b> <span>${esc(o.total)}</span></div>
  </div>`;
}
function phoneFallbackHtml(){
  return `
    <div id="phoneFallbackWrap" style="margin-top:10px">
      <a href="javascript:void(0)" id="phoneFallbackLink" style="font-size:13px;color:var(--gold);text-decoration:underline">Don't see your order? Look it up with your phone number</a>
    </div>`;
}
function wirePhoneFallback(){
  const link=document.getElementById("phoneFallbackLink");
  if(!link)return;
  link.onclick=()=>{
    const wrap=document.getElementById("phoneFallbackWrap");
    wrap.innerHTML=`
      <div class="form-grid" style="margin-top:6px">
        <div class="field full"><label>Phone Number used at checkout</label><input id="fallbackPhone" type="tel" placeholder="e.g. 08012345678"></div>
      </div>
      <button class="btn-primary" id="fallbackBtn" style="margin-top:8px" onclick="lookupByPhone()">Find My Orders →</button>
      <div id="fallbackResult" style="margin-top:14px"></div>`;
  };
}
async function lookupByPhone(){
  const raw=document.getElementById("fallbackPhone").value.trim();
  const digits=raw.replace(/\D/g,"");
  const out=document.getElementById("fallbackResult");
  const btn=document.getElementById("fallbackBtn");
  if(!digits||digits.length<10){out.innerHTML=`<p class="checkout-msg" style="text-align:left">Please enter the phone number you used at checkout.</p>`;return}
  btn.disabled=true;btn.textContent="Checking…";
  out.innerHTML="";
  try{
    const res=await fetch(`${SUPABASE_URL}/rest/v1/orders?phone=eq.${encodeURIComponent(digits)}&select=order_id,status,city,address,products,total,created_at&order=created_at.desc`,{
      headers:{"apikey":SUPABASE_ANON_KEY,"Authorization":"Bearer "+SUPABASE_ANON_KEY}
    });
    if(!res.ok)throw new Error("Supabase fetch failed: "+res.status);
    const rows=await res.json();
    if(!Array.isArray(rows)||!rows.length){
      out.innerHTML=`<p class="checkout-msg" style="text-align:left">No orders found with that phone number.</p>`;
    }else{
      rows.forEach(id=>rememberOrderLocally(id.order_id)); // remember for next time on this device
      out.innerHTML=rows.map(o=>orderCardHtml(o)).join("");
    }
  }catch(e){
    console.error(e);
    out.innerHTML=`<p class="checkout-msg" style="text-align:left">${navigator.onLine===false?"You appear to be offline. Please check your connection and try again.":"Something went wrong. Please try again."}</p>`;
  }finally{
    btn.disabled=false;btn.textContent="Find My Orders →";
  }
}

// INIT
const helpMsg=wa("Hello Romiluxe Ng, I need help finding a jewellery product. Please let me know what is currently available.");
["topwa","seller","servicewa"].forEach(id=>{const el=document.getElementById(id);if(el)el.href=helpMsg});
function renderAllGrids(){
  ["retail","wholesale","perfume","cosmetics"].forEach(t=>renderGrid(t,"all"));
  updateProductCounts();
}
function refreshProducts(){
  return loadDbProducts().then(()=>{productsLoadedOnce=true;renderAllGrids()});
}
function retryProducts(){productsLoadedOnce=false;renderAllGrids();refreshProducts()}
if(loadCachedProducts())productsLoadedOnce=true;
renderAllGrids();
loadSavedCart();
updateCartUI();
// All product data lives in Supabase (single source of truth, edited via the admin page).
refreshProducts();

// 3D TILT ON PRODUCT CARDS (pointer devices only)
if(window.matchMedia&&window.matchMedia("(hover:hover) and (pointer:fine)").matches){
  document.addEventListener("mousemove",e=>{
    const card=e.target.closest(".product-card");
    if(!card)return;
    const r=card.getBoundingClientRect();
    const px=(e.clientX-r.left)/r.width-0.5;
    const py=(e.clientY-r.top)/r.height-0.5;
    card.style.transform=`translateY(-8px) rotateX(${(-py*10).toFixed(2)}deg) rotateY(${(px*10).toFixed(2)}deg)`;
  });
  document.addEventListener("mouseout",e=>{
    const card=e.target.closest(".product-card");
    if(card&&!card.contains(e.relatedTarget))card.style.transform="";
  });
}

// THEME TOGGLE (light by default; visitors can switch to dark and it is remembered)
function applyTheme(theme,remember){
  document.documentElement.setAttribute("data-theme",theme);
  const ic=document.getElementById("themeIcon");if(ic)ic.textContent=theme==="dark"?"☀️":"🌙";
  if(remember){try{localStorage.setItem("romiluxe-theme-v2",theme)}catch(e){}}
}
function toggleTheme(){
  const current=document.documentElement.getAttribute("data-theme")==="dark"?"dark":"light";
  applyTheme(current==="dark"?"light":"dark",true);
}
(function initTheme(){
  let saved="light";
  try{const v=localStorage.getItem("romiluxe-theme-v2");if(v==="dark"||v==="light")saved=v}catch(e){}
  applyTheme(saved,false);
})();

function toggleMenu(force){
  const m=document.getElementById("mobileMenu"),sc=document.getElementById("menuScrim"),b=document.getElementById("menuBtn");if(!m)return;
  const open=typeof force==="boolean"?force:m.hidden;
  m.hidden=!open;sc.hidden=!open;b.classList.toggle("open",open);b.setAttribute("aria-expanded",open?"true":"false");
}
document.addEventListener("keydown",e=>{if(e.key==="Escape")toggleMenu(false)});
window.addEventListener("resize",()=>{if(innerWidth>768)toggleMenu(false)});
