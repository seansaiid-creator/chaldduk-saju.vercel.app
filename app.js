/* =============================================
   찰떡사주 - app.js
   Gemini API + 사주 계산 + 이미지 저장 + 카카오
   ============================================= */

// ⚠️ 본인의 Gemini API 키 입력
const GEMINI_API_KEY = 'AIzaSyBaCcazx7JMEw1p4dVyA_WmRs6uwdqxeC8';

// ⚠️ 카카오 앱 키
const KAKAO_APP_KEY = '7b87b3bb674e9bec0fd123f31a4e6e24';

/* =============================================
   초기화
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  // 카카오 초기화
  if (typeof Kakao !== 'undefined' && !Kakao.isInitialized()) {
    try { Kakao.init(KAKAO_APP_KEY); } catch(e) {}
  }

  // 년도 select 생성
  const yearSel = document.getElementById('birthYear');
  const firstOpt = document.createElement('option');
  firstOpt.value = ''; firstOpt.textContent = '선택';
  yearSel.appendChild(firstOpt);
  for (let y = 2007; y >= 1930; y--) {
    const opt = document.createElement('option');
    opt.value = y; opt.textContent = y;
    yearSel.appendChild(opt);
  }

  // 월/년 변경 시 일수 업데이트
  function updateDays() {
    const year  = parseInt(yearSel.value) || 2000;
    const month = parseInt(document.getElementById('birthMonth').value) || 1;
    const daySel = document.getElementById('birthDay');
    const prev  = daySel.value;
    const max   = new Date(year, month, 0).getDate();
    daySel.innerHTML = '<option value="">선택</option>';
    for (let d = 1; d <= max; d++) {
      const opt = document.createElement('option');
      opt.value = d; opt.textContent = d;
      daySel.appendChild(opt);
    }
    if (prev && parseInt(prev) <= max) daySel.value = prev;
  }

  updateDays();
  document.getElementById('birthMonth').addEventListener('change', updateDays);
  yearSel.addEventListener('change', updateDays);
});

/* =============================================
   사주 계산
   ============================================= */
const CHEONGAN = ['갑','을','병','정','무','기','경','신','임','계'];
const JIJI     = ['자','축','인','묘','진','사','오','미','신','유','술','해'];
const JIJI_ANIMAL = {
  '자':'쥐','축':'소','인':'호랑이','묘':'토끼','진':'용','사':'뱀',
  '오':'말','미':'양','신':'원숭이','유':'닭','술':'개','해':'돼지'
};
const JIJI_KO = {
  '자':'子','축':'丑','인':'寅','묘':'卯','진':'辰','사':'巳',
  '오':'午','미':'未','신':'申','유':'酉','술':'戌','해':'亥'
};
const CHEONGAN_KO = {
  '갑':'甲','을':'乙','병':'丙','정':'丁','무':'戊',
  '기':'己','경':'庚','신':'辛','임':'壬','계':'癸'
};
const CHEONGAN_OHANG = {
  '갑':'목','을':'목','병':'화','정':'화','무':'토',
  '기':'토','경':'금','신':'금','임':'수','계':'수'
};
const JIJI_OHANG = {
  '자':'수','축':'토','인':'목','묘':'목','진':'토','사':'화',
  '오':'화','미':'토','신':'금','유':'금','술':'토','해':'수'
};
const OHANG_KO = { '목':'목(木)','화':'화(火)','토':'토(土)','금':'금(金)','수':'수(水)' };
const OHANG_CLASS = { '목':'wood','화':'fire','토':'earth','금':'metal','수':'water' };

function calcYearPillar(year) {
  const diff = year - 1984;
  return { gan: CHEONGAN[((diff%10)+10)%10], ji: JIJI[((diff%12)+12)%12] };
}

function calcMonthPillar(year, month) {
  const ygi = ((year-1984)%10+10)%10;
  const base = [2,4,6,8,0,2,4,6,8,0][ygi%10] || 0;
  return { gan: CHEONGAN[(base+(month-1))%10], ji: JIJI[(month+1)%12] };
}

function calcDayPillar(year, month, day) {
  const a = Math.floor((14-month)/12);
  const y = year-a, m = month+12*a-3;
  const jd = day+Math.floor((153*m+2)/5)+365*y+Math.floor(y/4)-Math.floor(y/100)+Math.floor(y/400)+1721119;
  return { gan: CHEONGAN[((jd-11)%10+10)%10], ji: JIJI[((jd-11)%12+12)%12] };
}

function calcHourPillar(dayGan, hourName) {
  if (!hourName) return null;
  const ji = hourName.replace('시','');
  const jiIdx = JIJI.indexOf(ji);
  const dgIdx = CHEONGAN.indexOf(dayGan);
  const base  = [0,2,4,6,8,0,2,4,6,8][dgIdx];
  return { gan: CHEONGAN[(base+jiIdx)%10], ji: JIJI[jiIdx] };
}

