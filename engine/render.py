"""render.py — lines.py 결과를 차트 PNG로. 국내식 색: 상승 빨강 / 하락 파랑."""
import sys, json
from pathlib import Path
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager, rcParams

sys.path.insert(0, str(Path(__file__).parent))
from lines import analyze, load_csv

UP, DOWN, WARN, OK, MUTED = "#F25C5C", "#4F9CF9", "#F5A623", "#3FBF7F", "#8A8A8A"
BG, PANEL, GRID, TXT = "#1E1E1E", "#252525", "#2A2A2A", "#DCDDDE"

def pick_font():
    for name in ["NanumGothic", "Noto Sans CJK KR", "Noto Sans KR", "AppleGothic", "Malgun Gothic"]:
        for f in font_manager.fontManager.ttflist:
            if name.lower() in f.name.lower():
                return f.name
    return None

def render(csv_path: str, out_png: str, bars: int = 90):
    r = analyze(csv_path)
    df = load_csv(csv_path).iloc[-bars:].reset_index(drop=True)
    close = r["close"]; krw = r["krw"]
    fmt = (lambda v: f"{v:,.0f}") if krw else (lambda v: f"{v:.2f}")
    fn = pick_font()
    if fn: rcParams["font.family"] = fn
    rcParams["axes.unicode_minus"] = False

    fig, (ax, axv) = plt.subplots(2, 1, figsize=(14, 8.5), gridspec_kw={"height_ratios": [4, 1]}, sharex=True, facecolor=BG)
    for a in (ax, axv):
        a.set_facecolor(BG); a.grid(color=GRID, lw=0.6); a.tick_params(colors=MUTED, labelsize=9)
        for sp in a.spines.values(): sp.set_color(GRID)
    x = range(len(df))
    # candles
    for i, row in df.iterrows():
        c = UP if row.close >= row.open else DOWN
        ax.plot([i, i], [row.low, row.high], color=c, lw=0.8)
        ax.add_patch(plt.Rectangle((i - 0.35, min(row.open, row.close)), 0.7, abs(row.close - row.open) or close * 0.001, color=c))
        axv.bar(i, row.volume, color=c, alpha=0.6, width=0.7)
    # MAs
    full = load_csv(csv_path)
    for w, col in ((20, "#7C9CFF"), (60, "#E8891D"), (120, "#B8A6FF"), (200, "#FFFFFF")):
        if len(full) >= w:
            ma = full["close"].rolling(w).mean().iloc[-bars:].values
            ax.plot(x, ma, color=col, lw=1, alpha=0.9, label=f"SMA{w}")
    # horizontal levels
    for l in r["levels"]:
        ax.axhline(l["price"], color=OK if l["price"] < close else WARN, ls="--", lw=0.8, alpha=0.8)
        ax.text(len(df) - 1, l["price"], f" {'지지' if l['price']<close else '저항'} {fmt(l['price'])} ({l['touches']}회)", color=TXT, fontsize=8, va="bottom")
    # trendlines
    def draw_tl(t, color, label):
        if not t: return
        d0 = pd.Timestamp(t["from"]); d1 = pd.Timestamp(t["to"])
        i0 = df.index[df["date"] == d0]; i1 = df.index[df["date"] == d1]
        if len(i0) == 0 or len(i1) == 0: return
        i0, i1 = int(i0[0]), int(i1[0])
        y0 = t["value_today"] - t["slope_per_bar"] * (len(df) - 1 - i0)
        xs = [i0, len(df) + 4]; ys = [y0, y0 + t["slope_per_bar"] * (len(df) + 4 - i0)]
        ax.plot(xs, ys, color=color, lw=1.6)
        ax.text(len(df) + 4, ys[1], f" {label} {fmt(t['value_today'])}", color=color, fontsize=8, va="center")
    draw_tl(r["trend_upper"], WARN, "추세선(상)")
    draw_tl(r["trend_lower"], WARN, "추세선(하)")
    # fib
    for k, v in r["fib"]["levels"].items():
        if df["low"].min() * 0.95 < v < df["high"].max() * 1.05:
            ax.axhline(v, color="#B8A6FF", ls=":", lw=0.7, alpha=0.7)
            ax.text(0, v, f"피보 {k} {fmt(v)}", color="#B8A6FF", fontsize=7, va="bottom")
    # bollinger
    bb = full["close"].rolling(20); m = bb.mean(); s = bb.std()
    ax.fill_between(x, (m - 2 * s).iloc[-bars:], (m + 2 * s).iloc[-bars:], color="#7C9CFF", alpha=0.06)
    # confluence
    for g in r["confluence"]:
        ax.axhspan(g["price"] * 0.99, g["price"] * 1.01, color=OK, alpha=0.18)
        ax.text(2, g["price"] * 1.01, f"★ 합류 {fmt(g['price'])}: " + " + ".join(g["lines"]), color=OK, fontsize=8.5, va="bottom", weight="bold")
    # keys
    ax.axhline(r["keys"]["w52_low"], color=DOWN, ls="-.", lw=0.8); ax.text(0, r["keys"]["w52_low"], f"52주 저점 {fmt(r['keys']['w52_low'])}", color=DOWN, fontsize=7, va="top")
    ax.set_xlim(-1, len(df) + 14)
    ax.set_ylim(df["low"].min() * 0.93, df["high"].max() * 1.04)
    ticks = list(range(0, len(df), 10)); ax.set_xticks(ticks); ax.set_xticklabels([str(df["date"].iloc[i].date())[5:] for i in ticks])
    ax.legend(loc="upper right", fontsize=8, facecolor=PANEL, labelcolor=TXT, edgecolor=GRID)
    pat = r["pattern"]
    title = f"{r['symbol']}  {r['asof']} 종가 {fmt(close)}   |   RSI {r['rsi_volume']['rsi']:.0f} · 거래량 {r['rsi_volume']['vol_ratio']:.1f}×"
    if pat.get("type"): title += f"   |   {pat['type']}" + (f" (꼭짓점까지 {pat['bars_to_apex']}봉)" if pat.get("bars_to_apex") else "")
    ax.set_title(title, color="#FFFFFF", fontsize=12, loc="left")
    # sentences
    txt = "\n".join("· " + s_ for s_ in r["sentences"])
    fig.text(0.01, 0.005, txt, color=TXT, fontsize=8, va="bottom", wrap=True)
    plt.subplots_adjust(bottom=0.30, top=0.95, left=0.05, right=0.99, hspace=0.05)
    fig.savefig(out_png, dpi=110, facecolor=BG)
    return r

if __name__ == "__main__":
    Path("out").mkdir(exist_ok=True)
    for p in sys.argv[1:]:
        r = render(p, f"out/{Path(p).stem}.png")
        print("saved", f"out/{Path(p).stem}.png")
