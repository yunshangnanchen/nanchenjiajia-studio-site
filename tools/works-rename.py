# -*- coding: utf-8 -*-
"""
作品原图文件名规范化工具。

把 assets/works/ 里带非法字符（#、空格、全角标点、特殊 Unicode）的原图
重命名为 Netlify / GitHub Pages / URL 都安全的 ASCII 文件名，规则：

  原：2026-09-20 21.38.19-图集-YUNA ゆうな-勿忘我……#稿件展示 #漫画 #插画#黑白 #稿件禁用_1.jpeg
  新：work-04.png        （类型标记丢进映射表，只保留「分组序号 + 图片序号」）

为什么用 work-NN-MM 而不是中文/标题：
  - 纯 ASCII 最稳，彻底规避 URL 编码、多语言平台、Windows/Mac 文件名差异；
  - 标题等信息仍由 works-build.py 的 title_of() 从清单里读出，灯箱顶部照常显示；
  - 原图文件名只作为灯箱大图的存储 key，用户不可见。

用法：python tools/works-rename.py [--dry-run]
"""
import os
import re
import glob
import json
import argparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'works')
TITLE_MAP = os.path.join(ROOT, 'tools', 'works-titles.json')
EXTS = ('.jpeg', '.jpg', '.png', '.webp', '.avif')


def title_of(name):
    """从原始「日期-图集-YUNA ゆうな-标题#标签_序号.jpeg」里取标题部分。"""
    stem = re.sub(r'_\d+$', '', os.path.splitext(name)[0])
    parts = stem.split('-')
    out = []
    seen_yuna = False
    for p in parts:
        if 'YUNA' in p:
            seen_yuna = True
            continue
        if seen_yuna:
            out.append(p)
    title = '-'.join(out).strip() if out else stem
    title = re.split(r'[#＃]', title)[0].strip()
    return title or '作品'


def is_ascii_safe(name):
    """是否已是安全名：仅 [A-Za-z0-9._-]，不含空格 / # / 非 ASCII。"""
    return bool(re.fullmatch(r'[A-Za-z0-9._-]+', name))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true', help='只打印不改名')
    args = ap.parse_args()

    files = []
    for ext in EXTS:
        files += glob.glob(os.path.join(SRC, '*' + ext))
    files = sorted(set(files))

    groups = {}      # stem（去掉末尾 _序号）-> 图片数
    order = []       # 分组出现顺序（稳定排序）
    for path in files:
        name = os.path.basename(path)
        stem = re.sub(r'_\d+$', '', os.path.splitext(name)[0])
        if stem not in groups:
            groups[stem] = 0
            order.append(stem)
        groups[stem] += 1

    # 按分组出现顺序编号 work-01, work-02 ...
    group_no = {stem: i + 1 for i, stem in enumerate(order)}

    renamed = 0
    titles = {}          # 新文件名 -> 原标题（供 works-build.py 还原标题）
    for path in files:
        name = os.path.basename(path)
        ext = os.path.splitext(name)[1].lower()
        stem = os.path.splitext(name)[0]

        if is_ascii_safe(name):
            print('  跳过（已安全）:', name)
            continue

        # 末尾序号
        m = re.search(r'_(\d+)$', stem)
        idx = m.group(1) if m else '1'

        g = re.sub(r'_\d+$', '', stem)
        new_name = 'work-%02d-%s%s' % (group_no[g], idx, ext)
        new_path = os.path.join(SRC, new_name)

        if os.path.exists(new_path):
            print('  !! 目标已存在，跳过:', name, '->', new_name)
            continue

        titles[new_name] = title_of(name)

        if args.dry_run:
            print('  将重命名:', name, '->', new_name)
        else:
            os.rename(path, new_path)
            print('  重命名:', name, '->', new_name)
        renamed += 1

    if not args.dry_run:
        with open(TITLE_MAP, 'w', encoding='utf-8') as fp:
            json.dump(titles, fp, ensure_ascii=False, indent=2)
        print('标题映射已写入:', TITLE_MAP)

    print('\n共处理 %d 个文件（分组 %d 个）%s' % (
        renamed, len(order), '（dry-run，未实际改名）' if args.dry_run else ''))


if __name__ == '__main__':
    main()
