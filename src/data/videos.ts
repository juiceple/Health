export type Video = { id: string; title: string; channel: string }

/**
 * 종목별 기본 자세 영상 (한국어, 자세 설명 위주).
 * 모두 YouTube oEmbed로 존재·임베드 가능 여부를 확인함 (2026-10).
 */
export const VIDEOS: Record<string, Video> = {
  squat: { id: 'fy9URmTqNio', title: '스쿼트 잘못된 방식과 자세 교정 방법', channel: '운동가이더' },
  'barbell-squat': { id: '50f62PSGY7k', title: '스쿼트 최종본 (발 위치, 힙드라이브, 척추정렬, 시선)', channel: '핏블리 FITVELY' },
  lunge: { id: '7erin-2cpRo', title: '런지! 잘못하시면 무릎 박살납니다', channel: '이득근' },
  deadlift: { id: 'EBjYQeeBI-0', title: '완벽한 데드리프트 강의 [운동의 정석]', channel: '피지컬갤러리' },
  rdl: { id: 'DWw_ahC4m0Y', title: '데드리프트 이것만 알면 끝납니다 (루마니안)', channel: '양선수의 온라인PT' },
  'bench-press': { id: '0DsXTSHo3lU', title: '완벽한 벤치프레스 강의 [운동의 정석]', channel: '피지컬갤러리' },
  'db-fly': { id: '2kF_Yntd_UE', title: '덤벨플라이 이렇게 해야 자극 옵니다', channel: '제로범TV' },
  pushup: { id: '-_DUjHxgmWk', title: '팔굽혀펴기의 정석, 완벽한 푸쉬업 자세 교본', channel: '바벨라토르' },
  pullup: { id: 'nWhS28U6bCY', title: '턱걸이의 정석, 완벽한 풀업 자세 교본', channel: '바벨라토르' },
  'lat-pulldown': { id: '2K2WCGstHOY', title: '랫풀다운 제대로 하기', channel: '강경원' },
  'barbell-row': { id: 'EEqGCoTuYfQ', title: '완벽한 바벨로우 강의 [운동의 정석]', channel: '피지컬갤러리' },
  ohp: { id: 'L21V_4m5JCM', title: 'PT 안 받고 오버헤드프레스(OHP) 하면 꼭 보세요', channel: '이득근' },
  'db-shoulder-press': { id: '66gDfjrm-gk', title: '덤벨 숄더프레스 제대로 하는 법', channel: '핏블리 FITVELY' },
  'lateral-raise': { id: 'YdhHnZxcpgY', title: '사이드 레터럴 레이즈 자세 완벽정리', channel: '핏블리 FITVELY' },
  'db-curl': { id: 'SA1mLjTxgjU', title: '이두근 운동 덤벨컬을 배워봅시다', channel: '한조바디' },
  'triceps-pushdown': { id: 'ObEtLS9heOo', title: '케이블 푸쉬다운, 많은 분들이 잘못하는 운동', channel: '강경원' },
  'leg-press': { id: 'EV0F_3S7Sks', title: '레그 프레스, 어떻게 해야 효과적일까?', channel: '강경원' },
  'calf-raise': { id: 'OHp56zqYn6U', title: '얇은 종아리를 극복하는 최고의 운동 (카프레이즈)', channel: '보통사람을 위한 운동채널' },
  plank: { id: 'Zq8nRY9P_cM', title: '플랭크의 정석, 완벽한 플랭크 정자세 교본', channel: '바벨라토르' },
  crunch: { id: 'KqnFav4Edvw', title: "크런치 '이렇게' 절대 하지마세요", channel: '피지컬갤러리' },
}
