import { useEffect, useMemo, useState } from 'react'
import { Activity, Archive, Calculator, CarFront, Check, ChevronDown, Download, FileImage, Gauge, History, LayoutDashboard, Mic, MicOff, RotateCcw, Save, Settings as SettingsIcon, ShieldCheck, Trash2, Upload, Wallet, X } from 'lucide-react'
import { calculateTrip } from './lib/calculator'
import { deleteTrip, getSettings, getTrips, replaceAllTrips, saveSettings, saveTrip } from './lib/db'
import { readTripImage, type OcrDraft } from './lib/ocr'
import { DEFAULT_SETTINGS, EMPTY_TRIP, type AppName, type FareMode, type SavedTrip, type Settings, type TripInput } from './types'

type Page = 'calculator' | 'assistant' | 'inbox' | 'history' | 'reports' | 'settings'
const money = (n: number) => `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`
const templates: {name:string; desc:string; trip:TripInput}[] = [
  { name:'المثال المرجعي', desc:'22 كم — 165 جنيه — 40 دقيقة', trip:{...EMPTY_TRIP} },
  { name:'مشوار قصير وسط البلد', desc:'5 كم — 70 جنيه', trip:{...EMPTY_TRIP, fare:70, passengerKm:5, totalMinutes:20} },
  { name:'مشوار أطراف القاهرة', desc:'عودة فارغة 35 كم', trip:{...EMPTY_TRIP, fare:350, pickupKm:8, passengerKm:25, returnKm:35, totalMinutes:100} },
  { name:'مشوار خاسر', desc:'أجرة ضعيفة لاختبار الرفض', trip:{...EMPTY_TRIP, fare:35, passengerKm:12, totalMinutes:45} }
]
const nav: {id:Page;label:string;icon:any}[] = [
  {id:'calculator',label:'حاسبة المشوار',icon:Calculator},{id:'assistant',label:'المساعد الذكي',icon:FileImage},
  {id:'inbox',label:'الرحلات الملتقطة',icon:Archive},{id:'history',label:'سجل الرحلات',icon:History},
  {id:'reports',label:'التقارير',icon:LayoutDashboard},{id:'settings',label:'الإعدادات',icon:SettingsIcon}
]
function Field({label,value,onChange,unit='',step='any',type='number'}:{label:string;value:number|string;onChange:(v:string)=>void;unit?:string;step?:string;type?:string}) {
  return <label className="field"><span>{label}</span><div className="input-wrap"><input type={type} step={step} value={value} onChange={e=>onChange(e.target.value)} /><small>{unit}</small></div></label>
}
export default function App() {
  const [page,setPage]=useState<Page>('calculator')
  const [settings,setSettings]=useState<Settings>(DEFAULT_SETTINGS)
  const [trip,setTrip]=useState<TripInput>(EMPTY_TRIP)
  const [trips,setTrips]=useState<SavedTrip[]>([])
  const [inbox,setInbox]=useState<SavedTrip[]>([])
  const [draft,setDraft]=useState<OcrDraft|null>(null)
  const [busy,setBusy]=useState(false)
  const [progress,setProgress]=useState(0)
  const [toast,setToast]=useState('')
  const [speaking,setSpeaking]=useState(false)
  const result=useMemo(()=>calculateTrip(trip,settings),[trip,settings])
  useEffect(()=>{(async()=>{setSettings(await getSettings());setTrips(await getTrips())})()},[])
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),3200);return()=>clearTimeout(t)},[toast])
  const patch=(key:keyof TripInput,value:any)=>setTrip(t=>({...t,[key]:value}))
  const updateSettings=(key:keyof Settings,value:number)=>setSettings(s=>({...s,[key]:value}))
  const persistSettings=async()=>{await saveSettings(settings);setToast('تم حفظ الإعدادات محليًا')}
  const loadTemplate=(t:TripInput)=>{setTrip({...t});setPage('calculator')}
  const saveCurrent=async()=> {
    if(trip.totalMinutes<=0 || trip.fare<0 || [trip.pickupKm,trip.passengerKm,trip.returnKm,trip.extraExpenses].some(v=>v<0)){setToast('راجع بيانات الرحلة قبل الحفظ');return}
    if(trip.fareMode==='unknown'){setToast('حدد هل الأجرة صافية أم إجمالية أولًا');return}
    const saved:SavedTrip={...trip,...result,id:crypto.randomUUID(),createdAt:new Date().toISOString()}
    await saveTrip(saved);setTrips(await getTrips());setToast('تم حفظ الرحلة على جهازك')
  }
  const removeTrip=async(id:string)=>{await deleteTrip(id);setTrips(await getTrips())}
  const uploadImage=async(file?:File)=>{
    if(!file)return
    setBusy(true);setProgress(0);setDraft(null)
    try{setDraft(await readTripImage(file,setProgress));setToast('انتهت قراءة الصورة؛ راجع البيانات قبل اعتمادها')}
    catch(e){setToast('تعذرت قراءة الصورة. جرّب Screenshot أوضح.')}
    finally{setBusy(false)}
  }
  const useDraft=()=>{
    if(!draft)return
    setTrip(t=>({...t,app:draft.app,fare:draft.fare??t.fare,fareMode:draft.fareMode,
      pickupKm:draft.pickupKm??t.pickupKm,passengerKm:draft.passengerKm??t.passengerKm,
      totalMinutes:draft.totalMinutes??t.totalMinutes}))
    setPage('calculator');setDraft(null)
  }
  const speak=()=>{
    if(!('speechSynthesis'in window)){setToast('ميزة الصوت غير مدعومة في هذا المتصفح');return}
    if(speaking){speechSynthesis.cancel();setSpeaking(false);return}
    const text=result.decision==='accept'?`اقبل الرحلة. صافي الربح ${result.netProfit.toFixed(2)} جنيه`:
      result.decision==='review'?`راجع الرحلة. ${result.decisionReason}`:`ارفض الرحلة. صافي الربح ${result.netProfit.toFixed(2)} جنيه`
    const utter=new SpeechSynthesisUtterance(text);utter.lang='ar-EG';utter.onend=()=>setSpeaking(false);speechSynthesis.speak(utter);setSpeaking(true)
  }
  const exportBackup=async()=>{
    const payload={schemaVersion:1,exportedAt:new Date().toISOString(),settings,trips}
    downloadFile(JSON.stringify(payload,null,2),'driver-profit-backup.json','application/json')
  }
  const importBackup=async(file?:File)=>{
    if(!file)return
    try{
      const data=JSON.parse(await file.text())
      if(data.schemaVersion!==1||!Array.isArray(data.trips)||!data.settings)throw new Error('invalid')
      if(!confirm(`سيتم استيراد ${data.trips.length} رحلة واستبدال السجل الحالي. هل تريد المتابعة؟`))return
      await replaceAllTrips(data.trips);await saveSettings(data.settings);setTrips(await getTrips());setSettings(await getSettings());setToast('تم استيراد النسخة الاحتياطية')
    }catch{setToast('ملف النسخة الاحتياطية غير صالح أو غير متوافق')}
  }
  const exportCsv=()=>{
    const headers=['التاريخ','التطبيق','الأجرة المدخلة','صافي الأجرة','المسافة كم','الوقت دقيقة','التكلفة','صافي الربح','ربح الساعة','القرار']
    const rows=trips.map(t=>[t.createdAt,t.app,t.fare,t.netFare,t.totalKm,t.totalMinutes,t.totalCost,t.netProfit,t.hourlyProfit,t.decision])
    const csv=[headers,...rows].map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n')
    downloadFile('\ufeff'+csv,'driver-trips.csv','text/csv;charset=utf-8')
  }
  const decisionLabel={accept:'اقبل الرحلة',review:'راجع الرحلة',reject:'ارفض الرحلة'}
  const decisionClass={accept:'good',review:'warn',reject:'bad'}
  const savedProfit=trips.reduce((s,t)=>s+t.netProfit,0)
  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-icon"><ScaleIcon/></div><div><strong>حاسبة عدالة المشاوير</strong><small>DRIVER PROFIT CALCULATOR</small></div></div>
      <div className="top-actions"><span className="free-tag"><ShieldCheck size={14}/> مجاني 100%</span><span className="local-tag"><span/> حفظ محلي</span></div>
    </header>
    <nav className="nav">{nav.map(n=><button key={n.id} className={page===n.id?'active':''} onClick={()=>setPage(n.id)}><n.icon size={17}/>{n.label}{n.id==='inbox'&&inbox.length>0?<b>{inbox.length}</b>:null}</button>)}</nav>
    <main className="main">
      {page==='calculator'&&<><section className="hero"><div><span className="eyebrow">قرار أذكى • ربح أوضح</span><h1>احسبها قبل ما تقبل المشوار</h1><p>اعرف تكلفة الرحلة وصافي ربحك الحقيقي في ثوانٍ.</p></div><div className="hero-stat"><Gauge size={26}/><span>القرار بيتحسب تلقائيًا</span></div></section>
        <section className="templates"><div className="section-head"><h2>نماذج جاهزة للاختبار السريع</h2><span>اضغط لملء الحقول</span></div><div className="template-grid">{templates.map(t=><button className="template" key={t.name} onClick={()=>loadTemplate(t.trip)}><strong>{t.name}</strong><small>{t.desc}</small></button>)}</div></section>
        <div className="work-grid"><section className="panel form-panel"><div className="panel-head"><div><span className="eyebrow">بيانات العرض</span><h2><CarFront/> بيانات المشوار المقترح</h2></div><button className="subtle-btn" onClick={()=>setTrip(EMPTY_TRIP)}><RotateCcw size={15}/> تفريغ الحقول</button></div>
          <div className="app-select">{(['Uber','DiDi','inDrive','أخرى'] as AppName[]).map(a=><button key={a} className={trip.app===a?'selected':''} onClick={()=>{patch('app',a);patch('commissionRate',settings.commission[a as 'inDrive'|'DiDi'|'أخرى']??0);patch('fareMode',a==='Uber'?'net':'unknown')}}>{a}</button>)}</div>
          <Field label="الأجرة المعروضة" value={trip.fare} onChange={v=>patch('fare',Number(v))} unit="ج.م"/>
          <div className="field"><span>نوع الأجرة</span><div className="choice-row">
            <button className={trip.fareMode==='net'?'chosen':''} onClick={()=>patch('fareMode','net')}>صافي للسائق</button>
            <button className={trip.fareMode==='gross'?'chosen':''} onClick={()=>patch('fareMode','gross')}>إجمالي قبل العمولة</button>
            <button className={trip.fareMode==='unknown'?'chosen':''} onClick={()=>patch('fareMode','unknown')}>غير متأكد</button>
          </div></div>
          {trip.fareMode==='gross'&&<Field label="نسبة عمولة التطبيق" value={trip.commissionRate} onChange={v=>patch('commissionRate',Number(v))} unit="%"/>}
          <div className="field-grid">
            <Field label="مسافة الوصول للراكب" value={trip.pickupKm} onChange={v=>patch('pickupKm',Number(v))} unit="كم"/>
            <Field label="مسافة الرحلة بالراكب" value={trip.passengerKm} onChange={v=>patch('passengerKm',Number(v))} unit="كم"/>
            <Field label="العودة الفارغة" value={trip.returnKm} onChange={v=>patch('returnKm',Number(v))} unit="كم"/>
            <Field label="الوقت الإجمالي" value={trip.totalMinutes} onChange={v=>patch('totalMinutes',Number(v))} unit="دقيقة"/>
            <Field label="مصروفات إضافية" value={trip.extraExpenses} onChange={v=>patch('extraExpenses',Number(v))} unit="ج.م"/>
          </div>
          <label className="field"><span>ملاحظات اختيارية</span><textarea rows={2} value={trip.notes} onChange={e=>patch('notes',e.target.value)} placeholder="أي تفاصيل تساعدك في مراجعة الرحلة..."/></label>
          {trip.fareMode==='unknown'&&<div className="inline-alert">حدد نوع الأجرة قبل حفظ الرحلة. لن نفترض أن المبلغ صافي أو نخصم عمولة تلقائيًا.</div>}
          <button className="primary-btn full" onClick={saveCurrent}><Save size={17}/> حفظ الرحلة في السجل</button>
        </section>
        <section className="panel result-panel"><div className="panel-head"><div><span className="eyebrow">التحليل المالي</span><h2><Activity/> قرار الرحلة النهائي</h2></div><button className="icon-btn" onClick={speak} title="نطق القرار">{speaking?<MicOff/>:<Mic/>}</button></div>
          <div className={`decision ${decisionClass[result.decision]}`}><div className="decision-mark">{result.decision==='accept'?'✓':result.decision==='review'?'!':'×'}</div><div><strong>{decisionLabel[result.decision]}</strong><p>{result.decisionReason}</p></div></div>
          <div className="profit-highlight"><small>{trip.fareMode==='unknown'?'ربح تقديري — أكد نوع الأجرة أولًا':'صافي ربحك المتوقع'}</small><strong className={result.netProfit>=0?'positive':'negative'}>{money(result.netProfit)}</strong><span>بعد الوقود والصيانة والمصروفات</span></div>
          <div className="metric-grid">
            <Metric label="إجمالي المسافة" value={`${result.totalKm.toFixed(2)} كم`}/>
            <Metric label="تكلفة الوقود" value={money(result.fuelCost)}/>
            <Metric label="الصيانة والإهلاك" value={money(result.maintenanceCost)}/>
            <Metric label="إجمالي تكلفة التشغيل" value={money(result.totalCost)}/>
            <Metric label="صافي الأجرة" value={money(result.netFare)}/>
            <Metric label="الربح في الساعة" value={money(result.hourlyProfit)}/>
          </div>
          <div className="required-fare"><div><span>الحد الأدنى للأجرة المطلوبة</span><strong>{money(result.requiredFare)}</strong></div><div><span>الفرق عن الأجرة الحالية</span><strong className={result.fareGap<=0?'positive':'negative'}>{result.fareGap<=0?'+'+money(Math.abs(result.fareGap)):'-'+money(result.fareGap)}</strong></div></div>
          <p className="formula-note">{trip.fareMode==='unknown'?'الأرقام المعروضة تقديرية مؤقتًا بافتراض أن الأجرة صافية؛ لا تعتمد القرار ولا تحفظ الرحلة قبل تحديد نوع الأجرة.':'الحساب يفترض أن كل المسافات المدخلة فعلية، وأن الأجرة الصافية لا تُخصم منها عمولة مرة ثانية.'}</p>
        </section></div>
      </>}
      {page==='assistant'&&<section className="panel assistant-panel"><div className="panel-head"><div><span className="eyebrow">قراءة بموافقتك</span><h2><FileImage/> المساعد الذكي لالتقاط الرحلات</h2><p>ارفع Screenshot واضحة من شاشة العرض. راجع القيم قبل إرسالها للحاسبة.</p></div></div>
        <div className="capture-info"><ShieldCheck/><div><strong>خصوصيتك أولًا</strong><p>المعالجة تتم داخل المتصفح. لا يتم حفظ صورة الرحلة أو نصها الخام في سجل الرحلات.</p></div></div>
        <label className="upload-zone"><Upload size={32}/><strong>اختر Screenshot من جهازك</strong><span>PNG أو JPG — يفضل لقطة شاشة أصلية وليست صورة بالكاميرا</span><input type="file" accept="image/*" onChange={e=>uploadImage(e.target.files?.[0])}/></label>
        {busy&&<div className="progress-wrap"><span>جاري قراءة الصورة {progress}%</span><div><i style={{width:`${progress}%`}}/></div></div>}
        <div className="capture-warning"><strong>تنبيه بخصوص Android</strong><p>التقاط شاشة التطبيقات الأخرى مباشرة غير متاح بشكل موثوق من صفحة ويب عادية. لذلك نوفر رفع الصورة كحل يعمل على المتصفح. الالتقاط المباشر يحتاج تطبيق Android أصلي وصلاحية MediaProjection بموافقة النظام.</p></div>
        {draft&&<div className="ocr-review"><div className="section-head"><h3>راجع البيانات المستخرجة</h3><span>ثقة OCR: {Math.round(draft.confidence)}%</span></div>
          <div className="field-grid">
            <div className="field"><span>التطبيق</span><select value={draft.app} onChange={e=>setDraft({...draft,app:e.target.value as AppName})}>{['Uber','DiDi','inDrive','أخرى'].map(x=><option>{x}</option>)}</select></div>
            <Field label="الأجرة" value={draft.fare??''} onChange={v=>setDraft({...draft,fare:v===''?null:Number(v)})} unit="ج.م"/>
            <div className="field"><span>نوع الأجرة</span><select value={draft.fareMode} onChange={e=>setDraft({...draft,fareMode:e.target.value as FareMode})}><option value="unknown">غير متأكد</option><option value="net">صافي</option><option value="gross">إجمالي</option></select></div>
            <Field label="مسافة الوصول" value={draft.pickupKm??''} onChange={v=>setDraft({...draft,pickupKm:v===''?null:Number(v)})} unit="كم"/>
            <Field label="مسافة الرحلة" value={draft.passengerKm??''} onChange={v=>setDraft({...draft,passengerKm:v===''?null:Number(v)})} unit="كم"/>
            <Field label="الوقت" value={draft.totalMinutes??''} onChange={v=>setDraft({...draft,totalMinutes:v===''?null:Number(v)})} unit="دقيقة"/>
          </div>
          {draft.warnings.map(w=><div className="inline-alert">{w}</div>)}
          <details><summary>عرض نص OCR للمراجعة فقط</summary><pre>{draft.rawText}</pre></details>
          <button className="primary-btn" onClick={useDraft}><Check size={17}/> نقل البيانات للحاسبة</button>
          <button className="subtle-btn" onClick={()=>setDraft(null)}><X size={16}/> إلغاء</button>
        </div>}
      </section>}
      {page==='inbox'&&<section className="panel"><div className="panel-head"><div><span className="eyebrow">مراجعة قبل الحفظ</span><h2><Archive/> صندوق الرحلات الملتقطة</h2></div></div><div className="empty-state"><Archive size={34}/><strong>لا توجد رحلات معلقة</strong><p>ارفع صورة من المساعد الذكي، وراجع بياناتها ثم انقلها للحاسبة.</p><button className="primary-btn" onClick={()=>setPage('assistant')}>فتح المساعد الذكي</button></div></section>}
      {page==='history'&&<section className="panel"><div className="panel-head"><div><span className="eyebrow">بيانات محفوظة على جهازك</span><h2><History/> سجل الرحلات</h2></div><button className="subtle-btn" onClick={exportCsv}><Download size={16}/> تصدير CSV</button></div>
        {trips.length===0?<Empty title="لسه مفيش رحلات محفوظة" text="احسب أول مشوار واحفظه علشان يظهر هنا."/>:<div className="table-wrap"><table><thead><tr><th>التاريخ</th><th>التطبيق</th><th>الأجرة</th><th>المسافة</th><th>صافي الربح</th><th>القرار</th><th></th></tr></thead><tbody>{trips.map(t=><tr key={t.id}><td>{new Date(t.createdAt).toLocaleString('ar-EG')}</td><td>{t.app}</td><td>{money(t.fare)}</td><td>{t.totalKm.toFixed(1)} كم</td><td className={t.netProfit>=0?'positive':'negative'}>{money(t.netProfit)}</td><td><span className={`pill ${decisionClass[t.decision]}`}>{decisionLabel[t.decision]}</span></td><td><button className="danger-icon" onClick={()=>removeTrip(t.id)} title="حذف"><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>}
      </section>}
      {page==='reports'&&<section className="panel"><div className="panel-head"><div><span className="eyebrow">ملخص السجل المحفوظ</span><h2><LayoutDashboard/> التقارير والإحصائيات</h2></div></div>
        <div className="report-grid"><Metric label="عدد الرحلات" value={String(trips.length)}/><Metric label="إجمالي الأجرة الصافية" value={money(trips.reduce((s,t)=>s+t.netFare,0))}/><Metric label="إجمالي التشغيل" value={money(trips.reduce((s,t)=>s+t.totalCost,0))}/><Metric label="صافي الربح" value={money(savedProfit)}/><Metric label="إجمالي المسافات" value={`${trips.reduce((s,t)=>s+t.totalKm,0).toFixed(1)} كم`}/><Metric label="إجمالي الوقت" value={`${trips.reduce((s,t)=>s+t.totalMinutes,0)} دقيقة`}/></div>
        <div className="section-head"><h3>مقارنة حسب التطبيق</h3></div><div className="table-wrap"><table><thead><tr><th>التطبيق</th><th>عدد الرحلات</th><th>صافي الربح</th><th>متوسط الربح</th></tr></thead><tbody>{(['Uber','DiDi','inDrive','أخرى'] as AppName[]).map(a=>{const list=trips.filter(t=>t.app===a);const sum=list.reduce((s,t)=>s+t.netProfit,0);return <tr key={a}><td>{a}</td><td>{list.length}</td><td>{money(sum)}</td><td>{money(list.length?sum/list.length:0)}</td></tr>})}</tbody></table></div>
      </section>}
      {page==='settings'&&<section className="panel"><div className="panel-head"><div><span className="eyebrow">تحكم في افتراضات الحساب</span><h2><SettingsIcon/> الإعدادات</h2></div><button className="primary-btn" onClick={persistSettings}><Save size={16}/> حفظ الإعدادات</button></div>
        <div className="field-grid settings-grid">
          <Field label="سعر لتر البنزين" value={settings.fuelPrice} onChange={v=>updateSettings('fuelPrice',Number(v))} unit="ج.م"/>
          <Field label="استهلاك السيارة لكل 100 كم" value={settings.consumptionPer100} onChange={v=>updateSettings('consumptionPer100',Number(v))} unit="لتر"/>
          <Field label="الصيانة والإهلاك لكل كم" value={settings.maintenancePerKm} onChange={v=>updateSettings('maintenancePerKm',Number(v))} unit="ج.م"/>
          <Field label="الحد الأدنى لصافي الرحلة" value={settings.minNetProfit} onChange={v=>updateSettings('minNetProfit',Number(v))} unit="ج.م"/>
          <Field label="هدف الربح في الساعة" value={settings.hourlyTarget} onChange={v=>updateSettings('hourlyTarget',Number(v))} unit="ج.م"/>
        </div>
        <div className="section-head"><h3>عمولة التطبيقات (اختيارية)</h3><span>تستخدم عند اختيار أجرة إجمالية</span></div>
        <div className="field-grid">{(['inDrive','DiDi','أخرى'] as const).map(a=><Field label={`عمولة ${a}`} value={settings.commission[a]} onChange={v=>setSettings(s=>({...s,commission:{...s.commission,[a]:Number(v)}}))} unit="%"/>)}</div>
        <div className="backup-actions"><button className="subtle-btn" onClick={exportBackup}><Download size={16}/> تصدير نسخة احتياطية</button><label className="subtle-btn file-button"><Upload size={16}/> استيراد نسخة احتياطية<input type="file" accept="application/json" onChange={e=>importBackup(e.target.files?.[0])}/></label><button className="subtle-btn" onClick={()=>{if(confirm('إعادة الإعدادات الافتراضية؟'))setSettings(DEFAULT_SETTINGS)}}><RotateCcw size={16}/> استعادة الافتراضي</button></div>
        <p className="formula-note">البيانات محفوظة محليًا في هذا المتصفح باستخدام IndexedDB. مسح بيانات المتصفح قد يؤدي إلى حذفها؛ صدّر نسخة احتياطية بانتظام.</p>
      </section>}
    </main>
    <footer><span>حاسبة عدالة المشاوير</span><span>مجانية 100% • بياناتك على جهازك</span></footer>
    {toast&&<div className="toast">{toast}</div>}
  </div>
}
function Metric({label,value}:{label:string;value:string}){return <div className="metric"><span>{label}</span><strong>{value}</strong></div>}
function Empty({title,text}:{title:string;text:string}){return <div className="empty-state"><Archive size={32}/><strong>{title}</strong><p>{text}</p></div>}
function ScaleIcon(){return <Wallet size={24}/>}
function downloadFile(content:string,name:string,type:string){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)}
