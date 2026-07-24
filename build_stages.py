#!/usr/bin/env python3
"""ステージのビルドスクリプト。

stages/ フォルダ内の各ステージ JSON（manifest.json を除く）を読み込み、
  - stages.js       … 本番同梱用。window.STAGES に全ステージを登録する。
  - stages/manifest.json … 開発時の fetch 読み込み用。ステージファイル名の一覧。
を生成する。

使い方:
    python3 build_stages.py

開発時（?dev）はブラウザが stages/manifest.json を見てフォルダから fetch する。
本番（GitHub Pages 等）は HTML が <script src="stages.js"> で同梱版を読む。
ステージを追加・編集したら本スクリプトを実行して両方を更新する。
"""
import json, os, sys, glob

ROOT = os.path.dirname(os.path.abspath(__file__))
STAGES_DIR = os.path.join(ROOT, "stages")

VALID_TYPES = {"ground", "push", "goal", "hazard", "avatar"}

def load_stage(path):
    with open(path, encoding="utf-8") as f:
        st = json.load(f)
    # 最低限の検証
    for key in ("id", "dims", "voxels"):
        if key not in st:
            raise ValueError(f"{os.path.basename(path)}: '{key}' がありません")
    d = st["dims"]
    for k in ("W", "H", "D"):
        if k not in d:
            raise ValueError(f"{os.path.basename(path)}: dims.{k} がありません")
    for v in st["voxels"]:
        if len(v) < 4:
            raise ValueError(f"{os.path.basename(path)}: voxel 形式は [x,y,z,type,gravity]")
        x, y, z, t = v[0], v[1], v[2], v[3]
        if t not in VALID_TYPES:
            raise ValueError(f"{os.path.basename(path)}: 未知の種類 '{t}'")
        if not (0 <= x < d["W"] and 0 <= y < d["H"] and 0 <= z < d["D"]):
            raise ValueError(f"{os.path.basename(path)}: 範囲外の座標 {v[:3]}")
    if "foldAllow" in st:
        fa = st["foldAllow"]
        if not isinstance(fa, dict) or not set(fa.keys()) <= {"+x", "-x", "+z", "-z"}:
            raise ValueError(f"{os.path.basename(path)}: foldAllow は +x/-x/+z/-z のみ指定可")
        # 全方向 false も許可（=そのステージでは2Dへ圧縮できない3D専用パズルになる）
    if "swapAllow" in st and not isinstance(st["swapAllow"], bool):
        raise ValueError(f"{os.path.basename(path)}: swapAllow は true/false で指定")
    if "walls" in st and not isinstance(st["walls"], bool):
        raise ValueError(f"{os.path.basename(path)}: walls は true/false で指定")
    if "hint" in st and not isinstance(st["hint"], str):
        raise ValueError(f"{os.path.basename(path)}: hint は文字列で指定")
    return st

def main():
    files = sorted(
        os.path.basename(p) for p in glob.glob(os.path.join(STAGES_DIR, "*.json"))
        if os.path.basename(p) not in ("manifest.json", "tiers.json")
    )
    if not files:
        print("stages/ にステージファイルがありません。", file=sys.stderr)
        sys.exit(1)

    stages = {}
    ordered_files = []
    for fname in files:
        st = load_stage(os.path.join(STAGES_DIR, fname))
        sid = st["id"]
        if sid in stages:
            raise ValueError(f"id が重複しています: {sid}")
        stages[sid] = (st, fname)
        ordered_files.append((st.get("order", 0), fname))

    # manifest.json（order 昇順のファイル名一覧）
    manifest = [f for _, f in sorted(ordered_files, key=lambda t: t[0])]
    with open(os.path.join(STAGES_DIR, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False)
    print(f"stages/manifest.json: {len(manifest)} 件")

    # stages.js（window.STAGES に登録。stages/tiers.json があれば window.TIERS も同梱）
    obj = {sid: st for sid, (st, _) in stages.items()}
    js = "window.STAGES = " + json.dumps(obj, ensure_ascii=False) + ";\n"
    tiers_path = os.path.join(STAGES_DIR, "tiers.json")
    if os.path.exists(tiers_path):
        with open(tiers_path, encoding="utf-8") as f:
            tiers = json.load(f)
        if not isinstance(tiers, dict):
            raise ValueError("tiers.json はオブジェクト（\"1\": \"章名\" 形式）で指定")
        js += "window.TIERS = " + json.dumps(tiers, ensure_ascii=False) + ";\n"
        print(f"tiers.json: {len(tiers)} 章の名前を同梱")
    with open(os.path.join(ROOT, "stages.js"), "w", encoding="utf-8") as f:
        f.write(js)
    print(f"stages.js: {len(obj)} ステージを同梱")

if __name__ == "__main__":
    main()