function getSaju(year, month, day, hourName) {
  const yp = calcYearPillar(year);
  const mp = calcMonthPillar(year, month);
  const dp = calcDayPillar(year, month, day);
  const hp = hourName ? calcHourPillar(dp.gan, hourName) : null;

  const pillars = [
    { label:'연주(年柱)', ...yp },
    { label:'월주(月柱)', ...mp },
    { label:'일주(日柱)', ...dp },
    { label:'시주(時柱)', ...(hp || { gan:'?', ji:'?' }) },
  ];

  const ohang = { 목:0, 화:0, 토:0, 금:0, 수:0 };
  [yp,mp,dp,...(hp?[hp]:[])].forEach(p => {
    if (CHEONGAN_OHANG[p.gan]) ohang[CHEONGAN_OHANG[p.gan]]++;
    if (JIJI_OHANG[p.ji])     ohang[JIJI_OHANG[p.ji]]++;
  });

  const ddi = JIJI_ANIMAL[yp.ji] || '';
  const ilgan = dp.gan;
  const ilganOhang = CHEONGAN_OHANG[ilgan];

  return { pillars, ohang, ddi, ilgan, ilganOhang, yp, mp, dp, hp };
}

/* =============================================
   행운번호 생성
   ============================================= */
function generateLucky(saju, gender) {
  const today = new Date();
  const seed  = (saju.ohang.목*7+saju.ohang.화*11+saju.ohang.토*13
               +saju.ohang.금*17+saju.ohang.수*19
               +today.getFullYear()*10000+(today.getMonth()+1)*100+today.getDate()
               +(gender==='male'?3:7)) % 99999;
  function sr(s,n) { let x=Math.sin(s+n)*99999; return x-Math.floor(x); }
  const nums = new Set();
  let i=0;
  while(nums.size<6) { nums.add(Math.floor(sr(seed,i++)*45)+1); }
  return [...nums].sort((a,b)=>a-b);
}

/* =============================================
   운세 점수
   ============================================= */
function getScores(saju) {
  const today = new Date();
  const seed  = (today.getMonth()+1)*31+today.getDate()+CHEONGAN.indexOf(saju.ilgan);
  const r = (n) => ((seed*(n+7)*1234567)%5)+1;
  const star = (s) => ['😢','😐','🙂','😊','🤩'][s-1];
  const txt  = (s) => ['별로예요','그냥저냥','괜찮아요','좋아요!','대박이에요!'][s-1];
  return [
    { label:'전체운', score:r(1) },
    { label:'금전운', score:r(2) },
    { label:'애정운', score:r(3) },
    { label:'건강운', score:r(4) },
    { label:'직업운', score:r(5) },
    { label:'행운지수', score:r(6) },
  ].map(s => ({ ...s, emoji: star(s.score), text: txt(s.score) }));
}

/* =============================================
   Gemini API 호출 — 찰떡 사주풀이
   ============================================= */
