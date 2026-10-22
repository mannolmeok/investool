/* engine.js — 선 긋기 엔진 (engine/lines.py 를 그대로 옮긴 것). 폰·브라우저에서 즉시 계산.
   입력 rows: [{date:'YYYY-MM-DD', open, high, low, close, volume}] (오래된 → 최근)
   출력: lines.py analyze_df 와 같은 모양 {symbol, asof, close, krw, ma, levels, trend_upper, ..., confluence, sentences}
   파이썬 결과와 같은지 engine_test.mjs 로 검증 */
(function (root) {
  const max = a => a.reduce((m, x) => (x > m ? x : m), -Infinity);
  const min = a => a.reduce((m, x) => (x < m ? x : m), Infinity);
  const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  const pct = (a, b) => (a / b - 1) * 100;
  const roundHalfEven = x => { const f = Math.floor(x), d = x - f; if (Math.abs(d - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1; return Math.round(x); };
  const fmt = (x, krw) => krw ? roundHalfEven(x).toLocaleString('en-US') : x.toFixed(2);  // 파이썬 :,.0f 와 같은 반올림
  const sp = (x, d = 1) => (x >= 0 ? '+' : '') + x.toFixed(d);

  function swingPoints(d, k = 3) {
    const n = d.length, highs = [], lows = [];
    for (let i = k; i < n - k; i++) {
      let mh = -Infinity, ml = Infinity;
      for (let j = i - k; j <= i + k; j++) { if (d[j].high > mh) mh = d[j].high; if (d[j].low < ml) ml = d[j].low; }
      if (d[i].high === mh) highs.push(i);
      if (d[i].low === ml) lows.push(i);
    }
    return [highs, lows];
  }
  function rolling(c, w) { const out = new Array(c.length).fill(null); let s = 0; for (let i = 0; i < c.length; i++) { s += c[i]; if (i >= w) s -= c[i - w]; if (i >= w - 1) out[i] = s / w; } return out; }
  function rollingStd(c, w) { const out = new Array(c.length).fill(null); for (let i = w - 1; i < c.length; i++) { const sl = c.slice(i - w + 1, i + 1), m = mean(sl); out[i] = Math.sqrt(sl.reduce((s, x) => s + (x - m) ** 2, 0) / (w - 1)); } return out; }

  function movingAverages(df) {
    const c = df.map(r => r.close), out = {};
    for (const w of [20, 60, 120, 200]) {
      if (c.length >= w) {
        const s = rolling(c, w), L = c.length;
        out['sma' + w] = { value: s[L - 1], prev: s[L - 2], slope5: c.length >= w + 6 ? s[L - 1] - s[L - 6] : null };
      }
    }
    const crosses = [];
    for (const [a, b] of [[20, 60], [60, 120], [20, 120]]) {
      if (out['sma' + a] && out['sma' + b]) {
        const sa = rolling(c, a), sb = rolling(c, b);
        const diff = []; for (let i = 0; i < c.length; i++) if (sa[i] != null && sb[i] != null) diff.push(sa[i] - sb[i]);
        if (diff.length > 10) {
          const sign = diff.slice(-10).map(Math.sign);
          for (let i = 1; i < sign.length; i++) {
            if (sign[i - 1] < 0 && 0 <= sign[i]) crosses.push({ pair: `${a}/${b}`, type: 'golden', bars_ago: sign.length - 1 - i });
            if (sign[i - 1] > 0 && 0 >= sign[i]) crosses.push({ pair: `${a}/${b}`, type: 'dead', bars_ago: sign.length - 1 - i });
          }
        }
      }
    }
    const vals = ['sma20', 'sma60', 'sma120'].filter(k => out[k]).map(k => out[k].value);
    let arr = null;
    if (vals.length === 3) arr = vals[0] > vals[1] && vals[1] > vals[2] ? '정배열' : vals[0] < vals[1] && vals[1] < vals[2] ? '역배열' : '혼조';
    return [out, crosses, arr];
  }

  function horizontalLevels(df, lookback = 120, tol = 0.012, topN = 4) {
    const d = df.slice(-lookback);
    const [highs, lows] = swingPoints(d, 3);
    const pts = highs.map(i => [d[i].high, 'H']).concat(lows.map(i => [d[i].low, 'L']));
    pts.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
    let cl = [];
    for (const [p, kind] of pts) {
      const last = cl[cl.length - 1];
      if (last && Math.abs(p / last.price - 1) <= tol) { last.touches += 1; last.price = (last.price * (last.touches - 1) + p) / last.touches; last.kinds.push(kind); }
      else cl.push({ price: p, touches: 1, kinds: [kind] });
    }
    cl = cl.filter(c => c.touches >= 2);
    const lo = min(d.map(r => r.low)), hi = max(d.map(r => r.high));
    const bins = Array.from({ length: 21 }, (_, i) => lo + (hi - lo) * i / 20);
    const vp = new Array(20).fill(0);
    for (const r of d) {
      if (!r.vol_ok) continue;
      let idx = bins.findIndex(b => b >= r.close); if (idx === -1) idx = 21; idx = Math.min(19, Math.max(0, idx - 1));
      vp[idx] += r.volume;
    }
    const order = vp.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[1]);
    const top = order.slice(-3).sort((a, b) => a - b), tot = vp.reduce((s, x) => s + x, 0);
    const zones = top.map(i => ({ low: bins[i], high: bins[i + 1], share: vp[i] / tot }));
    cl.sort((a, b) => b.touches - a.touches);
    return [cl.slice(0, topN), zones];
  }

  function bestHull(y, x1, n, startX2, upper) {
    const y1 = y[x1]; let best = null;
    for (let x2 = startX2; x2 < n; x2++) {
      const slope = (y[x2] - y1) / (x2 - x1); let ok = true, touches = 0;
      for (let xk = x1 + 1; xk < n; xk++) {
        const ly = y1 + slope * (xk - x1);
        if (upper && y[xk] > ly * 1.004) { ok = false; break; }
        if (!upper && y[xk] < ly * 0.996) { ok = false; break; }
        if (Math.abs(y[xk] / ly - 1) <= 0.006) touches++;
      }
      if (ok && (best === null || touches > best.touches || (touches === best.touches && x2 > best.x2))) best = { x2, slope, touches };
    }
    return best;
  }

  function trendlines(df, lookback = 45, recentBars = 20) {
    const d = df.slice(-lookback), n = d.length;
    const [highs, lows] = swingPoints(d, 2);
    const bestLine = (idx, vals, upper) => {
      let best = null;
      for (let i = 0; i < idx.length; i++) for (let j = i + 1; j < idx.length; j++) {
        const x1 = idx[i], x2 = idx[j], y1 = vals[i], y2 = vals[j];
        if (x2 - x1 < 4 || x2 < n - recentBars) continue;
        const slope = (y2 - y1) / (x2 - x1); let ok = true, touches = 0;
        for (let k = 0; k < idx.length; k++) {
          const xk = idx[k], yk = vals[k]; if (xk < x1) continue;
          const ly = y1 + slope * (xk - x1);
          if (upper && yk > ly * 1.004) { ok = false; break; }
          if (!upper && yk < ly * 0.996) { ok = false; break; }
          if (Math.abs(yk / ly - 1) <= 0.006) touches++;
        }
        if (ok && (best === null || touches > best.touches || (touches === best.touches && x2 > best.x2))) best = { x1, x2, y1, slope, touches };
      }
      if (!best) return null;
      return { from: d[best.x1].date, to: d[best.x2].date, slope_per_bar: best.slope, slope_pct_per_bar: best.slope / best.y1 * 100,
        value_today: best.y1 + best.slope * (n - 1 - best.x1), touches: best.touches };
    };
    const up = highs.length >= 2 ? bestLine(highs, highs.map(i => d[i].high), true) : null;
    const lo = lows.length >= 2 ? bestLine(lows, lows.map(i => d[i].low), false) : null;
    return [up, lo];
  }

  function hullFromLastSwing(df, upper, lookback = 60, k = 3) {
    const d = df.slice(-lookback), n = d.length;
    const [highs, lows] = swingPoints(d, k);
    const pts = (upper ? highs : lows).filter(i => n - 1 - i >= 5);
    if (!pts.length) return null;
    const x1 = pts[pts.length - 1], y = d.map(r => upper ? r.high : r.low), y1 = y[x1];
    const best = bestHull(y, x1, n, x1 + 3, upper);
    if (!best) return null;
    return { from: d[x1].date, to: d[best.x2].date, slope_per_bar: best.slope, slope_pct_per_bar: best.slope / y1 * 100,
      value_today: y1 + best.slope * (n - 1 - x1), touches: best.touches + 1, method: 'hull' };
  }

  function hullFromTurningPoints(df, upper, close, lookback = 60, minAfter = 5, tol = 0.15) {
    const d = df.slice(-lookback), n = d.length, y = d.map(r => upper ? r.high : r.low);
    const starts = [];
    for (let i = 1; i < n - minAfter; i++) {
      const nxt = y.slice(i + 1, i + 3);
      if (upper && y[i] > max(nxt)) starts.push(i);
      if (!upper && y[i] < min(nxt)) starts.push(i);
    }
    const found = [];
    for (const x1 of [...starts].reverse()) {
      const y1 = y[x1], best = bestHull(y, x1, n, x1 + 2, upper);
      if (!best) continue;
      const vt = y1 + best.slope * (n - 1 - x1);
      if (Math.abs(vt / close - 1) <= tol) found.push({ from: d[x1].date, to: d[best.x2].date, slope_per_bar: best.slope, slope_pct_per_bar: best.slope / y1 * 100, value_today: vt, touches: best.touches + 1, method: 'turning', _x1: x1 });
      if (found.length >= 4) break;
    }
    if (!found.length) return null;
    found.sort((a, b) => b.touches - a.touches || a._x1 - b._x1);
    const b = found[0]; delete b._x1; return b;
  }

  function pattern(df, upper, lower, levels) {
    const close = df[df.length - 1].close; let out = { type: null };
    const inside = upper && lower && lower.value_today * 0.97 <= close && close <= upper.value_today * 1.03;
    if (inside) {
      const su = upper.slope_per_bar, sl = lower.slope_per_bar, gap = upper.value_today - lower.value_today;
      if (gap > 0) {
        const cr = su - sl;
        if (cr < 0) {
          const bta = gap / (-cr);
          if (su < 0 && sl > 0) out = { type: '삼각수렴', bars_to_apex: roundHalfEven(bta) };
          else if (su < 0 && sl < 0) out = { type: '하락쐐기', bars_to_apex: roundHalfEven(bta) };
          else if (su > 0 && sl > 0) out = { type: '상승쐐기', bars_to_apex: roundHalfEven(bta) };
          out.upper_today = upper.value_today; out.lower_today = lower.value_today;
        }
      }
    }
    if (out.type === null && levels.length >= 2) {
      const recent = df.slice(-15).map(r => r.close), lv = levels.map(l => l.price).sort((a, b) => a - b);
      for (let i = 0; i < lv.length - 1; i++) {
        const lo = lv[i], hi = lv[i + 1];
        if (recent.every(x => x >= lo * 0.985 && x <= hi * 1.015) && hi / lo - 1 < 0.12) out = { type: '박스', box_low: lo, box_high: hi, bars: 15 };
      }
    }
    return out;
  }

  function keyLevels(df) {
    const y = df.slice(-250), d60 = df.slice(-60);
    const [highs, lows] = swingPoints(d60, 3);
    const l10 = df.slice(-10); let mi = 0; for (let i = 1; i < l10.length; i++) if (l10[i].low < l10[mi].low) mi = i;
    return { prev_swing_high: highs.length ? d60[highs[highs.length - 1]].high : null, prev_swing_low: lows.length ? d60[lows[lows.length - 1]].low : null,
      recent_low10: l10[mi].low, recent_low10_date: l10[mi].date, w52_high: max(y.map(r => r.high)), w52_low: min(y.map(r => r.low)),
      all_low: min(df.map(r => r.low)), all_high: max(df.map(r => r.high)) };
  }

  function fibonacci(df, lookback = 120) {
    const d = df.slice(-lookback); let hi_i = 0, lo_i = 0;
    for (let i = 1; i < d.length; i++) { if (d[i].high > d[hi_i].high) hi_i = i; if (d[i].low < d[lo_i].low) lo_i = i; }
    const hi = d[hi_i].high, lo = d[lo_i].low, rng = hi - lo, dir = hi_i < lo_i ? 'down' : 'up';
    const lv = {}; for (const k of [0.382, 0.5, 0.618]) lv[`${Math.floor(k * 1000) / 10}%`.replace(/^50%$/, '50.0%')] = dir === 'up' ? hi - rng * k : lo + rng * k;
    return { swing_high: hi, swing_low: lo, direction: dir, swing_high_date: d[hi_i].date, swing_low_date: d[lo_i].date, levels: lv };
  }

  function bollinger(df, w = 20, k = 2) {
    const c = df.map(r => r.close), m = rolling(c, w), s = rollingStd(c, w), L = c.length;
    const up = m.map((v, i) => v == null ? null : v + k * s[i]), lo = m.map((v, i) => v == null ? null : v - k * s[i]);
    const width = m.map((v, i) => v == null ? null : (up[i] - lo[i]) / v);
    const w60 = width.slice(-60), wl = width[L - 1];
    return { mid: m[L - 1], upper: up[L - 1], lower: lo[L - 1], width: wl,
      width_pct_rank_60: w60.filter(x => x != null && x < wl).length / w60.length,
      close_vs: c[L - 1] > up[L - 1] ? 'above' : c[L - 1] < lo[L - 1] ? 'below' : 'inside' };
  }

  function rsiVolume(df, n = 14) {
    const c = df.map(r => r.close), a = 1 / n;
    let g = null, l = null; const rs = new Array(c.length).fill(null);
    for (let i = 1; i < c.length; i++) {
      const dlt = c[i] - c[i - 1], gu = Math.max(dlt, 0), ld = Math.max(-dlt, 0);
      g = g === null ? gu : a * gu + (1 - a) * g; l = l === null ? ld : a * ld + (1 - a) * l;
      rs[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
    }
    const v = df.filter(r => r.vol_ok).map(r => r.volume), base = v.slice(-21, -1);
    const L = c.length;
    return { rsi: rs[L - 1], rsi_prev: rs[L - 2], vol_ratio: df[L - 1].volume / mean(base), chg_pct: pct(c[L - 1], c[L - 2]) };
  }

  function confluence(close, items, tol = 0.02) {
    const near = items.filter(([n, v]) => v && Math.abs(v / close - 1) <= tol).sort((a, b) => a[1] - b[1]);
    const groups = [];
    for (const [name, v] of near) {
      const g = groups[groups.length - 1];
      if (g && Math.abs(v / g.price - 1) <= 0.01) { g.lines.push(name); g.price = (g.price + v) / 2; }
      else groups.push({ price: v, lines: [name] });
    }
    return groups.filter(g => g.lines.length >= 2);
  }

  function prep(rows) {
    const df = rows.map(r => ({ date: String(r.date ?? r.time), open: +r.open, high: +r.high, low: +r.low, close: +r.close, volume: +r.volume }));
    const vs = df.map(r => r.volume).sort((a, b) => a - b), m = vs.length % 2 ? vs[(vs.length - 1) / 2] : (vs[vs.length / 2 - 1] + vs[vs.length / 2]) / 2;
    df.forEach(r => { r.vol_ok = r.volume > m * 0.01; });
    return df;
  }

  function analyze(rows, symbol) {
    const df = prep(rows);
    const krw = /\.(KS|KQ)$/.test(symbol), close = df[df.length - 1].close, asof = df[df.length - 1].date, f = x => fmt(x, krw);
    const [mas, crosses, arr] = movingAverages(df);
    const [levels, volZones] = horizontalLevels(df);
    let [upper, lower] = trendlines(df);
    const near = l => l != null && Math.abs(l.value_today / close - 1) <= 0.15;
    for (const side of ['upper', 'lower']) {
      let cur = side === 'upper' ? upper : lower;
      if (!near(cur)) cur = hullFromTurningPoints(df, side === 'upper', close) || cur;
      if (!near(cur)) {
        let got = false;
        for (const k of [3, 2, 1]) { const c = hullFromLastSwing(df, side === 'upper', 60, k); if (near(c)) { cur = c; got = true; break; } }
        if (!got) cur = cur || hullFromLastSwing(df, side === 'upper', 60, 3);
      }
      if (side === 'upper') upper = cur; else lower = cur;
    }
    const pat = pattern(df, upper, lower, levels), keys = keyLevels(df), fib = fibonacci(df), bb = bollinger(df), rv = rsiVolume(df);
    const cand = Object.entries(mas).map(([k, v]) => [k.toUpperCase(), v.value]);
    levels.forEach(l => cand.push([`수평 ${l.price < close ? '지지' : '저항'}(${l.touches}회)`, l.price]));
    if (upper) cand.push([upper.slope_per_bar < 0 ? '하락 추세선' : '상단 추세선', upper.value_today]);
    if (lower) cand.push([lower.slope_per_bar > 0 ? '상승 추세선' : '하단 추세선', lower.value_today]);
    Object.entries(fib.levels).forEach(([k, v]) => cand.push([`피보 ${k}`, v]));
    cand.push(['전저점', keys.prev_swing_low], ['전고점', keys.prev_swing_high], ['52주 저점', keys.w52_low], ['최근 저가', keys.recent_low10]);
    cand.push(['볼린저 하단', bb.lower], ['볼린저 중심', bb.mid]);
    const conf = confluence(close, cand);

    const S = [];
    const above = Object.entries(mas).filter(([k, v]) => close > v.value), nm = Object.keys(mas).length;
    const lc = crosses[crosses.length - 1];
    S.append = S.push;
    S.push(`[${asof} 종가 ${f(close)}] 이동평균 ${above.length}/${nm}개 위. ` + (arr ? `${arr}. ` : '')
      + (lc ? `최근 ${lc.pair} ${lc.type === 'golden' ? '골든' : '데드'}크로스(${lc.bars_ago}봉 전). ` : '')
      + (above.length === 0 && nm >= 3 ? '20·60·120일선 전부 아래 — 교과서적 하락 추세.' : ''));
    const sup = levels.filter(l => l.price < close), res = levels.filter(l => l.price >= close);
    if (sup.length) { const s0 = sup.reduce((a, b) => (b.price > a.price ? b : a)); S.push(`가장 가까운 수평 지지 ${f(s0.price)} (${s0.touches}회 반응, ${sp(pct(close, s0.price))}% 위). 깨지면 다음은 ${f(keys.w52_low)}(52주 저점).`); }
    else { const rl = keys.recent_low10; S.push(`여러 번 반응한 수평 지지는 없음. 1차 기준은 최근 저가 ${f(rl)}(${keys.recent_low10_date}, ${sp(pct(close, rl))}% 위)` + (rl * 0.75 < keys.w52_low && keys.w52_low < rl * 0.98 ? `, 그 아래 52주 저점 ${f(keys.w52_low)}.` : keys.w52_low >= rl * 0.98 ? ' = 52주 저점. 깨지면 신저가라 아래 기준선 없음.' : '. 그 아래는 1년 내 기준선이 멀어 올해 상승분 되돌림 구간(피보나치 참고).')); }
    if (res.length) { const r0 = res.reduce((a, b) => (b.price < a.price ? b : a)); S.push(`가장 가까운 저항 ${f(r0.price)} (${r0.touches}회, ${sp(pct(r0.price, close))}% 위).`); }
    if (upper) S.push(`${upper.slope_per_bar < 0 ? '하락' : '상단'} 추세선 ${upper.from}→${upper.to} (${upper.touches}터치, 봉당 ${sp(upper.slope_pct_per_bar)}%), 오늘 값 ${f(upper.value_today)}(${sp(pct(upper.value_today, close))}%). 종가로 넘으면 추세 전환 1차 신호.`);
    if (lower) S.push(`${lower.slope_per_bar > 0 ? '상승' : '하단'} 추세선 ${lower.from}→${lower.to}, 오늘 값 ${f(lower.value_today)}` + (close < lower.value_today * 0.995 ? ' — 현재가가 이미 아래(이탈).' : '.'));
    if (['삼각수렴', '하락쐐기', '상승쐐기'].includes(pat.type)) S.push(pat.bars_to_apex <= 60 ? `${pat.type} 진행 중 (상단 ${f(pat.upper_today)} / 하단 ${f(pat.lower_today)}), 꼭짓점까지 약 ${pat.bars_to_apex}봉. → 수렴 끝까지 횡보 가능성, 그 뒤 방향 결정 구간.` : `${pat.type} 모양이지만 꼭짓점이 멀어(60봉 넘게) 아직 신호로 보기 어려움.`);
    else if (pat.type === '박스') S.push(`박스권 ${f(pat.box_low)}~${f(pat.box_high)} ${pat.bars}봉째. 박스 안에서는 횡보 가능성 높고, 상·하단 종가 이탈이 신호.`);
    const fl = fib.levels;
    if (fib.direction === 'up') S.push(`피보나치(상승 스윙 ${fib.swing_low_date}→${fib.swing_high_date}의 되돌림): 38.2% ${f(fl['38.2%'])} · 50% ${f(fl['50.0%'])} · 61.8% ${f(fl['61.8%'])}. ` + (close < fl['61.8%'] ? '61.8% 아래 — 되돌림이 깊어 상승 추세 자체가 의심되는 구간.' : ''));
    else S.push(`피보나치(하락 스윙 ${fib.swing_high_date}→${fib.swing_low_date}의 반등 목표): 38.2% ${f(fl['38.2%'])} · 50% ${f(fl['50.0%'])} · 61.8% ${f(fl['61.8%'])}. 반등해도 38.2%(${f(fl['38.2%'])}) 전까진 '하락 중 반등'으로 봄.`);
    if (bb.width_pct_rank_60 <= 0.1) S.push('볼린저 폭이 60일 중 최저 수준(스퀴즈) → 곧 큰 움직임 가능성, 방향은 추세선·패턴 기준.');
    if (bb.close_vs === 'below') S.push(`종가가 볼린저 하단(${f(bb.lower)}) 밖 — 단기 과매도 반등 가능성과 추세 하락 지속이 충돌하는 자리.`);
    const tone = rv.chg_pct < -3 && rv.vol_ratio > 1.8 ? '투매(거래량 동반)' : rv.chg_pct < 0 && rv.vol_ratio < 0.7 ? '매수 부재(거래량 없이 하락)' : null;
    S.push(`RSI ${rv.rsi.toFixed(0)}` + (rv.rsi < 30 ? ' 과매도' : rv.rsi > 70 ? ' 과매수' : '') + ` · 거래량 20일 평균의 ${rv.vol_ratio.toFixed(1)}×` + (tone ? ` → ${tone}` : '') + '.');
    if (conf.length) {
      for (const g of conf) {
        g.side = g.price < close ? 'below' : 'above';
        S.push(g.side === 'below' ? `★ 합류(아래) ${f(g.price)} (${sp(pct(g.price, close))}%): ${g.lines.join(' + ')} — 유명한 선이 겹치는 받침. 한 번 튀어오를 가능성이 높지만 바닥 보장은 아님 → 반등 확인 후 진입.`
          : `★ 합류(위) ${f(g.price)} (${sp(pct(g.price, close))}%): ${g.lines.join(' + ')} — 유명한 선이 겹치는 천장. 여기서 막힐 가능성이 높고, 종가로 넘으면 의미가 큼.`);
      }
    } else S.push("현재가 ±2% 안에 겹치는 유명한 선 없음 — 기준선 사이 '빈 공간'. 다음 선까지 미끄러질 수 있음.");
    const counter = [];
    if (rv.rsi < 30) counter.push('RSI 과매도는 하락 추세에서 며칠씩 유지될 수 있음');
    if (above.length === 0) counter.push("모든 이평선 아래에서는 지지선이 자주 '잠깐' 반응하고 깨짐");
    if (rv.vol_ratio < 0.7) counter.push('거래량 없는 반등은 되돌림이 빠름');
    S.push('반대 근거: ' + (counter.length ? counter.join('; ') : '추세 추종 입장에선 아직 반등 확인 전') + '.');
    delete S.append;
    return { symbol, asof, close, krw, ma: mas, ma_crosses: crosses, ma_arrangement: arr, levels, volume_zones: volZones,
      trend_upper: upper, trend_lower: lower, pattern: pat, keys, fib, bollinger: bb, rsi_volume: rv, confluence: conf, sentences: S, live: true };
  }

  const api = { analyze, swingPoints, movingAverages, horizontalLevels, trendlines, keyLevels, fibonacci, bollinger, rsiVolume, confluence };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Engine = api;
})(typeof self !== 'undefined' ? self : this);
