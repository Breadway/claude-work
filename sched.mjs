// prints scene start times for the edu film: node sched.mjs [idFilter]   (mirrors engine/stage.js timeline)
const m = await import('./scenes_edu/index.js');
let cur = 0;
m.default.forEach((s, i) => { const tr = i === 0 ? 0 : s.trans ?? 0.8; const st = i === 0 ? 0 : cur - tr; cur = st + s.dur; if (!process.argv[2] || s.id.includes(process.argv[2])) console.log(s.id.padEnd(14), st.toFixed(1).padStart(8), String(s.dur).padStart(5)); });
console.log('total', cur.toFixed(1), `(${(cur / 60).toFixed(1)} min)`);
