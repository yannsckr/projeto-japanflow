'use strict';
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const EARTH_RADIUS_M = 6371000;
const radians = d => d * Math.PI / 180;
function daySaoPaulo(d) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function distanceMeters(a, b) {
  const lat = radians(b.lat - a.lat), lng = radians(b.lng - a.lng);
  const h = Math.sin(lat/2)**2 + Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(lng/2)**2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0,1-h)));
}
function validSegment(a,b) {
  const secs=(b.client_at-a.client_at)/1000;
  if (!Number.isFinite(secs)||secs<=0||secs>300 || a.accuracy>50||b.accuracy>50) return 0;
  if (![a.lat,a.lng,b.lat,b.lng].every(Number.isFinite)) return 0;
  const meters=distanceMeters(a,b);
  return meters>=Math.max(15,a.accuracy+b.accuracy) && meters/secs<=40 ? meters : 0;
}
// Data are recomputed from GPS points; client-provided "meters" is never trusted.
exports.motoboyDailySummary = onSchedule({schedule:'0 18 * * *', timeZone:'America/Sao_Paulo', region:'southamerica-east1'},async()=>{
  if (!admin.apps.length) admin.initializeApp();
  const db=admin.firestore(), day=daySaoPaulo(new Date());
  const points=await db.collection('motoboy_telemetry').where('day','==',day).get();
  const assignments=await db.collection('motoboy_assignments').get();
  const byUser=new Map();
  for (const doc of assignments.docs) {
    const a=doc.data();
    if (a.status!=='completed'||!a.assigned_to) continue;
    const date=a.completed_at?.toDate?.();
    if (!date||daySaoPaulo(date)!==day) continue;
    const userId=a.assigned_to;
    const item=byUser.get(userId)||{user_id:userId,rides:0,km:0,recorded_segments:0,ride_ids:[]};
    item.rides++;item.ride_ids.push(doc.id);
    const start=a.accepted_at?.toDate?.();
    if (start && date>start) item.duration_minutes=(item.duration_minutes||0)+Math.round((date-start)/60000);
    byUser.set(userId,item);
  }
  const byRide=new Map();
  for (const doc of points.docs) {
    const p=doc.data();
    if (!p.ride_id||!p.user_id) continue;
    const key=`${p.user_id}|${p.ride_id}`;
    const arr=byRide.get(key)||[];arr.push(p);byRide.set(key,arr);
  }
  for (const [key,arr] of byRide) {
    const [userId]=key.split('|');
    const item=byUser.get(userId)||{user_id:userId,rides:0,km:0,recorded_segments:0,ride_ids:[]};
    arr.sort((a,b)=>a.client_at-b.client_at);
    let meters=0;
    for(let i=1;i<arr.length;i++){ const m=validSegment(arr[i-1],arr[i]);if(m>0){meters+=m;item.recorded_segments++;} }
    item.km+=meters/1000;byUser.set(userId,item);
  }
  const users=[...byUser.values()].map(x=>({...x,km:Math.round(x.km*100)/100,limited_gps_coverage:x.recorded_segments===0}));
  await db.collection('motoboy_daily_reports').doc(day).set({day,users,generated_at:admin.firestore.FieldValue.serverTimestamp(),note:'Amostras podem faltar quando o navegador estiver suspenso. Quilometragem estimada apenas de pontos aceitos.'});
});
