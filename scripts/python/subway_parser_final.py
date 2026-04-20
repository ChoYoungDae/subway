import pandas as pd
import re

def parse_subway_guide(text):
    raw = str(text).strip()
    
    # 층수 추출 및 클리닝
    floors = re.findall(r'\(([B\dF]+)\)', raw)
    location = floors[0] if floors else ""
    clean = re.sub(r'\([B\dF]+\)', '', raw).strip()
    
    # 키워드 체크
    is_elevator = any(kw in clean for kw in ['엘리베이터', 'E/L'])
    is_alight = '하차' in clean
    is_board = any(kw in clean for kw in ['탑승', '승차'])
    is_move = '이동' in clean
    is_gate = any(kw in clean for kw in ['통과', '태그', '게이트'])
    
    # 초기값 (Unknown)
    cat, icon, kr, en = "Unknown", "?", raw, raw
    
    # 분류 로직
    if is_alight:
        if is_elevator:
            cat, icon, kr, en = "Elevator Activity", "🛗", "엘리베이터 하차", "Exit Elevator"
        else:
            cat, icon, kr, en = "Subway Activity", "🚉", "하차", "Alight"
    elif is_board:
        if is_elevator:
            cat, icon, kr, en = "Elevator Activity", "🛗", "엘리베이터 탑승", "Enter Elevator"
        else:
            cat, icon, kr, en = "Subway Activity", "🚉", "승차", "Board"
    elif is_move:
        cat, icon, kr, en = "Move", "🚶", "이동", "Move"
    elif is_gate:
        cat, icon, kr, en = "Gate", "🎫", "게이트 통과", "Pass Gate"

    # 문장 압축 (상세내용 괄호 처리)
    if cat != "Unknown":
        for k in ['엘리베이터', '하차', '탑승', '승차', '이동', '통과', '태그', '역', '방면으로', 'E/L', '게이트']:
            clean = clean.replace(k, "")
        ctx = re.sub(r'\s+', ' ', clean.replace('옆', '').replace('에서', '').strip())
        
        kr_final = f"{kr} ({ctx})" if ctx else kr
        en_ctx = ctx.replace("방면", "Bound for").replace("출입구", "Exit").replace("출구", "Exit").replace("호선", "Line ")
        en_final = f"{en} ({en_ctx})" if ctx else en
        return cat, icon, location, kr_final, en_final
    
    return cat, icon, location, raw, raw

# 실행 (CSV 저장)
df = pd.read_csv('안내문구.csv')
df[['Category', 'Icon', 'Location', 'Refined_KR', 'Refined_EN']] = \
    df['Text'].apply(lambda x: pd.Series(parse_subway_guide(x)))
df.to_csv('subway_guidance_final.csv', index=False, encoding='utf-8-sig')