#!/usr/bin/env python3
"""
ExerciseDB(무료 API) 전체 카탈로그를 받아 앱용 데이터로 변환한다.

  python3 scripts/build-exercisedb.py [catalog.json] [gifstatus.txt]

- catalog.json 을 주지 않으면 https://oss.exercisedb.dev/api/v1/exercises 를 페이지 단위로 받는다.
- gifstatus.txt (줄마다 "<id> <http status>") 를 주면 GIF가 없는(404) 운동을 표시한다.
출력:
  src/data/edb/catalog.json       목록·검색용 (작게 유지)
  src/data/edb/instructions.json  상세 화면에서만 lazy 로드하는 영문 설명
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'data', 'edb')

# 운동 이름 단어 → 한국 헬스장에서 쓰는 표기
WORDS = {
    'dumbbell': '덤벨', 'dumbbells': '덤벨', 'barbell': '바벨', 'cable': '케이블', 'kettlebell': '케틀벨',
    'smith': '스미스', 'band': '밴드', 'machine': '머신', 'lever': '레버', 'sled': '슬레드', 'ez': 'EZ',
    'bar': '바', 'bars': '바', 'rope': '로프', 'ball': '볼', 'medicine': '메디신', 'stability': '스테빌리티',
    'bosu': '보수', 'roller': '롤러', 'towel': '수건', 'bench': '벤치', 'benches': '벤치', 'wall': '벽',
    'chair': '의자', 'box': '박스', 'step': '스텝', 'platform': '플랫폼', 'trap': '트랩', 'olympic': '올림픽',
    'weighted': '중량', 'bodyweight': '맨몸', 'assisted': '어시스트', 'suspended': '서스펜션', 'trainer': '트레이너',
    'curl': '컬', 'curls': '컬', 'press': '프레스', 'presses': '프레스', 'raise': '레이즈', 'raises': '레이즈',
    'row': '로우', 'squat': '스쿼트', 'squats': '스쿼트', 'squatting': '스쿼팅', 'lunge': '런지', 'deadlift': '데드리프트',
    'extension': '익스텐션', 'fly': '플라이', 'flyes': '플라이', 'crunch': '크런치', 'crunches': '크런치',
    'pulldown': '풀다운', 'pushdown': '푸쉬다운', 'pullover': '풀오버', 'shrug': '슈러그', 'dip': '딥스', 'dips': '딥스',
    'plank': '플랭크', 'bridge': '브릿지', 'kickback': '킥백', 'kickbacks': '킥백', 'twist': '트위스트', 'twists': '트위스트',
    'stretch': '스트레칭', 'swing': '스윙', 'snatch': '스내치', 'clean': '클린', 'jerk': '저크', 'thruster': '스러스터',
    'thrusts': '스러스트', 'rollout': '롤아웃', 'walk': '워크', 'walking': '워킹', 'run': '런', 'jump': '점프', 'jumps': '점프',
    'burpee': '버피', 'crawl': '크롤', 'hyperextension': '하이퍼익스텐션', 'pistol': '피스톨', 'shrugs': '슈러그',
    'push': '푸쉬', 'pull': '풀', 'up': '업', 'ups': '업', 'sit': '싯', 'chin': '친', 'step-up': '스텝업',
    'incline': '인클라인', 'decline': '디클라인', 'seated': '시티드', 'standing': '스탠딩', 'lying': '라잉',
    'kneeling': '닐링', 'hanging': '행잉', 'prone': '엎드린', 'supine': '누운', 'bent': '벤트', 'over': '오버',
    'reverse': '리버스', 'close': '클로즈', 'wide': '와이드', 'narrow': '내로우', 'grip': '그립', 'neutral': '뉴트럴',
    'underhand': '언더핸드', 'overhand': '오버핸드', 'alternate': '얼터네이트', 'alternating': '얼터네이팅',
    'single': '싱글', 'one': '원', 'two': '투', 'double': '더블', 'arm': '암', 'arms': '암', 'leg': '레그', 'legs': '레그',
    'legged': '레그', 'side': '사이드', 'lateral': '레터럴', 'front': '프론트', 'rear': '리어', 'back': '백', 'upright': '업라이트',
    'overhead': '오버헤드', 'behind': '비하인드', 'head': '헤드', 'neck': '넥', 'straight': '스트레이트', 'stiff': '스티프',
    'full': '풀', 'half': '하프', 'high': '하이', 'low': '로우', 'lower': '로어', 'upper': '어퍼', 'inner': '이너',
    'outer': '아우터', 'hammer': '해머', 'preacher': '프리처', 'concentration': '컨센트레이션', 'spider': '스파이더',
    'zottman': '조트만', 'drag': '드래그', 'french': '프렌치', 'skull': '스컬', 'crusher': '크러셔', 'skullcrusher': '스컬크러셔',
    'tate': '테이트', 'jm': 'JM', 'military': '밀리터리', 'arnold': '아놀드', 'chest': '체스트', 'shoulder': '숄더',
    'triceps': '트라이셉스', 'biceps': '바이셉스', 'calf': '카프', 'calves': '카프', 'hip': '힙', 'glute': '글루트',
    'glutes': '글루트', 'hamstring': '햄스트링', 'quads': '대퇴사두', 'wrist': '리스트', 'delt': '델트', 'lat': '랫',
    'abdominal': '복부', 'oblique': '오블리크', 'toe': '토', 'knee': '니', 'knees': '니', 'hands': '핸즈', 'hand': '핸드',
    'palm': '팜', 'palms': '팜', 'elbow': '엘보', 'body': '바디', 'romanian': '루마니안', 'sumo': '스모', 'hack': '핵',
    'goblet': '고블릿', 'split': '스플릿', 'bulgarian': '불가리안', 'russian': '러시안', 'good': '굿', 'morning': '모닝',
    'pike': '파이크', 'planche': '플란체', 'inverted': '인버티드', 'inverse': '인버스', 'v': 'V', 'cross': '크로스',
    'crossover': '크로스오버', 'crossovers': '크로스오버', 'rotation': '로테이션', 'rotational': '로테이셔널',
    'twisting': '트위스팅', 'twisted': '트위스티드', 'external': '외회전', 'internal': '내회전', 'flexion': '굴곡',
    'abduction': '외전', 'adduction': '내전', 'parallel': '패럴렐', 'attachment': '어태치먼트', 'blaster': '블래스터',
    'floor': '플로어', 'flat': '플랫', 'mountain': '마운틴', 'climber': '클라이머', 'jack': '잭', 'jumping': '점핑',
    'frog': '프로그', 'donkey': '동키', 'sissy': '시시', 'superman': '슈퍼맨', 'bicycle': '바이시클', 'scissor': '시저',
    'flutter': '플러터', 'kicks': '킥', 'kick': '킥', 'windmill': '윈드밀', 'pallof': '팔로프', 'landmine': '랜드마인',
    'farmers': '파머스', 'carry': '캐리', 'pendlay': '펜들레이', 'zercher': '저처', 'cossack': '코삭', 'curtsey': '커트시',
    'turkish': '터키시', 'get': '겟', 'inchworm': '인치웜', 'handstand': '물구나무', 'muscle': '머슬', 'lift': '리프트',
    'tuck': '턱', 'hold': '홀드', 'isometric': '등척성', 'dead': '데드', 'bug': '버그', 'bird': '버드', 'dog': '독',
    'cat': '캣', 'cobra': '코브라', 'sphinx': '스핑크스', 'yoga': '요가', 'pose': '자세', 'circles': '서클',
    'scapula': '견갑', 'scapular': '견갑', 'retraction': '후인', 'depression': '하강', 'shoulders': '숄더',
    'face': '페이스', 'butterfly': '버터플라이', 'pec': '펙', 'deck': '덱', 'cuban': '쿠반', 'w': 'W', 'y': 'Y', 't': 'T',
    'l': 'L', 'reach': '리치', 'touch': '터치', 'tap': '탭', 'march': '마치', 'sprint': '스프린트', 'sprints': '스프린트',
    'stationary': '실내', 'bike': '자전거', 'elliptical': '일립티컬', 'treadmill': '트레드밀', 'ski': '스키',
    'ergometer': '에르고미터', 'battling': '배틀', 'ropes': '로프', 'boxing': '복싱', 'slam': '슬램', 'throw': '스로우',
    'wheel': '휠', 'tire': '타이어', 'flip': '플립', 'sledge': '슬레지', 'stepmill': '스텝밀', 'hyper': '하이퍼',
    'gravity': '그래비티', 'anti': '안티', 'negative': '네거티브', 'kipping': '키핑', 'archer': '아처', 'diamond': '다이아몬드',
    'clap': '박수', 'plyo': '플라이오', 'depth': '뎁스', 'drop': '드롭', 'skater': '스케이터', 'hops': '홉',
    'forward': '포워드', 'backward': '백워드', 'lean': '린', 'sitting': '앉은', 'position': '자세', 'stance': '스탠스',
    'deep': '딥', 'quarter': '쿼터', 'partial': '파셜', 'range': '레인지', 'motion': '모션', 'outside': '바깥', 'inside': '안쪽',
    'pulley': '풀리', 'handle': '핸들', 'twin': '트윈', 'stirrups': '스터럽', 'strap': '스트랩', 'straps': '스트랩',
    'pad': '패드', 'cage': '케이지', 'rack': '랙', 'pin': '핀', 'pro': '프로', 'crab': '크랩', 'bear': '베어',
    'chest-supported': '체스트 서포티드', 'supported': '서포티드', 'support': '서포트', 'unilateral': '편측',
    'contralateral': '반대측', 'ipsilateral': '동측', 'rocky': '로키', 'svend': '스벤드', 'renegade': '레니게이드',
    'hug': '허그', 'squeeze': '스퀴즈', 'hindu': '힌두', 'judo': '유도', 'stride': '스트라이드', 'pronated': '프로네이티드',
    'supinated': '수피네이티드', 'pronation': '회내', 'supination': '회외', 'bend': '벤드', 'bends': '벤드',
    'piriformis': '이상근', 'groin': '서혜부', 'spine': '척추', 'pelvic': '골반', 'tilt': '틸트', 'flexor': '굴곡근',
    'gironda': '지론다', 'sternum': '스터넘', 'bradford': '브래드포드', 'jefferson': '제퍼슨', 'thibaudeau': '티보도',
    'otis': '오티스', 'scott': '스캇', 'london': '런던', 'frankenstein': '프랑켄슈타인', 'gorilla': '고릴라',
    'potty': '포티', 'janda': '얀다', 'stalder': '스탈더', 'maltese': '몰티즈', 'kayak': '카약', 'swimmer': '스위머',
    'star': '스타', 'skin': '스킨', 'monster': '몬스터', 'world': '월드', 'greatest': '그레이티스트', 'mixed': '믹스',
    'pyramid': '피라미드', 'speed': '스피드', 'power': '파워', 'quick': '퀵', 'dynamic': '다이나믹', 'static': '스태틱',
    'modified': '변형', 'advanced': '고급', 'intermediate': '중급', 'beginner': '초급', 'big': '빅', 'short': '숏',
    'mini': '미니', 'self': '셀프', 'pov': '시점', 'elevated': '엘리베이티드', 'raised': '레이즈드', 'extended': '익스텐디드',
    'clasped': '깍지', 'fixed': '고정', 'semi': '세미', 'multiple': '멀티플', 'peroneals': '비골근', 'tibialis': '전경골근',
    'rectus': '대퇴직근', 'femoris': '', 'pectoralis': '대흉근', 'major': '', 'deltoid': '삼각근', 'gluteus': '둔근',
    'abductor': '외전근', 'adductor': '내전근', 'calf-raise': '카프 레이즈', 'feet': '발', 'ankle': '발목', 'ankles': '발목',
    'finger': '손가락', 'heel': '뒤꿈치', 'butt': '엉덩이', 'all': '올', 'fours': '포', 'figure': '피겨', 'reverse-grip': '리버스 그립',
    'hip-thrust': '힙 쓰러스트', 'wipers': '와이퍼', 'windshield': '윈드실드', 'cocoons': '코쿤', 'response': '리스폰스',
    'balance': '밸런스', 'gripless': '노그립', 'stork': '스톡', 'skier': '스키어', 'runners': '러너', 'bowling': '볼링',
    'impossible': '임파서블', 'upward': '업워드', 'facing': '페이싱', 'depressor': '디프레서', 'retractor': '리트랙터',
    'stepbox': '스텝박스', 'guillotine': '길로틴', 'sequence': '시퀀스', 'left': '왼쪽', 'right': '오른쪽', 'hook': '훅',
    'stabilization': '안정화', 'waiter': '웨이터', 'prisoner': '프리즈너', 'gripper': '그리퍼', 'rotary': '로터리',
    'spell': '스펠', 'caster': '캐스터', 'flag': '플래그', 'catch': '캐치', 'release': '릴리즈', 'touchers': '터치',
    'wind': '윈드', 'cambered': '캠버드', 'outstretched': '뻗은', 'korean': '코리안', 'lifting': '리프팅', 'seesaw': '시소',
    'round': '라운드', 'ham': '햄', 'captains': '캡틴스', 'ground': '그라운드', 'board': '보드', 'angled': '앵글',
    'saw': '쏘', 'middle': '미들', 'ab': '복근', 'cycle': '사이클', 'equipment': '기구', 'climb': '클라임', 'reversed': '리버스드',
    'reclining': '리클라이닝', 'slide': '슬라이드', 'jackknife': '잭나이프', 'knife': '나이프', 'horizontal': '호리즌탈',
    'vertical': '버티컬', 'diagonal': '대각선', 'circular': '원형', 'rocking': '로킹', 'rotate': '회전', 'point': '포인트',
    'clock': '클락', 'posterior': '후면', 'drive': '드라이브', 'angle': '앵글', 'style': '스타일', 'reps': '반복',
    'squad': '스쿼드', 'slingers': '슬링어', 'kicks-up': '킥업', 'stretching': '스트레칭', 'chin-up': '친업',
    'pull-up': '풀업', 'push-up': '푸쉬업', 'sit-up': '싯업', 'v-up': 'V업', 'v-bar': 'V바', 'ez-bar': 'EZ바',
    'tennis': '테니스', 'svend-press': '스벤드 프레스', 'iron': '아이언', 'ring': '링', 'astride': '애스트라이드',
    'forth': '포스', 'closer': '클로저', 'bottoms': '바텀스', 'pass': '패스', 'trx': 'TRX', 'peck': '펙', 'hyght': '하이트',
    'chair-squat': '체어 스쿼트', 'can': '캔', 'above': '위로', 'across': '가로질러', 'under': '아래', 'both': '양쪽',
    'apart': '벌려', 'off': '오프', 'out': '아웃', 'in': '인', 'down': '다운', 'through': '스루', 'around': '어라운드',
    'between': '사이', 'into': '', 'from': '', 'with': '', 'on': '', 'the': '', 'a': '', 'and': '앤', 'to': '→', 'of': '',
    'at': '', 'plus': '+', 'degrees': '°', 'prsingle': '싱글', 'rollerer': '롤러',
    'gymball': '짐볼', 'exercise': '', 'against': '', 'pronate': '프로네이트', 'quad': '쿼드', 'staircase': '계단',
    'straddle': '스트래들', 'three': '쓰리', 'elevator': '엘리베이터', 'fallout': '폴아웃', 'hang': '행',
}

BODY = {
    'chest': '가슴', 'back': '등', 'shoulders': '어깨', 'neck': '어깨', 'upper arms': '팔', 'lower arms': '팔',
    'upper legs': '하체', 'lower legs': '하체', 'waist': '복근', 'cardio': '유산소',
}
EQUIP = {
    'bodyweight': '맨몸', 'dumbbell': '덤벨', 'cable': '케이블', 'barbell': '바벨', 'olympic barbell': '바벨',
    'EZ bar': 'EZ바', 'trap bar': '바벨', 'smith machine': '머신', 'leverage machine': '머신', 'sled machine': '머신',
    'assisted': '머신', 'elliptical machine': '유산소 기구', 'stationary bike': '유산소 기구', 'stepmill machine': '유산소 기구',
    'upper body ergometer': '유산소 기구', 'ski ergometer': '유산소 기구', 'kettlebell': '케틀벨', 'resistance band': '밴드',
    'stability ball': '짐볼', 'medicine ball': '메디신볼', 'bosu ball': '보수볼', 'weighted': '중량', 'rope': '로프',
    'roller': '롤러', 'suspension trainer': 'TRX', 'towel': '기타', 'ab wheel': '기타', 'tennis ball': '기타',
    'tire': '기타', 'hammer': '기타',
}
MUSCLE = {
    'pectorals': '가슴', 'serratus anterior': '가슴', 'latissimus dorsi': '등', 'upper back': '등', 'trapezius': '등',
    'rhomboids': '등', 'erector spinae': '등', 'back': '등', 'levator scapulae': '목', 'sternocleidomastoid': '목',
    'deltoids': '어깨', 'rear deltoids': '어깨', 'rotator cuff': '어깨', 'biceps': '이두', 'brachialis': '이두',
    'triceps': '삼두', 'forearms': '전완', 'wrists': '전완', 'wrist flexors': '전완', 'wrist extensors': '전완',
    'grip muscles': '전완', 'hands': '전완', 'quadriceps': '대퇴사두', 'hamstrings': '햄스트링', 'glutes': '둔근',
    'abductors': '둔근', 'adductors': '내전근', 'hip flexors': '코어', 'calves': '종아리', 'soleus': '종아리',
    'tibialis anterior': '종아리', 'ankles': '종아리', 'ankle stabilizers': '종아리', 'feet': '종아리',
    'abdominals': '복근', 'obliques': '복근', 'core': '코어', 'cardiovascular system': '심폐',
}


def ko_name(name: str) -> str:
    out = []
    name = re.sub(r'(?i)(exercise|stability) ball', 'gymball', name)
    for tok in re.findall(r"\(|\)|[A-Za-z0-9°]+(?:-[A-Za-z]+)*|[^\sA-Za-z0-9°()]+", name):
        low = tok.lower()
        if tok in '()':
            out.append(tok)
        elif low in WORDS:
            if WORDS[low]:
                out.append(WORDS[low])
        elif '-' in low:
            out.append(''.join(WORDS.get(p, p) for p in low.split('-')))
        else:
            out.append(tok)
    s = ' '.join(out)
    s = re.sub(r'\(\s+', '(', s)
    s = re.sub(r'\s+\)', ')', s)
    s = re.sub(r'\(\)', '', s)
    return re.sub(r'\s+', ' ', s).strip()


def fetch_all():
    out, cur = [], None
    while True:
        url = 'https://oss.exercisedb.dev/api/v1/exercises?limit=100' + (f'&after={cur}' if cur else '')
        d = json.loads(subprocess.run(['curl', '-sS', '-m', '30', url], capture_output=True, text=True).stdout)
        out += d['data']
        if not d['meta'].get('hasNextPage'):
            return out
        cur = d['meta']['nextCursor']


def uniq(xs):
    seen = []
    for x in xs:
        if x and x not in seen:
            seen.append(x)
    return seen


def main():
    data = json.load(open(sys.argv[1])) if len(sys.argv) > 1 else fetch_all()
    missing = set()
    if len(sys.argv) > 2:
        for line in open(sys.argv[2]):
            parts = line.split()
            if len(parts) == 2 and parts[1] != '200':
                missing.add(parts[0])
    # 같은 이름이 여러 ID로 중복된 경우 하나만 남김: 앱 대표 운동이 쓰는 ID > GIF 있는 ID > 나머지
    src = open(os.path.join(ROOT, 'src', 'data', 'exercisedb.ts')).read()
    pinned = set(re.findall(r":\s*'(\w{7})',", src))
    best = {}
    for e in data:
        key = e['name'].lower().strip()
        rank = (e['exerciseId'] in pinned, e['exerciseId'] not in missing)
        if key not in best or rank > best[key][0]:
            best[key] = (rank, e)
    data = [v[1] for v in best.values()]

    catalog, instructions = [], {}
    for e in sorted(data, key=lambda e: e['name'].lower()):
        eid = e['exerciseId']
        primary = uniq(MUSCLE.get(m) for m in e['targetMuscles'])
        secondary = [m for m in uniq(MUSCLE.get(m) for m in e['secondaryMuscles']) if m not in primary]
        catalog.append({
            'id': eid,
            'en': e['name'],
            'ko': ko_name(e['name']),
            'cat': BODY.get(e['bodyParts'][0], '기타'),
            'eq': EQUIP.get(e['equipments'][0], '기타'),
            'p': primary,
            's': secondary,
            **({'nogif': 1} if eid in missing else {}),
        })
        instructions[eid] = [re.sub(r'^Step:\s*\d+\s*', '', s).strip() for s in e['instructions']]
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'catalog.json'), 'w') as f:
        json.dump(catalog, f, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(OUT, 'instructions.json'), 'w') as f:
        json.dump(instructions, f, ensure_ascii=False, separators=(',', ':'))
    untranslated = sorted({w for c in catalog for w in re.findall(r'[A-Za-z]{3,}', c['ko'])} - {'TRX'})
    nogif = sum(1 for c in catalog if c.get('nogif'))
    print(f'{len(catalog)} exercises, {nogif} without GIF, untranslated words: {untranslated}')


if __name__ == '__main__':
    main()
