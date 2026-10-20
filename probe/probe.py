import json, sys, os
sys.path.insert(0, "engine")
import dart
R = {"key_set": bool(dart.KEY), "key_len": len(dart.KEY)}
try:
    cc = dart.corp_codes(); R["corp_codes"] = len(cc)
    names = ["한화오션", "한화시스템", "한화에어로스페이스", "HD현대중공업", "HD한국조선해양", "HD현대일렉트릭", "LS ELECTRIC", "LS마린솔루션"]
    for code, nm in [("267250", "HD현대"), ("000880", "한화"), ("051910", "LG화학"), ("214450", "파마리서치"), ("039490", "키움증권")]:
        R[nm] = dart.check(code, cc[code], names)
except Exception as e:
    R["err"] = repr(e)[:300]
open("probe/result.json", "w").write(json.dumps(R, ensure_ascii=False, indent=1))
