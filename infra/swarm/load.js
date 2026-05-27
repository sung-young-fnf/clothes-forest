// 간단 부하 생성기 (hey/ab 대용, Node만 있으면 동작)
// 사용: node infra/swarm/load.js [url] [concurrency] [durationSec]
// 예:   node infra/swarm/load.js http://localhost:8000/api/health 200 60

const http = require('http');

const URL = process.argv[2] || 'http://localhost:8000/api/health';
const CONCURRENCY = parseInt(process.argv[3] || '200', 10);
const DURATION_MS = parseInt(process.argv[4] || '60', 10) * 1000;

let inflight = 0;
let total = 0;
let errors = 0;
const endAt = Date.now() + DURATION_MS;

function fire() {
  if (Date.now() > endAt) return;
  inflight++;
  const req = http.get(URL, (res) => {
    res.resume(); // body 흘려보내기
    res.on('end', () => {
      inflight--;
      total++;
      fire(); // 끝나면 즉시 다음 요청 (연결 수 유지)
    });
  });
  req.on('error', () => {
    inflight--;
    errors++;
    setTimeout(fire, 50);
  });
}

console.log(`[load] ${URL} concurrency=${CONCURRENCY} for ${DURATION_MS / 1000}s`);
for (let i = 0; i < CONCURRENCY; i++) fire();

const timer = setInterval(() => {
  const rps = total; // 누적
  console.log(`[load] inflight=${inflight} total=${total} errors=${errors}`);
}, 2000);

setTimeout(() => {
  clearInterval(timer);
  console.log(`[load] DONE total=${total} errors=${errors}`);
  process.exit(0);
}, DURATION_MS + 500);