async function getFortuneFromGemini(saju, gender) {
  const today = new Date();
  const dateStr = `${today.getFullYear()}년 ${today.getMonth()+1}월 ${today.getDate()}일`;
  const genderStr = gender === 'male' ? '남성' : '여성';
  const ohangStr = Object.entries(saju.ohang).filter(([,v])=>v>0).map(([k,v])=>`${OHANG_KO[k]} ${v}개`).join(', ');

  const prompt = `당신은 MZ세대가 열광하는 찰떡 사주 풀이사입니다. 진지하면서도 유머있게, 읽다보면 "이거 완전 나잖아!" 소리가 절로 나오도록 풀이해주세요.

사주 정보:
- 일간(나의 기운): ${saju.ilgan}(${CHEONGAN_KO[saju.ilgan]}) — ${OHANG_KO[saju.ilganOhang]} 기운
- 띠: ${saju.ddi}띠
- 성별: ${genderStr}
- 오행 구성: ${ohangStr}
- 오늘: ${dateStr}

다음 JSON 형식으로만 답하세요 (마크다운 코드블록 없이 순수 JSON):
{
  "summary": "오늘 하루를 한 문장으로 찰떡같이 표현 (이모지 포함, 20자 내외, 웃기면서 찰떡인 표현)",
  "detail": "오늘의 전체 운세를 MZ 감성으로 자세하게 풀이 (5~7문장, 구체적인 상황 묘사 포함, 예: '오늘 점심 뭐 먹을지 30분 고민할 것 같은 기운이에요', '카톡 읽씹 당할 확률 높은 날', 이런 식으로 일상 상황에 빗대서 재밌게)",
  "friend": "친구 관계 운세 (3~4문장, 구체적인 상황 묘사. 예: 오늘 단톡방에서 어떤 역할을 하게 될지, 친구와 어떤 일이 생길지 등)",
  "family": "가족 관계 운세 (3~4문장, 부모님/형제와의 관계, 집에서의 에너지 등 구체적으로)",
  "work": "직장/학교 운세 (3~4문장, 업무나 공부할 때 어떤 상황이 펼쳐질지 구체적으로)",
  "quote": "오늘 하루를 버티게 해줄 찰떡 한마디 (이모지 포함, 짧고 강렬하게, 웃기거나 공감되는 말)"
}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.95, maxOutputTokens: 1000 }
    })
  });

  if (!res.ok) throw new Error('API 오류');
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

/* =============================================
   템플릿 폴백
   ============================================= */
function getFortuneTemplate(saju) {
  const dominant = Object.entries(saju.ohang).sort((a,b)=>b[1]-a[1])[0][0];
  const today = new Date();
  const idx   = today.getDate() % 3;

  const templates = {
    목: [
      { summary: "오늘 아이디어 공장 가동 중 🏭💡", detail: "오늘 당신 머릿속은 그야말로 아이디어 공장이에요. 샤워하다가도, 밥 먹다가도 갑자기 '아 이거다!' 싶은 순간이 찾아올 거예요. 근데 문제는 실행력... 오늘만큼은 메모장 앱 필수예요. 까먹으면 진짜 아깝거든요. 주변 사람들이 오늘 당신한테 조언 구하러 올 수도 있어요. 흔쾌히 도와주면 나중에 좋은 기운으로 돌아와요.", friend: "오늘 단톡방에서 당신이 분위기 메이커 역할을 하게 될 것 같아요. 친구가 고민 얘기를 꺼낼 수 있는데, 그냥 들어주는 것만으로도 충분해요. 조언보다 공감이 더 필요한 상황이거든요.", family: "집에서 평화로운 하루가 예상돼요. 부모님이 뭔가 부탁할 수 있는데 오늘은 흔쾌히 들어주세요. 작은 친절이 가족 관계를 부드럽게 만들어줘요.", work: "업무나 공부에서 창의적인 해결책이 떠오르는 날이에요. 혼자 끙끙 앓지 말고 아이디어를 적극적으로 표현해보세요. 오늘은 발언할수록 득이에요.", quote: "생각만 하면 아무것도 안 돼요. 오늘은 일단 시작! 🌱" },
      { summary: "뭔가 새로 시작하고 싶은 기운 🌱", detail: "오늘 왠지 모르게 새로운 걸 시작하고 싶은 충동이 올 거예요. 헬스장 끊을까, 새 취미 시작할까 같은 생각이요. 나쁘지 않아요. 오늘의 기운이 시작을 도와주고 있거든요. 단, 너무 큰 거 벌이지 말고 작은 것부터 시작하는 게 포인트예요. 오늘 SNS 피드 보다가 영감 얻을 수도 있어요.", friend: "오늘 오랫동안 연락 못 했던 친구한테 먼저 연락해보세요. 상대방도 당신 생각 하고 있을 확률 높아요. 작은 안부 메시지 하나가 큰 위로가 될 수 있어요.", family: "가족 중 누군가와 오랜만에 깊은 대화를 나눌 기회가 생길 수 있어요. 형식적인 대화 말고 진짜 속마음 얘기요. 오늘은 그런 분위기가 자연스럽게 만들어져요.", work: "새로운 프로젝트나 과제에 뛰어들기 좋은 날이에요. 미루던 걸 오늘 시작해보세요. 처음이 어렵지 시작하면 생각보다 잘 풀려요.", quote: "완벽한 때는 없어요. 지금이 바로 그때예요 ✨" },
      { summary: "오늘 카리스마 폭발 예고 🔥", detail: "오늘 당신에게서 뭔가 모를 아우라가 풍겨요. 평소보다 말 한마디가 더 설득력 있게 들리고, 존재 자체로 주목받을 수 있어요. 거울 앞에서 한번 웃어보세요. 생각보다 매력적일 거예요. 다만 이 에너지가 때로는 무뚝뚝하게 보일 수 있으니 의식적으로 스마일 장착해요.", friend: "오늘 친구들 사이에서 리더 포지션이 될 수 있어요. 약속 장소 정하거나 메뉴 고를 때 당신이 결정하면 다들 따라올 거예요. 오늘만큼은 과감하게 리드해보세요.", family: "가족 분위기를 당신이 좌우하는 하루예요. 당신이 밝으면 집 안이 밝아지고, 당신이 침울하면 같이 가라앉아요. 오늘은 의식적으로 긍정 에너지 장착해요.", work: "발표나 회의가 있다면 오늘이 기회예요. 평소보다 말이 술술 나오고 설득력이 높은 날이거든요. 자신감 있게 나가보세요.", quote: "오늘 당신이 제일 빛나요 💫" }
    ],
    화: [
      { summary: "에너지 넘쳐서 가만 못 있겠는 날 ⚡", detail: "오늘 몸에 전기 흐르는 느낌이에요. 가만히 앉아있기 힘들고, 뭔가 움직이고 싶고, 말하고 싶고, 행동하고 싶은 날이에요. 이 에너지 잘 쓰면 오늘 엄청 많은 걸 해낼 수 있어요. 반대로 잘못 쓰면 쓸데없는 논쟁에 에너지 낭비할 수도 있으니 조심해요. 오늘 운동하면 진짜 개운할 거예요.", friend: "오늘 친구와 약속 잡으면 엄청 신나게 놀 수 있어요. 에너지가 넘치니까 둘 다 지치지 않고 오래 놀 수 있거든요. 근데 의견 충돌 조심해요. 오늘 둘 다 에너지 넘치면 소소한 것도 크게 느껴질 수 있어요.", family: "집에서 활기차게 지낼 수 있는 날이에요. 가족이랑 뭔가 같이 하면 좋아요. 요리 같이 하거나 드라이브 가거나. 오늘 가족과의 시간이 나중에 좋은 추억이 돼요.", work: "오늘은 어려운 문제도 돌파할 수 있는 에너지가 있어요. 미루던 어려운 과제 오늘 마무리하기 딱 좋아요. 집중력이 올라오는 시간은 오후예요.", quote: "에너지 있을 때 다 써버려요. 충전은 내일 🔋" },
      { summary: "말 한마디가 금이 되는 날 💬✨", detail: "오늘 당신 말빨이 평소의 2배예요. 하고 싶은 말 있으면 오늘 하세요. 설득해야 할 사람 있어도 오늘이 타이밍이에요. 목소리에 힘이 있고, 표현이 명확하고, 상대방도 귀 기울여 듣는 날이거든요. 단, 기세에 취해서 과한 말 하지 않도록 주의해요.", friend: "오랫동안 하고 싶었던 말 있었죠? 오늘이 적기예요. 솔직하게 털어놓으면 상대방도 진지하게 받아들일 거예요. 오늘 친구와의 대화에서 새로운 면을 발견할 수도 있어요.", family: "부모님이나 형제에게 평소 못 했던 감사나 미안한 말 오늘 해보세요. 오글거려도 괜찮아요. 오늘만큼은 그 말이 진심으로 전달돼요.", work: "발표, 협상, 면접 등 말을 해야 하는 상황이 있다면 오늘 최고의 날이에요. 준비를 철저히 하고 자신감 있게 임해보세요. 결과가 좋을 거예요.", quote: "말한 대로 이루어져요. 좋은 말만 하기 🗣️" },
      { summary: "열정 과부하 주의보 🌋", detail: "오늘 하고 싶은 것, 되고 싶은 것이 너무 많이 떠오르는 날이에요. 의욕이 넘쳐서 오히려 뭐부터 해야 할지 모르겠는 상태요. 우선순위 정하는 게 오늘의 숙제예요. 가장 중요한 것 하나만 골라서 거기에 올인하면 성과가 나올 거예요.", friend: "오늘 친구한테 당신의 열정이 전염될 수 있어요. 당신이 신나게 뭔가 얘기하면 친구도 덩달아 신나게 돼요. 오늘은 당신이 에너지 공급자 역할이에요.", family: "가족 중 누군가를 적극적으로 도와줄 수 있는 날이에요. 도움이 필요한 가족이 있는지 먼저 살펴보세요. 작은 도움이 가족 유대감을 높여줘요.", work: "의욕이 넘치는 날이지만 완벽주의 함정에 빠지지 않도록 해요. 80점짜리를 제때 내는 게 100점짜리를 늦게 내는 것보다 나을 수 있어요.", quote: "완벽하지 않아도 돼요. 일단 해요 💪" }
    ],
    토: [
      { summary: "오늘 나 완전 현실적인 사람 됨 📊", detail: "오늘 유독 현실적이고 실용적인 생각이 많이 드는 날이에요. 뜬구름 잡는 계획보다 실제로 실행 가능한 것들에 집중하게 돼요. 이건 좋은 거예요. 오늘 결정한 것들은 꽤 안정적이고 탄탄한 결과물이 나올 거거든요. 충동구매 특히 조심해요. 나중에 후회해요.", friend: "오늘 친구와의 관계에서 실질적인 도움을 주고받을 수 있어요. 감정적인 위로보다 실질적인 조언이나 도움이 더 빛을 발하는 날이에요. 친구가 도움 요청하면 구체적인 해결책을 제시해보세요.", family: "가족과의 관계에서 안정감이 느껴지는 날이에요. 특별한 이벤트보다 함께 밥 먹고 소소한 대화 나누는 것만으로도 충분히 행복한 하루예요.", work: "오늘은 창의적인 것보다 꼼꼼하고 체계적인 업무에서 빛을 발해요. 정리, 계획, 검토 같은 작업을 하면 실수 없이 깔끔하게 마무리할 수 있어요.", quote: "작은 것부터 차근차근. 그게 쌓이면 대박 🏗️" },
      { summary: "갑자기 돈 관리하고 싶어지는 날 💰", detail: "오늘 유독 재테크나 저축에 관심이 가는 날이에요. 가계부 앱 깔고 싶거나, 투자 공부해야겠다는 생각이 드는 거 맞죠? 그 본능 믿어도 돼요. 오늘 재물운이 괜찮은 날이라 재정 관련 결정을 하기에 좋아요. 단, 큰 금액의 즉흥적인 투자는 오늘 말고 더 알아본 다음에요.", friend: "오늘 친구와 돈 얘기가 나올 수 있어요. 빌려달라는 얘기가 나오면 신중하게 생각해요. 돈 거래는 관계를 복잡하게 만들 수 있거든요.", family: "가족 중 경제적인 도움이 필요한 사람이 있을 수 있어요. 형편이 된다면 도와주되, 부담스럽다면 솔직하게 얘기하는 게 나중을 위해 좋아요.", work: "오늘 업무에서 예산이나 비용 관련 일을 처리하면 정확하게 잘 할 수 있어요. 숫자 관련 작업에서 집중력이 특히 좋은 날이에요.", quote: "쓸 돈 쓰고, 모을 돈 모으면 돼요 💳" },
      { summary: "집순이/집돌이 본능 깨어나는 날 🏠", detail: "오늘 왠지 집에 있고 싶고, 아무도 안 만나고 싶고, 그냥 방에서 뒹굴고 싶은 기운이에요. 이건 게으른 게 아니에요. 오늘은 진짜로 에너지를 충전해야 하는 날이거든요. 억지로 약속 잡지 말고, 오늘은 나를 위한 하루로 써도 괜찮아요. 좋아하는 거 먹고, 좋아하는 거 보고.", friend: "오늘 친구 만나는 약속 있으면 살짝 에너지가 빨릴 수 있어요. 그래도 만나면 편안한 친구와 조용한 곳에서 만나는 게 좋아요. 시끌벅적한 자리보다 둘이 조용히 카페에서 수다 떠는 게 오늘 모드예요.", family: "오늘 가족이랑 집에서 같이 있는 게 제일 편안한 날이에요. 외식보다 집밥이, 나들이보다 집에서 영화 보는 게 더 행복할 거예요.", work: "오늘은 혼자 집중해서 하는 업무에 최적화된 날이에요. 회의나 협업보다 혼자 조용히 처리하는 일이 더 잘 풀려요.", quote: "충전도 일이에요. 오늘은 쉬어도 돼요 🛋️" }
    ],
    금: [
      { summary: "결단력 MAX, 오늘 쓸어버릴 기세 ⚔️", detail: "오늘 당신 뭔가 결정력이 장난 아니에요. 평소에 이것저것 따지느라 결정 못 하던 일들이 오늘은 척척 정해져요. 이 에너지를 미루던 결정들을 해치우는 데 쓰면 좋아요. 단, 너무 칼같이 굴면 주변 사람들이 차갑다고 느낄 수 있으니 온기 조금 더해요.", friend: "오늘 친구 관계에서 솔직한 피드백을 줄 수 있는 날이에요. 친구가 당신 의견을 구한다면 핵심만 정확하게 얘기해줘요. 오늘 당신 말이 촌철살인이 될 거거든요.", family: "가족 내에서 결단이 필요한 상황이 생길 수 있어요. 오늘은 당신이 중심 잡고 방향을 제시해주면 가족들이 안심해요. 리더십 발휘할 타이밍이에요.", work: "오늘 처리 못 하고 미뤄뒀던 일들 다 처리할 수 있어요. 집중력과 실행력이 동시에 올라오는 날이거든요. To-do 리스트 다 지울 수 있는 날이에요.", quote: "고민 그만, 행동 시작 🗡️" },
      { summary: "오늘 나 좀 차가워 보일 수 있음 주의 🧊", detail: "오늘 당신이 좀 무뚝뚝해 보일 수 있어요. 실제로 차가운 게 아니라, 오늘 논리적이고 이성적인 모드로 돌아가고 있어서 감정 표현이 줄어드는 거예요. 주변 사람들이 오늘 당신을 오해할 수 있으니 의식적으로 스마일 장착하고, 고맙다는 말도 한 번 더 해요.", friend: "친구가 오늘 당신이 왜 저러지 싶을 수도 있어요. 평소랑 다르게 조용하거나 반응이 적을 수 있거든요. 먼저 '나 오늘 좀 힘들어' 한마디면 친구가 이해해줄 거예요.", family: "가족이 오늘 당신 눈치를 볼 수 있어요. 표정 관리 해요. 말 안 해도 표정으로 다 보여요. 오늘 특히 부모님께 따뜻하게 대해드리면 가족 분위기가 훨씬 좋아져요.", work: "오늘 업무 퀄리티는 매우 높아요. 꼼꼼하고 정확하게 일 처리하는 날이거든요. 다만 팀원들과의 소통에서 너무 직설적으로 피드백하지 않도록 해요.", quote: "차가워 보여도 괜찮아요, 당신 원래 따뜻한 사람 🤍" },
      { summary: "판단력 신내림 받은 날 🎯", detail: "오늘 당신의 판단력이 무섭게 정확해요. 사람 보는 눈도, 상황 파악하는 능력도, 뭔가 결정해야 할 때의 직감도 모두 평소보다 월등히 높아요. 이 능력을 중요한 결정에 써요. 계약서 검토, 투자 판단, 중요한 선택 같은 거요. 오늘 당신 판단 믿어도 돼요.", friend: "친구 관계에서 진짜 친구와 아닌 친구를 구별하게 되는 순간이 올 수 있어요. 불편한 진실을 마주할 수도 있지만, 알고 나면 관계가 더 건강해져요.", family: "가족 내 갈등이 있다면 오늘 해결사 역할을 할 수 있어요. 객관적으로 상황을 파악하고 중재하는 능력이 오늘 빛을 발해요.", work: "복잡한 문제 해결, 어려운 분석 작업에 오늘이 딱이에요. 머리가 맑고 논리적으로 생각이 잘 정리되는 날이거든요.", quote: "직감 믿어요. 오늘 당신 직감은 GPS 🗺️" }
    ],
    수: [
      { summary: "직감이 오늘따라 소름돋게 맞는 날 🌊", detail: "오늘 뭔가 느낌이 오는 게 있죠? 그 느낌 믿어요. 오늘 당신의 직관이 어마어마하게 발달해 있는 날이거든요. 선택의 기로에서 논리보다 느낌으로 결정하면 더 잘 맞아요. 감성도 풍부해서 음악 들으면 눈물 나거나, 영화 보면 엄청 감동받는 날일 거예요.", friend: "오늘 친구의 감정 상태를 누구보다 잘 파악할 수 있어요. '야 너 요즘 힘들지?' 한마디가 친구에게 큰 위로가 될 수 있어요. 오늘 당신이 최고의 위로자예요.", family: "가족 중 누군가의 마음을 오늘 유독 잘 읽을 수 있어요. 말 안 해도 알 것 같은 느낌이요. 그 느낌대로 먼저 다가가 보세요.", work: "오늘은 데이터나 논리보다 경험과 직감을 믿어요. 오래 일해온 분야라면 특히 감에 의존해도 괜찮은 날이에요. 창의적인 아이디어가 잘 나오는 날이기도 해요.", quote: "느낌 아니까. 오늘은 그 느낌대로 가요 🌙" },
      { summary: "감수성 터지는 날, 눈물 주의 😭✨", detail: "오늘 감정이 풍부해서 별것 아닌 것에도 뭉클할 수 있어요. 옛날 사진 보다가 갑자기 울컥한다든가, 좋아하는 노래 듣다가 눈물이 차오른다든가. 이상한 게 아니에요. 오늘 당신 감수성이 활짝 열려있는 거예요. 이 감성 잘 쓰면 글 쓰거나 그림 그리거나 하는 창작 활동에 최고의 날이에요.", friend: "오늘 친구랑 진짜 깊은 대화를 나눌 수 있어요. 평소에 못 했던 속마음 얘기, 오래된 상처나 고민 같은 거요. 서로를 더 깊이 이해하는 계기가 될 수 있어요.", family: "오늘 가족에 대한 감사함이 더 크게 느껴지는 날이에요. 당연하게 여겼던 것들이 소중하게 보일 거예요. 표현해주세요. 가족도 듣고 싶어 해요.", work: "오늘 창의적인 작업에서 빛을 발해요. 디자인, 글쓰기, 기획 같은 감성이 필요한 작업은 오늘 하면 평소보다 훨씬 좋은 결과물이 나와요.", quote: "감정도 능력이에요. 오늘은 맘껏 느껴요 💙" },
      { summary: "오늘 생각이 너무 많아 뇌 과부하 🌀", detail: "오늘 머릿속에 생각이 엄청 많은 날이에요. 이 생각 저 생각, 과거 생각 미래 생각, 쓸데없는 걱정까지 다 몰려오는 날이에요. 이럴 때일수록 일단 지금 이 순간에 집중하는 게 도움이 돼요. 산책하거나, 음악 듣거나, 아무 생각 없이 할 수 있는 단순한 일 하면서 뇌 리셋 시간 가져봐요.", friend: "오늘 친구와의 연락이 당신 기분을 환기시켜줄 수 있어요. 생각 많을 때 혼자 있으면 더 생각 많아지거든요. 가볍게 연락해서 일상 얘기 나눠봐요.", family: "가족이 오늘 당신이 뭔가 고민 있어 보인다고 느낄 수 있어요. 억지로 밝은 척하지 말고, '나 오늘 좀 생각이 많아'라고 솔직하게 얘기해도 돼요.", work: "오늘 집중이 잘 안 될 수 있어요. 복잡한 의사결정보다는 단순하고 반복적인 작업 위주로 처리하는 게 좋아요. 중요한 결정은 내일로 미뤄도 괜찮아요.", quote: "생각 그만, 숨만 쉬어도 돼요 🌬️" }
    ]
  };

  const tpl = templates[dominant]?.[idx] || templates['토'][0];
  return tpl;
}

/* =============================================
   오행별 이모지
   ============================================= */
const OHANG_EMOJI = {
  '목': '🌿', '화': '🔥', '토': '🌍', '금': '⚡', '수': '💧'
};

/* =============================================
   상태
   ============================================= */
let selectedGender = null;
let currentNumbers = [];
let currentSaju    = null;

function selectGender(g) {
  selectedGender = g;
  document.querySelectorAll('.gender-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.gender === g);
  });
}

/* =============================================
   메인 실행
   ============================================= */
async function startFortune() {
  const year  = parseInt(document.getElementById('birthYear').value);
  const month = parseInt(document.getElementById('birthMonth').value);
  const day   = parseInt(document.getElementById('birthDay').value);
  const hour  = document.getElementById('birthHour').value;

  if (!year)          { showToast('태어난 년도를 선택해주세요 🎂'); return; }
  if (!month)         { showToast('태어난 월을 선택해주세요 📅'); return; }
  if (!day)           { showToast('태어난 날을 선택해주세요 📅'); return; }
  if (!selectedGender){ showToast('성별을 선택해주세요 🙋'); return; }

  // 히어로/입력 숨기기
  document.getElementById('heroSection').classList.add('hidden');
  document.getElementById('inputSection').classList.add('hidden');
  document.getElementById('infoSection').classList.add('hidden');
  document.getElementById('loadingSection').classList.remove('hidden');

  // 사주 계산
  currentSaju = getSaju(year, month, day, hour || null);

  // 운세 가져오기
  let fortune;
  try {
    if (GEMINI_API_KEY && GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE') {
      fortune = await getFortuneFromGemini(currentSaju, selectedGender);
    } else {
      fortune = getFortuneTemplate(currentSaju);
    }
  } catch(e) {
    console.warn('Gemini 실패, 템플릿 사용:', e);
    fortune = getFortuneTemplate(currentSaju);
  }

  // 행운번호
  currentNumbers = generateLucky(currentSaju, selectedGender);

  // 로딩 숨기고 결과 표시
  document.getElementById('loadingSection').classList.add('hidden');
  document.getElementById('resultSection').classList.remove('hidden');

  renderResult(currentSaju, fortune, currentNumbers);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* =============================================
   결과 렌더링
   ============================================= */
function renderResult(saju, fortune, numbers) {
  const today = new Date();
  document.getElementById('todayDate').textContent =
    `${today.getFullYear()}년 ${today.getMonth()+1}월 ${today.getDate()}일`;

  // 오행별 이모지
  const dominant = Object.entries(saju.ohang).sort((a,b)=>b[1]-a[1])[0][0];
  document.getElementById('fortuneEmoji').textContent = OHANG_EMOJI[dominant] || '✨';

  // 사주 기둥
  document.getElementById('sajuPillars').innerHTML = saju.pillars.map(p => `
    <div class="pillar">
      <div class="pillar-label">${p.label}</div>
      <div class="pillar-gan">${p.gan === '?' ? '?' : (CHEONGAN_KO[p.gan]||p.gan)}</div>
      <div class="pillar-ji">${p.ji  === '?' ? '?' : (JIJI_KO[p.ji]||p.ji)}</div>
      <div class="pillar-ko">${p.gan}${p.ji}</div>
    </div>
  `).join('');

  // 오행 태그
  document.getElementById('ohangTags').innerHTML = Object.entries(saju.ohang)
    .filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1])
    .map(([k,v])=>`<span class="ohang-tag ohang-${OHANG_CLASS[k]}">${OHANG_KO[k]} ×${v}</span>`)
    .join('');

  // 띠
  document.getElementById('ddiBadge').textContent = saju.ddi ? `${saju.ddi}띠 🐾` : '';

  // 한줄 요약
  document.getElementById('fortuneSummary').textContent = fortune.summary;

  // 점수
  const scores = getScores(saju);
  document.getElementById('fortuneScores').innerHTML = scores.map(s => `
    <div class="score-item">
      <div class="score-label">${s.label}</div>
      <div class="score-emoji">${s.emoji}</div>
      <div class="score-val">${s.text}</div>
    </div>
  `).join('');

  // 상세 풀이
  document.getElementById('fortuneDetail').textContent = fortune.detail;

  // 친구/가족/직장
  document.getElementById('fortuneSections').innerHTML = `
    <div class="fortune-section-item friend">
      <div class="section-title">👯 친구 관계</div>
      <div class="section-text">${fortune.friend}</div>
    </div>
    <div class="fortune-section-item family">
      <div class="section-title">🏠 가족 관계</div>
      <div class="section-text">${fortune.family}</div>
    </div>
    <div class="fortune-section-item work">
      <div class="section-title">💼 직장/학교</div>
      <div class="section-text">${fortune.work}</div>
    </div>
  `;

  // 한마디
  document.getElementById('fortuneQuote').textContent = fortune.quote;

  // 행운번호
  const ballClass = n => n<=10?'ball-1':n<=20?'ball-2':n<=30?'ball-3':n<=40?'ball-4':'ball-5';
  document.getElementById('luckyNumbers').innerHTML = numbers
    .map(n=>`<div class="lucky-ball ${ballClass(n)}">${n}</div>`).join('');
}

/* =============================================
   리셋
   ============================================= */
function resetAll() {
  document.getElementById('resultSection').classList.add('hidden');
  document.getElementById('loadingSection').classList.add('hidden');
  document.getElementById('heroSection').classList.remove('hidden');
  document.getElementById('inputSection').classList.remove('hidden');
  document.getElementById('infoSection').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* =============================================
   공유 / 복사
   ============================================= */
function copyLink() {
  navigator.clipboard.writeText(window.location.href)
    .then(() => showToast('링크 복사 완료! 친구한테 공유해요 🔗'))
    .catch(() => showToast('복사 실패했어요'));
}

function shareKakao() {
  if (typeof Kakao === 'undefined' || !Kakao.isInitialized()) {
    copyLink(); return;
  }
  Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title: '🍡 찰떡사주 - 내 사주 진짜 너무 찰떡이야',
      description: '생년월일 입력하면 찰떡같이 맞는 사주풀이 해줘요. 친구한테 공유각!',
      imageUrl: 'https://via.placeholder.com/800x400/FFB3C6/3D2C4E?text=%F0%9F%8D%A1+%EC%B0%B0%EB%96%A1%EC%82%AC%EC%A3%BC',
      link: { mobileWebUrl: window.location.href, webUrl: window.location.href }
    },
    buttons: [{ title: '나도 보기', link: { mobileWebUrl: window.location.href, webUrl: window.location.href } }]
  });
}

function saveImage() {
  if (typeof html2canvas === 'undefined') {
    showToast('이미지 저장 준비 중이에요 😊'); return;
  }
  const card = document.getElementById('fortuneCard');
  showToast('이미지 만드는 중... 🎨');
  html2canvas(card, {
    scale: 2,
    backgroundColor: '#FFF5F8',
    useCORS: true
  }).then(canvas => {
    const link = document.createElement('a');
    link.download = '찰떡사주_오늘운세.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('이미지 저장 완료! 인스타에 올려요 📸');
  }).catch(() => showToast('저장 실패했어요. 스크린샷 찍어요 📱'));
}

function copyNumbers() {
  if (!currentNumbers.length) return;
  const text = `🍡 찰떡사주 오늘의 행운번호\n${new Date().toLocaleDateString('ko-KR')}\n\n${currentNumbers.join(', ')}\n\n찰떡사주: ${window.location.href}`;
  navigator.clipboard.writeText(text)
    .then(() => showToast('행운번호 복사 완료! 📋'))
    .catch(() => showToast('복사 실패했어요'));
}

/* =============================================
   토스트
   ============================================= */
function showToast(msg) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}
